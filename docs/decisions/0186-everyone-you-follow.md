# 0186: Everyone you follow, one page

*6 November 2026.*

**Context.** Point 1 of the owner's whole-app review of what to remove or
simplify: Settings › Your library had two pages listing the same people.
Your feeds (decision 0080) listed everyone, with a "Quiet for 6 months / a
year" filter; Feed health (decision 0071) listed only those not working,
with Find new address, Retry and Unsubscribe. A reader had to know which
page to look in, and both were named after machinery. The owner saw a safe
and a bold version as mockups and chose the safe one.

**Decision.**

- **One page, Everyone you follow**, at `/settings/feeds`; the old
  `/settings/feed-health` opens it too. Settings › Your library has one row
  for it instead of two.
- **Who isn't working comes first**, as the feed health page's cards were,
  under Not working and Having trouble, each with Find new address and
  Unsubscribe. The cards no longer show the address tried or the day it
  last worked, and their bold line says since when: "Nothing has come
  through since 1 November."
- **Retry goes**, from the screen and the server (`/api/health/{id}/retry`).
  nine turtles keeps checking by itself, and Find new address is the step
  that fixes a moved feed.
- **Then everyone, A to Z, People and Publications apart** as in the
  sidebar. Each row names the title of their newest piece and when it
  came, so a reader remembers who someone is before opening them (the
  writer comes first). After six months with nothing new, the row says
  "Quiet since …" in the same grey, so the Show filter goes.
- **A row opens their page** (section 36: write back, notes, Edit), not
  only their list of articles.
- **Edit becomes Choose…**, because it chooses several at once; what it
  does is unchanged.

**Consequences.** SPEC section 17 is retired into section 15. The list
answers "where's that person?" (A to Z); "who's been writing lately?" stays
Unread's job. The bold version (newest first, a Find field, the quiet ones
gathered at the bottom with "Unsubscribe from these…") was not chosen.
