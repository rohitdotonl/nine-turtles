// Tests the newsletter forwarder (cloudflare/newsletter-worker/worker.js,
// decision 0091) with a pretend Cloudflare: a pretend email and a pretend
// nine turtles. Kept emails stay; mail to an address nobody has bounces;
// anything else is passed on to FORWARD_TO, bounced, or reported for the
// sender to try again.

import { readFileSync } from "node:fs";
import worker from "../cloudflare/newsletter-worker/worker.js";

const problems = [];
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// The forwarder and nine turtles must agree on the biggest email.
const SIZE_LIMIT = 10 * 1024 * 1024;
if (!read("../cloudflare/newsletter-worker/worker.js").includes("const SIZE_LIMIT = 10 * 1024 * 1024;"))
  problems.push("worker.js's SIZE_LIMIT isn't 10 MB");
if (!read("../server/src/newsletters.rs").includes("pub const EMAIL_SIZE_LIMIT: usize = 10 * 1024 * 1024;"))
  problems.push("newsletters.rs's EMAIL_SIZE_LIMIT isn't 10 MB");
const RAW = "From: News <news@example.com>\r\nSubject: Hello\r\n\r\nHi\r\n";

function email(size = RAW.length) {
  const message = {
    to: "turtle-abcd2345@in.example",
    rawSize: size,
    raw: new Response(RAW).body,
    forwardedTo: null,
    rejected: null,
    async forward(to) {
      this.forwardedTo = to;
    },
    setReject(reason) {
      this.rejected = reason;
    },
  };
  return message;
}

async function run(what, { status, answer, size, forwardTo, wanted }) {
  const sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push({ url: String(url), init });
    if (status === null) throw new TypeError("network down");
    return new Response("", { status, headers: answer ? { "x-nine-turtles-answer": answer } : {} });
  };
  const message = email(size);
  const env = { NINE_TURTLES_URL: "https://app.example", NINE_TURTLES_SECRET: "s3cret", FORWARD_TO: forwardTo };
  let threw = false;
  try {
    await worker.email(message, env);
  } catch {
    threw = true;
  }
  const got = threw ? "error" : message.forwardedTo ? `forwarded to ${message.forwardedTo}` : message.rejected ? "bounced" : "kept";
  if (got !== wanted) problems.push(`${what}: wanted ${wanted}, got ${got}`);
  return sent;
}

const sent = await run("a kept email", { status: 200, wanted: "kept" });
const [request] = sent;
if (request?.url !== "https://app.example/newsletters/incoming") problems.push(`posted to ${request?.url}`);
if (request?.init.headers.authorization !== "Bearer s3cret") problems.push("the secret wasn't sent");
if (request?.init.headers["x-nine-turtles-to"] !== "turtle-abcd2345@in.example") problems.push("the recipient wasn't sent");
if (new TextDecoder().decode(request?.init.body) !== RAW) problems.push("the email wasn't sent whole");

await run("read but not kept, with an inbox", { status: 202, forwardTo: "me@example.com", wanted: "forwarded to me@example.com" });
await run("refused, with an inbox", { status: 401, forwardTo: "me@example.com", wanted: "forwarded to me@example.com" });
await run("out of reach, with an inbox", { status: null, forwardTo: "me@example.com", wanted: "forwarded to me@example.com" });
await run("refused, no inbox", { status: 422, wanted: "bounced" });
await run("nobody's address, with an inbox", { status: 404, answer: "no-such-address", forwardTo: "me@example.com", wanted: "bounced" });
await run("a replaced address, with an inbox", { status: 410, answer: "replaced", forwardTo: "me@example.com", wanted: "bounced" });
await run("a label switched off, with an inbox", { status: 410, answer: "label-off", forwardTo: "me@example.com", wanted: "bounced" });
await run("newsletters off (a plain 404), with an inbox", { status: 404, forwardTo: "me@example.com", wanted: "forwarded to me@example.com" });
await run("nine turtles down, no inbox", { status: 503, wanted: "error" });
await run("out of reach, no inbox", { status: null, wanted: "error" });
await run("read but not kept, no inbox", { status: 202, wanted: "error" });
const big = await run("too big, no inbox", { status: 200, size: SIZE_LIMIT + 1, wanted: "bounced" });
if (big.length !== 0) problems.push("a too-big email was still posted");
await run("too big, with an inbox", { status: 200, size: SIZE_LIMIT + 1, forwardTo: "me@example.com", wanted: "forwarded to me@example.com" });

if (problems.length) {
  console.error(`The newsletter forwarder has problems:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log("The newsletter forwarder passes on every email it doesn't hand to nine turtles.");
