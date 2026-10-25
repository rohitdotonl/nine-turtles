# 0064: "Time to read something beautiful.", capital keys in tooltips, and Keys

*25 October 2026. The owner chose the line and asked for the keys to match.*

**Why.** "No article open" was accurate but cold: the empty reading area is
the first thing seen each time, and it should invite deep reading, not
report a state. And tooltips printed keys as small letters ("Star (s)")
while menus and the shortcut list drew them as capitals on key caps (⇧A, S),
two looks for one thing.

**What changed.**

- The empty reading area's one quiet line now reads **"Time to read
  something beautiful."**, in the same muted serif, in the same place.
  Screen readers still hear "Choose one from the list" after it, so the
  state stays clear.
- Tooltips print their key as a capital, as the key caps do: "Star (S)",
  "Open original (V)". Keys that aren't letters (?, [, ], \, +, −, Esc)
  were already printed as they look.
- The sidebar's foot read "+ Add feed  Shortcuts  ⚙", and Add feed and
  Shortcuts ran together like one phrase. Each is now an icon and a word,
  "+ Add feed", "⌨ Keys", so the icons mark where one button ends and the
  next begins. "Keys" is short enough to fit beside Add feed at the
  narrowest default sidebar; screen readers hear "Keys (keyboard
  shortcuts)", and its tooltip still says "Keyboard shortcuts (?)".
- In the narrowest sidebar (200px), "Add feed" used to be clipped: the row
  was a few pixels too short for it beside two 44px buttons. Below 15rem
  the row now tightens its padding and lets the cog sit a little nearer the
  edge, so "Add feed" shows whole and every button stays 44px. A test
  checks it.
