# 0279: Who isn't working: one quiet row, a line each, and a box on their page

**In one line:** At the top of Everyone you follow, failing feeds fold into one quiet row ("8 feeds aren't working", with how many of each reason); opened, each is one line (an icon and a few words for what went wrong, its name, ›), and their page leads with one box holding the problem and what can be done, the likeliest first.

*16 November 2026. The owner, looking at eight failing feeds: "Look at the giant wall of text. That's not good UX." Shown two ways, then the reasons cut to a few words with icons, then five versions of growing boldness, he tried two and four side by side on his Mac and chose four, the folded row. Asked what next, so that fixing, writing to them or unfollowing is simple, he chose the box on their page: "Implement B and merge".*

**What changes.**
1. Each row was a sentence ("Nothing has come through since 24 Oct. The site
   says the feed isn't there any more. It may have moved. Jet Williams may
   not know.") and two or three underlined words (decision 0268). Eight
   failing feeds made 1,700px of text and 24 links on a phone. Now they
   start as one row of about 56px, which says how many and why, and opens
   in place.
2. The reasons are two to five plain words with an icon, never a code:
   "Feed gone", "Site not answering", "Not a feed any more", "Blocked by
   the site", and so on (SPEC section 15). The icons are new (BRAND.md →
   Icons). Feeds that are gone come before those having trouble, and alike
   reasons sit together.
3. What can be done moves to their page, into one box under their name:
   what went wrong and since when, one sentence, then Find new address,
   Write to for a person, and Unsubscribe, in that box rather than in three
   places. Find comes first, as the bordered button, when the feed may have
   moved; Write to comes first when the site stopped answering, since only
   the writer can fix that.
4. Gone: the row's own actions, Undo and "Working again", the person or
   publication icon before each name, and "Having trouble" as a separate
   heading.

**Why.** Clear at a glance: one row says how bad things are; a list of
names with an icon each says why. Nothing pulls: eight failing feeds no
longer take the top of the page. Less, but better: each action has one
home, on the page of the one it's about.

**What it costs.** Fixing one is a press further away (open the row, open
them). Choose… in the list below still unsubscribes many at once.
