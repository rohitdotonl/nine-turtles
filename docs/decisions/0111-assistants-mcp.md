# 0111: Assistants connect through MCP

*October 2026.*

**Decision.** On 27 October 2026 the owner chose to let each reader connect
their own AI assistant to their account through MCP (the Model Context
Protocol, an open standard). nine turtles runs no AI and never summarises,
rewrites or ranks what writers wrote: the reader picks the assistant and
what it does, as they already can with other apps through the Google Reader
API (decision 0070). It isn't marketed as an AI feature.

- **Any assistant:** built to the open standard only, with nothing specific
  to one company, and tested with at least two different assistants.
- **Sign-in:** the "Allow this assistant?" screen (OAuth), so nothing
  reaches an account until its reader approves it; that approval is the
  opt-in, so there's no switch. A fallback assistant key, made in Settings
  like the app password, for tools that can't show that screen. Settings
  lists connected assistants, each with Disconnect.
- **Fifteen tools:** search; list unread; list starred; open an article;
  list feeds and folders; feed health; list rules and mutes; mark read or
  unread (including a whole feed); star or unstar; add a feed; rename a feed
  or move it to a folder; create, rename or remove a folder (keeping its
  feeds); add or remove a rule or mute; unsubscribe; export the feed list.
- **Unsubscribing keeps the floor:** an assistant's unsubscribe keeps the
  feed and its articles for 30 days, with Undo in Settings, then removes
  them for good.
- **Left out on purpose:** password, email, deleting the account, payments,
  sign-up and invites, app passwords, the reader's newsletter address, and
  the full download of every article (too big for an assistant, heavy for
  the server, and the Settings button already does it).
- **Guards:** limits per reader on how often and how much, so a looping
  assistant can't slow the app for others. "Add a feed" takes only ordinary
  web addresses, limited in length and in how many per hour, because an
  article written to trick an assistant could otherwise use our fetcher to
  send data to a stranger's address. Article text is sanitized as everywhere.
- **Upkeep:** every 15 days an agent checks for a new MCP version (and
  whether assistants now require it), for security notices about the
  libraries used, and that two test assistants can still connect and
  search. Needed updates go through a normal pull request. It says nothing
  when all is fine.
- **Libraries:** the owner approved in advance (27 October 2026) whatever libraries this milestone needs. The build needed none (below).

## How it was built (27 October 2026)

nine turtles is an **MCP server** at `/mcp`, so a reader can
connect their own AI assistant (Claude, ChatGPT, or any other that speaks the
open Model Context Protocol) to their account (SPEC section 33). nine
turtles runs no AI itself and isn't marketed as an AI feature: it's a door,
like the Google Reader API for other apps (decision 0070). Code:
`server/src/mcp.rs` (the tools) and `server/src/assistants.rs` (signing in
and Settings); screens `web/src/lib/ConnectAssistant.svelte` and
`web/src/lib/Assistants.svelte`; structure change 26.

**The standard only.** The owner asked that every kind of assistant work,
not just Claude. So nine turtles follows the MCP specification (versions
2025-11-25, 2025-06-18 and 2025-03-26) and plain OAuth standards, with
nothing for any one company: "Streamable HTTP" answered with JSON (no
streaming, no session kept), OAuth 2.1 with PKCE (S256 only), authorization
server metadata (RFC 8414), protected resource metadata (RFC 9728), dynamic
client registration (RFC 7591) and the `iss` answer (RFC 9207). It was tried
end to end with two different clients, the official TypeScript and Python
MCP SDKs. An assistant that can't do the sign-in page uses an **assistant
key** made in Settings (shown once, kept scrambled, like the app password).

**No new library.** The owner allowed any library, but none was needed:
JSON-RPC is a few lines of `serde_json`, PKCE is SHA-256 (`sha2`, already
approved) and base64url (a few lines), and tickets are made and scrambled as
sign-in tickets are (`auth::new_token`, BLAKE2s). Fewer moving parts, and
nothing that can lag behind the standard on its own (ENGINEERING.md →
"Boring and few").

**Tickets.** An access ticket lasts an hour; a refresh ticket 90 days and is
swapped for a new one each time (used once). Codes last ten minutes and are
used once. Registered assistants nobody connects are forgotten after a day;
at most 2,000 are kept (past that the oldest nobody connected makes room),
and at most 10 register an hour from one internet address (the last one
Render's proxy adds to `X-Forwarded-For`) and 300 from everywhere, so one
stranger can't stop other readers connecting. Return addresses:
https anywhere, http only to `localhost`, or an app's own scheme
(`cursor://…`, RFC 8252); never `javascript:`, `data:`, `file:` and the like,
never with a `#` part. Assistants' addresses (`/mcp`, `/oauth/token`,
`/oauth/register`) skip the same-site check: they never use the cookie, so
another website can't act through them. Approving and denying are ordinary
signed-in, same-site actions; the page then sends the browser on with
`location.assign`, because the page's rules (`form-action 'self'`) would stop
a form from sending it to another site.

**The tools.** The 15 agreed with the owner (search, unread, starred, open
an article, feeds and folders, feed health, rules; mark read and a whole
feed read, star, add a feed, rename and file a feed, folders, rules and
mutes, unsubscribe, the OPML list), plus **bring back a feed**, which the
30-day keep makes sense of. Left out on purpose: the password, email,
account deletion, payments, sign-up and invites, app passwords, the
newsletter address and downloading every article (too big for an assistant,
heavy for the server, and already a button in Settings). Opening an article
doesn't mark it read. Search gained an `author` filter for this, not yet on
the search screen.

**Unsubscribing keeps the feed 30 days.** The owner first chose no undo,
then (27 October 2026, 03:10) a 30-day one: a feed an assistant unsubscribes
from is hidden at once, with `subscriptions.kept_until` 30 days on, and
`folders::clear_unsubscribed` leaves it alone until then, even when the
reader unsubscribes from another feed on the screen. Settings lists these
with **Bring back**. This keeps the floor "nothing deletes without undo"
whole for assistants. Removing a folder or a rule has an undo the assistant
holds, as the screen's Undo is held by the screen: removing a folder answers
its feeds and the rules that pointed at it, and `create_folder` with those
puts it back as it was; removing a rule answers it whole, and `add_rule` makes
it again (paused if it was). Adding a kept feed again by its address (the
Add field, or `add_feed`) brings it back whole rather than afresh.

**Guards.** An assistant can be told things by the articles it reads
("prompt injection"), so: each reader's assistants together get 60 calls a
minute and 3,000 a day, and 20 feeds added an hour, http(s) only, at most
2,000 characters, through the same fetcher and autodiscovery as the Add
field (decisions 0016, 0099), which never visits private addresses; lists
come 50 at a time; text is cut at 30,000 characters; marking takes 500
articles at most; and the assistant is told on connecting that article text
is content, never instructions. Counts are kept in memory and start again
when nine turtles restarts, which is fine for limits this loose.

**Upkeep.** Every 15 days an agent checks whether the MCP standard changed
and whether nine turtles needs to follow (`docs/operations/mcp-check.md`).
