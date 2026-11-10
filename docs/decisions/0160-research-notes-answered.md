# 0160: The research notes, answered

**In one line:** The research notes answered: never scrape stays but any feed address may be followed, including outside feed makers; notes and highlights, a feed finder that tries a few more places and a clearer choice between several feeds join V1; batched delivery, the check-up page, Kindle and text to speech dropped; smaller ideas parked for V2

*3 November 2026. The owner went through the open questions in his
research notes of 1 November (`docs/RnD/research-notes-2026-11.md`).*

## Decision

- **Never scrape stays, and readers may follow any feed address,** including
  one made by someone else's service from a site that has none (RSS Bridge,
  OpenRSS and the like). nine turtles itself never builds a feed from a web
  page. Readers are treated as adults: if a publisher blocks such a service,
  that's between them (the owner). SPEC section 3 says so.
- **In V1: notes and highlights.** A private note on each person, and
  highlights and notes on articles, found by search and exported with Your
  data (`docs/PLAN.md` → V1, item 8). Its SPEC section comes first.
- **Also in V1, built next** (the owner, 3 November 2026; `docs/PLAN.md` →
  V1, items 9 and 10):
  - The feed finder tries a few more places when the pasted page names no
    feed: the site's home page and the usual feed addresses. Still only
    when the reader asks, once. This will change decision 0016's "never
    guesses other addresses" and AGENTS.md's rule when it's built.
  - When a site has several feeds, each shows its last few titles and how
    often it posts, so the reader can choose.
- **Dropped:** batched delivery (new posts at set times), the check-up page
  (people who haven't posted in a while), Kindle (for now), text to speech
  (device read-aloud already works), and the ideas
  already settled by People, Write back and No unread counts.
- **Parked for V2 discussion:** the smaller ideas of the notes' section 7
  (`docs/PLAN.md` → "To discuss for V2").
- **The research notes were cut** to what's still open: website
  inspiration, rivals to study, readers' own words and research errands
  (answered by a research agent the same day,
  `docs/RnD/research-errands-2026-11.md`). Marketing ideas not yet discussed moved to
  `docs/RnD/marketing.md`.

## Why

Most of the notes' questions were answered by what was built on 2 and 3
November. The owner wants nothing settled or dropped left in `docs/RnD/`.
