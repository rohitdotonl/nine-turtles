# 0188: A shorter search menu

*6 November 2026.*

**Context.** Point 4 of the owner's whole-app review of what to remove or
simplify. Search options had three sections and a dozen choices: where
(this list, All feeds, any other feed or folder from a long list), what
(Unread, Starred, With notes) and when (Any time, Past week, Past month,
Custom with two dates). Most of them repeat something the app already has:
going to a feed or folder searches it, the Unread and Notes lists are one
press away, and the sort order puts the newest or oldest first. The owner
asked for a suggestion and chose it.

**Decision.**

- The menu keeps two short sections. **Search in**: This list and
  **Everything** (the old "All feeds", in plainer words). **Show only**:
  **Starred**.
- **Other feed or folder**, **Unread**, **With notes** and **Published**
  (the dates) go. No folder list is added. Searching from the Unread list
  still searches only unread articles, and searching from the Notes list
  only the articles the reader marked, since that's the list it started in.
  In the Starred list, Show only: Starred is left out: it would only repeat
  This list.
- The web app's search no longer sends dates, and the server no longer
  reads them; notes are sent only for a search from the Notes list. The assistants' search tools (SPEC section 33) keep
  their own feed, folder, unread and starred choices; MCP is left as it is
  for now.

**Consequences.** Fewer choices to understand, one way to search a person
or folder (open it, then search), and less code. A reader who searched by
date sorts the list instead; a search from the Notes list replaces With notes.
