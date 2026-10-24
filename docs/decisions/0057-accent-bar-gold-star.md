# 0057: An accent bar beside a grey pill, and gold stars

*24 October 2026. The owner's request: small touches of color, as GitHub
uses them (a screenshot of GitHub's tabs and sidebar). Changes 0037 (the
pill filled with the accent) and its "one accent" rule, and 0041's night
pill.*

**Why.** GitHub's pages are mostly grey and black, with a few small marks of
color, each with one job: a short blue bar beside the item you're on, an
orange line under the current tab. The owner wanted nine turtles to feel
that way: alive, but calm.

**What changed.**

- **Where you are.** The pill behind the place you're on (in the sidebar
  and in the article list) is now a neutral grey: the text color mixed into
  the pane, 8% by day and 12% by night. Beside it, 2px from the pane's edge,
  sits a short bar in the accent (ink blue), 4px wide with round ends. In
  high-contrast mode the bar takes the system's highlight color.
- **Unread** keeps its dot in the same accent, so the blue means "yours to
  look at" in one family, as before.
- **Starred** gets a second color, a warm gold: `#9A6700` by day, `#D29922`
  by night (GitHub's own "attention" golds). It colors only a filled star:
  the star after a starred article's time, the article's star button while
  it's starred, and the Starred icon in the sidebar while you're there.
  The automatic checks hold it to 3 : 1 on every area it can sit on.
- **Never color alone.** The bar and the pill are shapes, the place's name is
  semibold, and a star is filled; color only makes them quicker to spot.
  Buttons, links and keyboard outlines stay in the text colors.
