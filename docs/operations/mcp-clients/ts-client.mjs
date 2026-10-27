// Connects the official MCP TypeScript SDK client to a local nine turtles,
// doing the whole OAuth flow, then calls some tools.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";

const BASE = "http://localhost:8090";
const PASSWORD = "quiet reading time";

async function signIn() {
  const r = await fetch(`${BASE}/api/sign-in`, { method: "POST", headers: { "content-type": "application/json", "sec-fetch-site": "same-origin" }, body: JSON.stringify({ password: PASSWORD }) });
  return r.headers.get("set-cookie").split(";")[0];
}

let authUrl;
const store = {};
const provider = {
  get redirectUrl() { return "http://localhost:9999/callback"; },
  get clientMetadata() { return { client_name: "TypeScript SDK test", redirect_uris: ["http://localhost:9999/callback"], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" }; },
  clientInformation() { return store.client; },
  saveClientInformation(info) { store.client = info; },
  tokens() { return store.tokens; },
  saveTokens(tokens) { store.tokens = tokens; },
  redirectToAuthorization(url) { authUrl = url; },
  saveCodeVerifier(v) { store.verifier = v; },
  codeVerifier() { return store.verifier; },
};

const url = new URL(`${BASE}/mcp`);
let transport = new StreamableHTTPClientTransport(url, { authProvider: provider });
let client = new Client({ name: "ts-test", version: "1.0.0" });
try {
  await client.connect(transport);
  throw new Error("expected sign-in to be needed");
} catch (e) {
  if (!(e instanceof UnauthorizedError)) throw e;
}
console.log("asked to open:", authUrl.pathname);
const cookie = await signIn();
const shown = await (await fetch(`${BASE}/api/oauth/request${authUrl.search}`, { headers: { cookie } })).json();
console.log("connect page shows:", shown);
const approved = await (await fetch(`${BASE}/api/oauth/approve`, { method: "POST", headers: { cookie, "content-type": "application/json", "sec-fetch-site": "same-origin" }, body: JSON.stringify({ query: authUrl.search }) })).json();
const code = new URL(approved.redirect).searchParams.get("code");
await transport.finishAuth(code);
transport = new StreamableHTTPClientTransport(url, { authProvider: provider });
client = new Client({ name: "ts-test", version: "1.0.0" });
await client.connect(transport);
console.log("server:", client.getServerVersion(), "protocol:", transport.protocolVersion ?? "(set)");
const { tools } = await client.listTools();
console.log("tools:", tools.length, tools.map((t) => t.name).join(", "));
const feed = process.argv[2];
let r = await client.callTool({ name: "add_feed", arguments: { address: feed } });
console.log("add_feed:", r.isError ? "ERROR " : "", r.content[0].text.slice(0, 120).replace(/\n/g, " "));
r = await client.callTool({ name: "search_articles", arguments: { query: "gardens" } });
console.log("search_articles:", JSON.parse(r.content[0].text).articles.length, "found");
r = await client.callTool({ name: "export_feed_list", arguments: {} });
console.log("export_feed_list ok:", JSON.parse(r.content[0].text).file.includes("<opml"));
await client.close();
