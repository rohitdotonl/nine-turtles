# 0046: A quiet article title and an even phone toolbar

*24 October 2026. From the fifth Apple Books critique
(`ui-polish/critic-applebooks-5.md` in the project files, items 1, 2 and 3,
batches 1, 5 and 8 of its "Path to 10"), under the owner's goal that Apple
Books is the only standard. Changes part of decision 0038 (the title's
tighter tracking) and the hidden Previous arrow on a phone.*

**Why.** Three things in the reading view still looked unlike a book:

- Opening an article with the keyboard drew a 2px ring round its title. The
  keyboard's place moves to the title on purpose, so screen readers start
  reading there, but the ring was the loudest mark on the page, and a title
  can't be pressed. Apple Books moves you to the text with no outline.
- The byline sat 12px under a 32px title, and the title was tracked in
  enough that some letters nearly touched.
- On a phone, the first article's toolbar had a hole at its left: Previous
  kept its place but hid its arrow, so the bar looked lopsided.

**What changed.**

- **No ring on the article title.** The title still takes the keyboard's
  place when an article opens (screen readers start there), but draws no
  outline, as a sheet's title already doesn't (decision 0042). The next Tab
  lands on the byline's publisher link or the first link in the text, which
  rings as always. Every real control keeps its ring; other screens' titles
  are unchanged.
- **A pause before the byline.** The title now has five-eighths of its own
  size below it (20px at the default text size, a little less on a phone),
  so the pause keeps its proportion at every text size. Its tracking goes
  from −0.012em to −0.005em.
- **No hole in the phone toolbar.** Previous on the first article (and Next
  on the last) keeps its arrow in place, faded to 35%, and does nothing.
  Only the arrow fades, so a keyboard ring on it stays solid. It's still
  marked `aria-disabled`, so screen readers hear it as dimmed; a control
  that can't be used is exempt from the contrast floor (WCAG 1.4.11), and
  its state is in its name and behaviour, never colour alone.

**Not chosen.** Laying the toolbar out with only the usable buttons sharing
its width would move Aa, Star and More between the first and second
article. Nothing moves unless you move it, so each keeps its place.

**How to check it.** Open an article with Enter: the title has no box round
it; press Tab and the publisher's name rings. On a phone, open the first
article in a list: five icons sit evenly along the bottom, Previous faded.
