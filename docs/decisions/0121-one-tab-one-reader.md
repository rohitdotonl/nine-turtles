# 0121: One tab, one reader

*27 October 2026.*

**Decision.** Every request from a tab of the web app says which reader the
tab was opened for (`x-nine-turtles-reader`). If the browser's sign-in
cookie now belongs to someone else (another reader signed in on this
browser, often by an emailed link, while the tab stayed open), nine turtles
refuses the request (409, `x-nine-turtles-other-reader`) and the tab reloads
as the new reader, which first forgets the last reader's things on the
device.

**Why.** Decision 0086 walls each reader's things off from the others, and
the fix in #137 made a newly loaded page forget the last reader's device
data. A tab already open still held the last reader's waiting marks in
memory, and sent them with the new reader's cookie when it came back online:
the new reader got the last one's stars. Only the server can refuse those
reliably; a message between tabs alone would miss a tab that was asleep or
offline.

**Rejected.** Listening for the device's reader changing in another tab
(`storage` events): it misses a tab that comes back online before another
tab loads. Showing a "Reload to continue" note instead of reloading: the
tab's screen belongs to someone who is no longer signed in, so reloading at
once is the safer and calmer choice.
