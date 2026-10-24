# 0057: A plain grey pill for where you are, and green stars

*24 October 2026. The owner's request: small touches of color, as GitHub
uses them (a screenshot of GitHub's tabs and sidebar), tried side by side
on the owner's own computer. Changes 0037 (the pill filled with the accent)
and 0043 (the place's icon in the accent), and 0041's night pill.*

**Why.** GitHub's pages are mostly grey and black, with a few small marks of
color, each with one job. The owner tried a blue bar beside the place you're
on, as GitHub draws it, and a gold star, then chose: no color for where you
are, and a light green for starred articles.

**What changed.**

- **Where you are.** The pill behind the place you're on (in the sidebar
  and in the article list) is a neutral grey: the text color mixed into the
  pane, 8% by day and 12% by night. No bar, no tint. The place's icon in the
  sidebar is in full ink, not the accent; the name stays semibold.
- **Unread** keeps its dot in the accent, and search matches keep their
  faint accent tone. Those are now the accent's only jobs.
- **Starred** gets a second color, a light green: `#2A8A43` by day,
  `#56D364` by night. It colors only a filled star: the star after a
  starred article's time, the article's star button while it's starred, and
  the Starred icon in the sidebar while you're there. The automatic checks
  hold it to 3 : 1 on every area it can sit on, which is why the day green
  can't be lighter. Red was never an option: in nine turtles red means
  "this deletes something".
- **Never color alone.** The pill is a shape, the place's name is semibold,
  and a star is filled; the green only makes a star quicker to spot.
  Buttons, links and keyboard outlines stay in the text colors.
