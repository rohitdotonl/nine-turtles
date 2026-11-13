# 0265: One line after Write back

**In one line:** After Write back (or Write to) is pressed on a computer, the line under it is one line, "Opening your email app…", ending in two quiet words, "Didn't open?", which show Write in Gmail, Write in Outlook.com and Copy their address only when pressed; a phone, with one way, keeps it in view. Revisit if readers whose email lives in a browser stop finding Gmail.

*14 November 2026. The owner's choice from a now-and-suggested picture, in a design critique of the whole app ("3, 5, and 6: Implement them").*

**What was wrong.** Pressing Write back on a computer added a question and
three bold links under the button ("Nothing opened, or the wrong app?",
Write in Gmail, Write in Outlook.com, Copy their address), every time,
though for most presses the email app simply opens. The place meant for
one calm act, writing back, ended in four things to read.

**Decision.**
- **A computer:** one line, "Opening your email app…", then **Didn't
  open?** as a quiet underlined link in the second ink, as Change is beside
  the address. Pressed, the three ways show on a line under it, as plain
  underlined links; pressed again, they go. It says to screen readers
  whether it's open, and the keyboard stays on it. With Gmail or
  Outlook.com chosen, the words are "Wrong place?" and work the same way.
  Each new press of Write back starts with the one line again.
- **The floating note** (Write back started while its line is off screen:
  the paper plane, `w`) does the same: "Opening your email app…" with
  Didn't open? and a ×; pressed, the note says "Didn't open?" with the
  three ways, and the keyboard goes to the first of them.
- **A touch screen** is unchanged: its email app always answers, so it has
  one way, Copy their address, which stays in view under "Nothing opened?".
- **A bug found on the way:** the line was drawn in the reading serif, 64px
  under the address. Its style's name, `.opening`, was also the name of the
  app's first line ("Opening your reading…", decision 0260), whose look
  leaked onto it. It has its own name now and is drawn as DESIGN.md always
  said: small, in the interface face, straight under the address.

**Why.** Power is findable, never in the way (principle 9): the ways out
are for the press that didn't work, so they wait behind the words a reader
in that spot is already thinking. Less, but better (principle 10).

**Changes.** Decisions 0229 and 0259, which showed the ways at once. What
they do is unchanged: the choice of Gmail or Outlook.com is still kept on
the device, "Opens Gmail in a new tab." with Use your email app still shows
under the address while one is chosen, and nine turtles still never sends
or sees the email.
