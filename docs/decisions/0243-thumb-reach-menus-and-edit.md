# 0243: Thumb reach: menus read from the button outwards, and Edit finishes as Add does

**In one line:** Thumb reach: a menu that opens upwards on a phone draws its first item nearest the button (the article's More: Share or Copy link nearest, Hide articles about… furthest); Edit for a person or publication finishes as Add does on a phone, an X in Cancel's place and Done the full width at the screen's foot

*10 November 2026.*

Rohit's "Implement 1 and 4" (10 November 2026), for the fresh thumb-reach
critique (`critique-24/thumb-reach-2.html`, in the project's files, where
they're called A2 and A4), with his answer "along the bottom, like Add" to
where every sheet's main button goes.

**Decision.**

- **Menus read from the button outwards** (A2): a menu that opens upwards,
  from the phone's bottom bar, draws its first item nearest the button,
  where the finger already is. The article's More (…) on a phone now has
  Share (or Copy link) just above the button, then Mark unread, Add a note
  and, furthest away, Hide articles about…, which also keeps the item that
  removes things apart from the everyday ones (principle 4, forgiving).
  The rows are drawn in that order for screen readers and the arrow keys
  too, and opening the menu puts the keyboard on the nearest one. A
  computer's menus drop down from their button and keep their order, which
  is already first item nearest. Built once, in `MoreMenu.svelte`, for any
  menu that opens upwards.
- **Edit finishes as Add does** (A4): on a phone, Edit for a person or
  publication has an X at the right of its title line in place of Cancel
  and Done, and Done the full width at the screen's foot, under
  Unsubscribe, staying in view while the form scrolls: the build of + Add
  and Edit folder (DESIGN.md → "One phone sheet"). The X stands for Cancel,
  as on a phone's Edit folder (decision 0235): it throws unsaved changes
  away; Escape and Back still keep them. A source's own settings, opened
  from Edit with ›, keep their "‹ Edit …" and have Done at the foot too,
  so the two screens of editing someone finish in the same place. A
  computer keeps Cancel and Done beside the title. Edit stays their page
  turned into settings, so its title and × scroll with the form rather
  than sitting in a top line that never scrolls as Add's does; the page
  keeps room at its foot so a field the keyboard reaches is never hidden
  behind Done.

**Not done.** A1 (a bottom bar for a list's Search and •••, Rohit chose to
keep them in the title line), A3 (Edit and Choose… always at the top
right) and cutting Previous from the article's toolbar weren't asked for.

**Why.** On a phone the bottom of the screen is where a thumb rests, and
the app already finished its most-used sheet, Add, there. The article's
menu opened upwards but still started at the top, so its most-used item
was the furthest, and Edit was the one sheet finishing in the top corner.
The order inside the menu changes what a reader may have learned, which
DESIGN.md's "Never" list holds back only once the look settles; it hasn't
yet, and Rohit chose it.
