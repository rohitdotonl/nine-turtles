# 0289: An article's byline opens the writer's list; their page is a press on

**In one line:** The writer's name under an article's title opens their list (what they've written lately), with "‹ Article" back to the article on a phone and a computer; their picture leads their name at the top of that list, the way on to their page; and an article's More menu gains "Info about {name}".

*16 November 2026. The owner: "I am reading an article from Mandy… I want to read what Mandy's been writing lately. I click on Mandy's name, and her profile appears rather than her articles." Chose from ten mockups, then from ten ways to make the list's title read as the way to their page.*

**What changes.**
1. **The byline's name opens their list** (SPEC section 7), not their page
   (decision 0214's link). Its tooltip says "Everything by {name}".
2. **"‹ Article"** heads their list while it was opened that way: in the
   phone's top bar, where "‹ Home" is, and on a computer above their name,
   where an article's "‹ Unread" stands. It's a step back in history, which
   opens the article where it was (decision 0233), or, when that step isn't
   there, the article again. It lasts while the reader stays with them (their
   list, their page, their settings) and ends anywhere else
   (`navigation.ts`, `listFromOnMove`).
3. **Their picture before their name at the top of their list** (SPEC
   section 36): the byline's circle (40px, 32px on a phone, decision 0285),
   inside the "Alpha ›" button, so the face and name together read as the way
   to who they are. Their site's icon may now load when their list opens, as
   it already did for their article and page.
4. **"Info about {name}"** in an open article's More menu, apart from the
   rest with Hide articles about…, with its key `i` (decision 0214); for
   someone followed only.

**Why.** The writer comes first, and clear at a glance: the commonest wish
after reading someone is more of them, and their list is that. Putting their
newest pieces on their page instead would repeat their list, which their
page is opened from (decision 0215). Their page stays one press on, and
named the same way everywhere ("Info about", the `i` key's word).

**Not changed.** Someone no longer followed (an article kept in Saved): their
name still opens their own website, as nine turtles has no list or page of
theirs. Their page's close still goes back where it was opened from
(decision 0284).
