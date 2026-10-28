# The 15-day MCP check

Every 15 days, an agent checks that assistants can still connect to nine
turtles (SPEC section 33, decision 0111), and keeps nine turtles in step with
the MCP standard. These are the agent's instructions; any agent or person
can follow them.

**Calm by design:** if everything is fine and nothing needs to change, the
check does nothing. No "all good" issues, no messages.

## What the check needs

- Read access to this repository, and permission to open issues and pull
  requests in it.
- Network access to `modelcontextprotocol.io`, `github.com`, `npmjs.com` and
  `pypi.org`, and to the live app.
- Optionally, for step 4: an environment variable `NINE_TURTLES_ASSISTANT_KEY`,
  an assistant key the owner made in Settings › Connected assistants on a
  test reader with a feed or two (never the owner's own account), and
  `NINE_TURTLES_ADDRESS` (`https://app.nineturtles.app`). Never print, post
  or commit the key.

## Steps

1. **Has the standard changed?** Read the specification's versions list
   (`https://modelcontextprotocol.io/specification`, and the changelog of the
   newest version) and compare with `PROTOCOL_VERSIONS` in
   `server/src/mcp/mod.rs`. A new version matters when it changes something nine
   turtles uses: Streamable HTTP, `initialize`, `tools/list`, `tools/call`,
   tool annotations, or the authorization rules (OAuth 2.1, PKCE, RFC 8414,
   RFC 9728, RFC 7591, client ID metadata documents).

2. **Do the big assistants need it?** Check the current help pages for
   custom connectors in Claude and ChatGPT, and any other assistant readers
   use, for a newer version they now require or a change in how they sign
   in. A new version nobody requires yet can wait for the next check, noted
   in the pull request or issue if it's coming.

3. **Run nine turtles against two different clients.** Build and run nine
   turtles on this computer (`docs/operations/building-and-running.md`, with
   `NINE_TURTLES_ALLOW_LOCAL_FEEDS=yes`), then connect the newest official
   TypeScript MCP SDK client (`@modelcontextprotocol/sdk`) and the newest
   official Python one (`mcp`), each doing the whole sign-in: register,
   approve (by calling `/api/oauth/approve` with a signed-in cookie, as the
   page does), swap the code, `initialize`, `tools/list`, and a few tool calls
   (`list_feeds`, `search_articles`, `add_feed` with a local test feed). Both
   must work. Two scripts that do this are in
   [mcp-clients/](mcp-clients/) (`ts-client.mjs` and `py-client.py`; they
   expect nine turtles at `http://localhost:8090` with the password
   `quiet reading time`, and the TypeScript one takes a feed address).
   Install the SDKs in a scratch folder, not in `web/`; update the scripts
   if the SDKs changed.

4. **Try the live app.** If the key is set:
   `curl -sS --max-time 60 -H "Authorization: Bearer $NINE_TURTLES_ASSISTANT_KEY" -H "content-type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_articles","arguments":{"query":"the"}}}' "$NINE_TURTLES_ADDRESS/mcp"`
   expects a `result` with `"isError": false`. Also fetch
   `$NINE_TURTLES_ADDRESS/.well-known/oauth-authorization-server` and check
   every address in it starts with the live app's address.

5. **Security notices.** nine turtles uses no MCP or OAuth library (decision
   0111), so look for published weaknesses in MCP servers' or OAuth's way of
   working that apply to how `server/src/assistants.rs` and `server/src/mcp/` do it
   (for example a new attack on PKCE, dynamic registration or redirects),
   and run `cargo audit` if available for the libraries it does use (`sha2`,
   `blake2`, `axum`).

6. **Act.**
   - All fine: do nothing, and say so in one line in your own channel.
   - Something needs changing and the change is clear: build it as a normal
     pull request following AGENTS.md (tests, docs, a decision note if it's a
     real choice), with checks and the review. It merges under the owner's
     standing approval when nothing risky came up; anything that could lose
     data, weakens a guard, or changes what assistants may do goes to the
     owner first.
   - Broken and not clearly fixable: open an issue titled
     `MCP check: <what's wrong>` with the label `mcp-check`, in plain words
     for the owner: what doesn't work, what it means for them, and what you
     suggest.

## How it's scheduled

Any scheduler that can start an agent every 15 days with this file as its
instructions works (AGENTS.md: no lock-in). Current setup: a scheduled
Claude Code routine on the 1st and 16th of each month, each run in a fresh
session (set up 27 October 2026). Its whole prompt is: "Follow
docs/operations/mcp-check.md in rohitdotonl/nine-turtles. Never print, post
or commit the assistant key. If everything is fine, do nothing and say so in
one line."
