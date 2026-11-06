# 0188: No Refresh on the phone's feeds screen

*6 November 2026.*

**Decision.** The Refresh icon beside the wordmark on the phone's feeds
screen goes (the owner's simplify review, point 10). Its only job was to
update that screen's unread dots, so the dots now catch up by themselves
each time the reader arrives on the screen: coming back from a list, or
coming back to the app (the page becoming visible again). They change only
as the screen appears, then stay still while it's looked at, so "the view
waits for you" (SPEC section 13) still holds. A failure while catching up
says nothing and keeps the dots as they were (`Library.catchUp`), since
the reader didn't ask for anything.

**Why.** A button in the top corner invites pulling for something new, which
"nothing pulls" rules out, and it was a third way to refresh beside the
list's More menu and the "New articles · Show" note. The wordmark now stands
alone at the top.

**Not changed.** `r`, More › Refresh and the note's Show stay as they were.
How often feeds are checked is unchanged (SPEC section 11).
