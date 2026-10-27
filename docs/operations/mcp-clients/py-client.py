# Connects the official MCP Python SDK client to a local nine turtles,
# doing the whole OAuth flow, then calls some tools.
import asyncio, json, sys, urllib.parse
import httpx2
from mcp import ClientSession
from mcp.client.auth import OAuthClientProvider, AuthorizationCodeResult
from mcp.client.streamable_http import streamable_http_client
from mcp.shared.auth import OAuthClientMetadata

BASE = "http://localhost:8090"
PASSWORD = "quiet reading time"

class Memory:
    def __init__(self): self.tokens = None; self.client = None
    async def get_tokens(self): return self.tokens
    async def set_tokens(self, t): self.tokens = t
    async def get_client_info(self): return self.client
    async def set_client_info(self, c): self.client = c

redirected = {}

async def redirect_handler(url):
    redirected["url"] = url

async def callback_handler():
    async with httpx2.AsyncClient() as http:
        r = await http.post(f"{BASE}/api/sign-in", json={"password": PASSWORD}, headers={"sec-fetch-site": "same-origin"})
        cookie = r.headers["set-cookie"].split(";")[0]
        query = "?" + urllib.parse.urlsplit(redirected["url"]).query
        shown = (await http.get(f"{BASE}/api/oauth/request{query}", headers={"cookie": cookie})).json()
        print("connect page shows:", shown)
        approved = (await http.post(f"{BASE}/api/oauth/approve", json={"query": query}, headers={"cookie": cookie, "sec-fetch-site": "same-origin"})).json()
    back = dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(approved["redirect"]).query))
    return AuthorizationCodeResult(code=back["code"], state=back.get("state"), iss=back.get("iss"))

async def main():
    auth = OAuthClientProvider(
        server_url=f"{BASE}/mcp",
        client_metadata=OAuthClientMetadata(client_name="Python SDK test", redirect_uris=["http://localhost:9998/callback"], grant_types=["authorization_code", "refresh_token"], response_types=["code"]),
        storage=Memory(), redirect_handler=redirect_handler, callback_handler=callback_handler)
    async with httpx2.AsyncClient(auth=auth) as http:
        async with streamable_http_client(f"{BASE}/mcp", http_client=http) as streams:
            read, write = streams[0], streams[1]
            async with ClientSession(read, write) as session:
                init = await session.initialize()
                print("server:", init.server_info.name, "protocol:", init.protocol_version)
                tools = await session.list_tools()
                print("tools:", len(tools.tools))
                r = await session.call_tool("list_feeds", {})
                feeds = json.loads(r.content[0].text)["feeds"]
                print("list_feeds:", [f["name"] for f in feeds])
                r = await session.call_tool("list_unread", {})
                arts = json.loads(r.content[0].text)["articles"]
                print("list_unread:", len(arts))
                r = await session.call_tool("open_article", {"article_id": arts[0]["id"]})
                print("open_article:", json.loads(r.content[0].text)["text"])
                r = await session.call_tool("star", {"article_ids": [arts[0]["id"]], "starred": True})
                print("star:", r.is_error is False)
                r = await session.call_tool("unsubscribe_feed", {"feed_id": feeds[0]["id"]})
                print("unsubscribe:", json.loads(r.content[0].text)["kept_until"])
                r = await session.call_tool("resubscribe_feed", {"feed_id": feeds[0]["id"]})
                print("resubscribe:", r.content[0].text.replace("\n", " "))

asyncio.run(main())
