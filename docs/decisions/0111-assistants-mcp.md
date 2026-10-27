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
- **Libraries:** none approved yet; the build asks the owner first.
