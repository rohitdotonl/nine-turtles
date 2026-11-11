# 0257: Assistants may introduce themselves by their own address

**In one line:** An assistant's `client_id` may be the https address of its client ID metadata document (MCP's preferred way since 2025-11-25): nine turtles reads that file when a signed-in reader opens the Connect page (at most once a day per assistant, 20 an hour per reader, 300 in all, 8 seconds, 10 KB, public addresses only, never followed elsewhere), takes it only if it names itself exactly and gives safe return addresses, keeps it in `assistant_clients`, and says so in its metadata; dynamic registration stays beside it

*11 November 2026.*

MCP's 2026-07-28 version calls dynamic client registration (RFC 7591,
`/oauth/register`) "deprecated" and prefers **client ID metadata
documents**: instead of registering, an assistant uses as its client id the
web address of a small JSON file on its own site, giving its name and the
addresses a reader may be sent back to. It's how Claude, ChatGPT and VS Code
prefer to sign in when a server says it can. Rohit chose to add it and keep
the old way too (11 November 2026), since some assistants (Cursor, for one)
only know the old way, and the standard keeps it for at least 12 months.

## How it works (`server/src/assistants/metadata.rs`)

- The authorization server metadata says
  `client_id_metadata_document_supported: true`.
- A client id that starts `https://` is such an address (ones nine turtles
  gives at registration start `ntc_`). It must be exactly as written (no `.`
  or `..` parts, no name and password, no `#` part) with a path beyond `/`.
- When a signed-in reader opens the "Connect this assistant?" page for it,
  nine turtles reads the file, unless it read it in the last day. The file
  is fetched as feeds are (public addresses only, `fetch`), in at most 8
  seconds, at most 10 KB, and only from that address: a redirect elsewhere
  is refused. It must be JSON whose `client_id` is that address exactly,
  with one to 20 return addresses, each allowed as a registered one's are
  (https, http only to localhost, an app's own scheme), and no client
  secret (`token_endpoint_auth_method` none or absent).
- What it says goes in `assistant_clients` like a registered assistant's
  (updated in place when read again, so connections stay theirs), so
  approving, denying and swapping the code read nothing more, and the rest
  of signing in is unchanged.
- Limits: 20 files read an hour per reader and 300 in all, so the page
  can't be used to make nine turtles visit many sites. A file that doesn't
  fit makes the link "can't be used"; a site that doesn't answer, or a
  limit reached, says "try again" (503).

## Why it's allowed to visit

AGENTS.md lists every visit nine turtles makes. This one is to the
assistant's own site, never a publisher's, only when a signed-in reader
asks to connect that assistant, and at most once a day for it. It reaches no
reader's data and sends nothing but the request.

## Left out

The standard says a server SHOULD warn more when an assistant's only return
addresses are on the reader's own computer (`localhost`), since anyone can
claim those. The Connect page already names the website the reader goes
back to for every assistant, registered or not; a stronger warning would be
a change to that screen, for the owner to choose.

**Revisit when:** the big assistants no longer register, and dynamic
registration can go (the 15-day MCP check watches for it).
