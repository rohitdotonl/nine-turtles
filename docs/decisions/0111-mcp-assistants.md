# 0111: Your own AI assistant connects over MCP, signed in with OAuth

*27 October 2026. Asked for by the owner ("Let's build MCP. Implement 1 to 15").*

**Decision.** nine turtles is an **MCP server** at `/mcp`, so a reader can
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
used once. Registered assistants nobody connects are forgotten after a day,
at most 500 are kept, and at most 60 register an hour. Return addresses:
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
whole for assistants. Removing a folder or a rule from an assistant has no
undo, as from another app: only a grouping or a rule goes, never a feed or
an article, and the assistant is given the removed rule so it can make it
again.

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
