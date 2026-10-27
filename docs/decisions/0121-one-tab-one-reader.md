# 0121: One tab, one reader

*27 October 2026.*

**Decision.** Every request from a tab of the web app says which reader the
tab was opened for (`x-nine-turtles-reader`). If the browser's sign-in
cookie now belongs to someone else (another reader signed in on this
browser, often by an emailed link, while the tab stayed open), nine turtles
refuses the request (409, `x-nine-turtles-other-reader`), and the tab's list
says "Someone else signed in on this browser. Reload to continue." with
Reload. Marks waiting on the device carry the reader whose tab made them,
and a tab sends only its own reader's.

**Why.** Decision 0086 walls each reader's things off from the others, and
the fix in #137 made a newly loaded page forget the last reader's device
data. A tab already open still held the last reader's waiting marks, and
sent them with the new reader's cookie when it came back online: the new
reader got the last one's stars. The same marks could also wait in the
device's shared store and be sent by the new reader's tab. Only the server
can refuse the first reliably, and only a mark that knows its reader can
stop the second.

**Rejected.** Listening for the device's reader changing in another tab
(`storage` events) alone: it misses a tab that comes back online before
another tab loads. Reloading the tab by itself: nothing moves unless the
reader moves it (DESIGN.md principle 5), so the tab says what happened and
offers Reload, as it does when nine turtles was updated.
