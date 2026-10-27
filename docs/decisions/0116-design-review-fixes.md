# 0116: Fixes from a design review

*27 October 2026.*

**Decision.** The owner approved a batch of small fixes from a design
review. Most are wording or layout and live in `docs/SPEC.md` and
`docs/DESIGN.md` Part 2; these are the ones that change a rule, a check or
what the server sends.

1. **A segmented control's chosen side is held to 3 : 1** against the rest
   of the control (WCAG 1.4.11, non-text contrast; part of the first floor).
   Before, the chosen tile was only a lighter fill with a small shadow,
   about 1.1 : 1 by day. Now, by day, it keeps the page's tone and gains a
   thin 1px edge of the text color at 60%; by night it is filled with the
   text color at 65%, its words in the page's color (`--chosen`,
   `--chosen-ink`, `--chosen-edge` in `app.css`). A night fill light enough
   for 3 : 1 against the track can't also keep light words at 4.5 : 1 in
   Original, so by night the words turn dark, as the switch's track does
   when it's on (decision 0077). `contrast.test.ts` now checks the edge (by
   day) and the fill and its words (by night) against the control's track
   on every surface a control sits on, in every theme. The unused
   `--raised` color it replaced is gone.
2. **No title draws a focus ring,** even after a key. Decision 0042 kept a
   ring on a title the keyboard was moved to (a list's or Settings' title
   after `g` then `a`, say), except a sheet's, the shortcut list's and an
   opened article's (0047). A title can't be pressed, and the ring made it
   look like a button; now every one is like those exceptions. The next Tab
   still lands on a real control, which rings as always.
3. **The keyboard starts on the list's title** when the app opens, not the
   sidebar's wordmark (decision 0041), so screen readers begin with what
   there is to read. On a phone's feeds screen, which has no list, it still
   starts on the wordmark.
4. **"Skip to articles"** is the first Tab stop while a list of articles
   shows, a standard skip link: hidden until the keyboard reaches it.
5. **Recently read sends when each article was opened.** Each row of
   `GET /api/articles?view=recent` now has `opened` (seconds since 1970),
   read from `entries.opened_at`, which structure change 22 already keeps.
   No structure change, so no backup step is needed. Other lists don't send
   it (`#[sqlx(default)]`, left out when empty). The screen groups the list
   under day headings by the device's own calendar, worked out once when
   the list loads so they never change while it's on screen.
6. **The list beside the article is never narrower than 280px,** and 352px
   by default below 1280px wide (it was 320px, and could be dragged to
   260px), so feed names and titles have room on a window about 1024px wide.

**Why.** Each came out of a design review the owner accepted. Items 1 and 2
are accessibility: the floor asks for 3 : 1 on a control's states, and a
ring on something that can't be pressed misleads.

**Revisit if** Apple Books' own segmented controls change in a way that
meets 3 : 1 more quietly, or if readers find the night fill too strong.
