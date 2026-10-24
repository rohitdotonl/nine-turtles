# 0046: Apple Books' six themes, by day and by night

*24 October 2026. Approved by the owner. Supersedes decision 0032 (the eleven
themes to try and prune) and the Automatic tile of decisions 0039 and 0045.*

**Why.** Eleven themes were a trial (decision 0032): too many to choose from,
and the light and dark ones were unrelated, so "following the device" could
only ever swap off-white for dark. Apple Books, slowfeed's design reference,
has six themes, each with a day and a night version, and a separate choice
of light, dark or matching the device. That keeps a reader's theme when the
evening comes, instead of swapping it for another.

**What changed.**

- **Six themes:** Original (the default), Quiet, Paper, Bold, Calm and
  Focus, each a day and a night version. Their colors, matched by eye to
  Apple Books' themes, are in DESIGN.md → "Color".
- **Appearance:** Light, Dark or Match device (the default), a segmented
  control in Settings › Look and feel and in the Aa panel. Match device
  follows the device's light or dark setting and switches with it while
  slowfeed is open. The theme tiles are drawn in the version showing now;
  the half-and-half Automatic tile is gone.
- **Bold** also sets the article text heavier: Literata's 600 or Atkinson
  Hyperlegible's 700, the weights slowfeed already ships. Only the article
  text (and Settings' sample of it), never the interface. No new fonts.
  The trade-off: slowfeed ships nothing heavier, so in Bold a publisher's
  bold words and small headings look the same weight as the text around
  them (italics still show). A heavier Literata face would fix it, but a new
  font file needs the owner's approval; until then, Bold is for comfort, and
  the other five themes show emphasis as the publisher set it.
- **How it works:** `<html>` carries `data-theme` (the theme) and `data-mode`
  (light or dark, resolved from Appearance). Before the script runs there are
  neither, and the page is Original, by day or by night as the device is set.
- **To keep every check passing,** a few derived values differ from the
  rules: Quiet, Paper and Calm by night mix 9%, 10% and 10% of the text color
  into the selection pill (not 12%) and lay a fainter search tone over it
  (6%, 8%, 8%, not 12%); eight muted greys are a shade further from the paper
  than matched by eye (by day Original `#5F5F64`, Quiet `#525256`, Paper
  `#5A5850`, Calm `#5A4B3A`; by night Original `#A4A4A8`, Quiet `#B5B5BA`,
  Paper `#B4B2A8`, Focus `#B0A993`); and Quiet by night's red is `#EA988C`.

**Nobody loses their choice.** A theme saved on a device before this change
becomes the nearest new one:

| Before | Now |
|---|---|
| Automatic | Original, Match device (the new default, as in Apple Books, rather than the nearest look) |
| Off-white, Linen | Paper, Light |
| Porcelain | Original, Light |
| Mist | Quiet, Light |
| Sage | Focus, Light |
| Sepia | Calm, Light |
| Dark, Night | Calm, Dark |
| Graphite | Quiet, Dark |
| Midnight | Original, Dark |
| Black | Bold, Dark |
