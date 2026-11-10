# 0157: Help pages for readers, at nineturtles.app/help

**In one line:** Help pages for readers at nineturtles.app/help: one page per question in five groups, steps in the app's own words, no screenshots, each naming its SPEC section; linked from the website, Settings and the keys sheet; `/docs` leads there

*3 November 2026. Planned with the owner on 27 October 2026 (the mockup
"Plan help docs for readers"); on 3 November he chose that Help is for
readers only and his own manual (ror) links to it instead of copying it,
and said to start once V1 was finished.*

**Decision.**

- **Where:** on the website, at `nineturtles.app/help`: one Markdown file
  per page in `website/src/help/`, a Help layout (`help.njk`) and the index
  (`help.njk` at the top of `src/`). No second site, no subdomain, nothing
  inside the app. `/docs` sends readers on to `/help`.
- **Named Help,** not Docs. The index is a book's table of contents, five
  groups of plain links (Getting started, Reading, Keeping things tidy,
  Bringing more in, You and your account), with "New to feeds?" on top.
- **Each page:** where it sits (Help › its group, both links), its title as
  a reader would ask it, "Last updated", a short lede, numbered steps with
  buttons named in bold as the app names them, "Good to know", then Related
  pages and a line to write to Rohit. No screenshots: they go stale, and
  words carry to a screen reader. Keys are drawn as keys.
- **Voice:** "you" for the reader; "I" when Rohit speaks (write to me),
  never "we" (BRAND.md). The app's own words, exactly: People, folders,
  Edit person, Add feed.
- **Links in:** the website's band and footer, the foot of Settings, and
  the keyboard shortcuts sheet (to the keys page).
- **Kept true:** each page's front matter names the SPEC section it
  explains (`spec`); a change the reader can see updates its Help page in
  the same pull request (AGENTS.md → "Keeping the docs true"), and its
  "Last updated" date.

**Why.** The website already has the look, the checks and the hosting, so
Help costs nothing new. One page per question is what readers search for
(Apple's Books guide, Things' support pages, Feedbin's help). Help says
how; SPEC says what and why for agents; ror says what's behind it for the
owner. None copies another.

**What a later change would revisit.** "Publications" for the things that
aren't people is decided but not built: when it is, the pages that say
"people" for a site or a channel change with it.
