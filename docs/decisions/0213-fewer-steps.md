# 0213: Fewer steps for what readers do most

*8 November 2026.*

**Decision.** Four everyday actions take fewer steps:

1. **The writer's name under an article's title opens the page about them**
   (SPEC sections 7 and 36), as their name at the top of their list does,
   for anyone followed. It was a link to their website, which their page
   and View original still reach. It carries no "›", unlike the list's
   title, because the byline's "·" follows it; it is underlined on hover
   and 44px tall to touch. **`i`** works from any list too: where the list
   isn't theirs (a folder, Unread, search results), it opens the chosen
   article's writer's page.
2. **Write back is a paper plane beside Star** in the article's top bar (on
   a phone, in the bottom toolbar, which then has six even places), for a
   person only, never a publication (decision 0192). It leaves the More
   menu. Writing back is the reason to follow a person, so it shouldn't
   take a scroll to the end or a menu.
3. **A row's own menu** in the article list (SPEC section 6): a right-click,
   a long press (half a second) on a touch screen, or the Menu key or
   Shift+F10 opens a small menu where it was pressed: Star or Unstar, Mark
   as read or unread (not with Unread off), then Write back (which opens
   the article and starts it) and Info about {name}. It is More's menu
   (the same look and keys, now one piece, `MenuList.svelte`), with no keys
   printed, since each action has its key elsewhere. Opening it chooses
   nothing; each mark has its Undo.
4. **Mark all as read waits at the end of a list** that still has unread
   articles, under "That's everything.", an everyday bordered button, where
   the reader has just finished. Not after search results or with Unread
   off. It does what More's Mark all as read does, with Undo.

The owner asked for all four on 8 November 2026 ("Implement all. Ship and
merge"), from the "fewer steps" audit's real-size mockups. One change from
the mockup: the byline name opens their page in the app rather than their
website.

**Why.** The audit ranked the app's frequent actions by how often they
happen times how many steps they take; these four were the top ones left
after decision 0212 fixed search's dead end. Each keeps its old way too:
nothing moved out of reach except Write back from More, now one press away
instead.

**Changes.** SPEC sections 6, 7, 19, 20, 36 and 37; DESIGN.md Part 2
(toolbars, the byline); the help pages on writing back, marking read,
starring, finding your way around, keys, and a person's page.
