# 0279: Who isn't working, one line each, gathered by what went wrong

**In one line:** At the top of Everyone you follow, each failing feed is one line (its name, the day nothing has come through since, and ›) under a few plain words saying what went wrong, said once for every feed it happened to; the row opens their page, where Find new address, Write to and Unsubscribe already are.

*16 November 2026. The owner, looking at eight failing feeds: "Look at the giant wall of text. That's not good UX." Shown a now-vs-after picture of two ways (one row each, like the people list; or gathered by reason), he chose the second ("Show B locally"), tried it on his Mac and said ship it.*

**What changes.**
1. Each row was a sentence ("Nothing has come through since 24 Oct. The site
   says the feed isn't there any more. It may have moved. Jet Williams may
   not know.") and two or three underlined words (decision 0268). Eight
   failing feeds made 1,700px of text and 24 links on a phone. Now the
   reason is said once, over the feeds it happened to, and each feed is one
   line: about 650px for the same eight.
2. The reasons are a few plain words, never a code: "The feed isn't there
   any more", "The site doesn't answer", and so on (SPEC section 15). The
   reason whose feed has failed longest comes first.
3. What can be done moves to their page, which already had Find new address
   under their name (decision 0106), Write to for a person (decision 0212)
   and Unsubscribe in their settings. One line under the group says so:
   "Open one to find its new address, or to unsubscribe."
4. Gone with the row's actions: the person or publication icon before each
   name, "… may not know.", the row's own Undo and "Working again", and
   Write back's quiet in-a-row look (WriteBack's `quiet`).

**Why.** Clear at a glance: the eye reads a list of names, not paragraphs.
Less, but better: the page already had a home for each action, so the rows
needn't repeat them eight times. Cohesive: the rows are made as the people
below them are.

**What it costs.** Fixing one is a press further away (open their page,
then Find new address), and unsubscribing two (Settings, then Unsubscribe).
Choose… in the list below still unsubscribes many at once.
