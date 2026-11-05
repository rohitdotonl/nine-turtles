# 40. Help (on the website)

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.
Decision 0157.*

**What it does**
- **Help lives at nineturtles.app/help,** for readers only: short answers to
  "how do I…", one page each, in plain words. The owner's manual (ror)
  links to it and never copies it.
- **The index** says "Short answers to "how do I…", one page each. If what
  you need isn't here, write to me and I'll add it.", then "New to feeds?
  Start with this three-minute page." Then five groups, each a heading and a
  plain list of links (a hairline between rows, each row 48px tall): Getting
  started, Reading, Keeping things tidy, Bringing more in, You and your
  account. A page's place in its group is its `order`. Getting started ends
  with **Questions people ask** (what nine turtles does and doesn't do; the
  website's old Questions page, decision 0166).
- **A page:** "Help › its group" above the title (both links), the title as
  a reader asks it ("Find out why someone stopped updating"), "Last updated"
  and the date, a lede a step larger, then steps and short sections, "Good
  to know", "Related:" with two or three other pages, and "Something here
  not right, or not what you needed? Tell me and I'll fix it." Buttons and
  places are named in bold, exactly as the app names them; keys are drawn as
  keys. No screenshots.
- **Where it's linked from:** the website's top (Help, Open the app) and its
  footer; the foot of Settings ("Help", opening a new
  tab); the keyboard shortcuts sheet's foot ("Help", to the keys page).
- **Old addresses** send readers on (`website/src/_data/redirects.json`):
  `/docs` and the old tour (`/tour`) to `/help`, the old Questions (`/faq`)
  to Questions people ask.
- **Each page names the SPEC section it explains** in its front matter
  (`spec`). Changing what a reader sees means changing its Help page too, in
  the same pull request.

**How to check it**
1. Open nineturtles.app/help: five groups, every link opens its page.
2. Open any page: the "Help › group" links go back to the index and to that
   group's heading; Related links open other Help pages.
3. In the app, open Settings and scroll to the foot: **Help** opens the
   index in a new tab. Press `?`: **Help** at the sheet's foot opens "Every
   keyboard key".
4. Open nineturtles.app/docs and nineturtles.app/tour: each lands on Help;
   nineturtles.app/faq lands on Questions people ask.
