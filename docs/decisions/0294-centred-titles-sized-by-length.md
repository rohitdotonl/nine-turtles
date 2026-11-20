# 0294: An article's title is centred and sized by its length; under it, "by" and the name lead, the day small and faint

**In one line:** An article's title is centred, as a book opens a chapter, and sized by its length (short titles large and tight, long ones smaller with looser lines); under it, centred, the writer's picture, "by {name}" in the reading face, and the day on its own line, small, in the list's faint grey.

> **Partly replaced by [0323](0323-byline-as-a-path.md) and [0325](0325-byline-on-two-lines.md):** the byline no longer shows "by": it reads the name alone, or the author on a line of their own with "*in* {feed}" under it.

*17 November 2026. The owner, reviewing the reading experience ("I'm unhappy with how titles look and feel"), chose from ten versions on his own Substack articles: a centred title (version 7) with the length fix first drawn for version 9, then, of ten byline versions, "by Name" in the reading font (5), with the date "even muter" (5c). "titles A, byline 5c … Ship it, merge it."*

**What changes.**
1. **The title** (SPEC section 7): centred, Literata's display cut at regular weight, balanced lines (decisions 0044, 0246 stay). Short (under 45 characters): 3.2 times the text, line height 1. Medium (under 85): 2.5 times, 1.08. Long: 2 times, 1.16. Chinese, Japanese and Korean characters count double, being about twice as wide. On a phone (up to 40rem): 2.5, 2 and 1.6 times. From 48rem up it reaches past the text column by up to 4rem on each side (never past the scroller's padding, so nothing scrolls sideways). Replaces decision 0246's single 1.9 times.
2. **The byline**: a centred column of the picture, then "by {feed}" ("by {author} in {feed}" when the feed names someone else) in the reading face at 15px (17px on a touch screen), the name in full ink and regular weight (semibold before), "by" and "in" in italic and the second ink; then the day ("Yesterday", "16 Oct", as before) on its own line at the date size (12px) in `--faint`, the list's own date grey; a short centred rule closes the block. The text starts 2em below.
3. **Right-to-left articles**: the title and byline are centred as in every language; the text still starts on the right (decision 0223).

**Why.** Size and space, not weight, make the title the first thing seen, which keeps the calm, bookish voice (bold reads as news). A single size made a 125-letter newsletter title fill a phone's first screen while a short one looked timid; sizing by length fixes both. Centring is what books do; balanced lines keep a long centred title from zigzagging. Under it, the name and the day sat on one line at nearly the same weight and grey, so the day competed with the name; the industry's way (NYT, Substack, Medium) puts the day smaller and greyer on a line of its own.

**Why the list's faint grey, not a new one.** The owner saw a lighter grey at the contrast floor (4.8 : 1); `--faint` (5.3 : 1 on White, the same as muted on Paper) is the grey the list already uses for dates, so the day looks the same everywhere and no new color is added. Lighter would fail WCAG AA; smaller than 12px gets hard to read.

**Cost.** The article's title no longer shares the text's left edge, and a person's page (decision 0219) now lines up with the article's text rather than its title. The numbers are tuned for Literata; Atkinson and the device's serif use the same steps.

**Revisit if** a common title length lands awkwardly between steps, or readers miss the day.
