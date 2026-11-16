# 0284: Their page closes back where it was opened from

**In one line:** Closing someone's page (×, Escape, ‹ on a phone) goes back where it was opened from: Everyone you follow (keyboard on their line, and Unsubscribe lands there too, with Undo) or the article whose byline opened it; opened any other way, to their list, as before.

*16 November 2026. The owner, fixing feeds that weren't working: "Clicked on Unsubscribe and then instead of Everyone you follow, the app landed me on Unread." Asked to check every flow, then chose "Back to the article" for their page opened from an article.*

**What changes.**
1. Their page remembers where it was opened from (`navigation.ts`, `WhoFrom`):
   Everyone you follow, an open article, or anywhere else. It keeps it
   through their settings and back, and, for Everyone you follow, through
   Hide articles about them and back.
2. Close goes there. To an article it's a step back in the browser's
   history, which opens the article again where it was (decision 0233);
   after Hide articles there's no such step, so it goes to their list.
3. Unsubscribe from a page opened from Everyone you follow lands on
   Everyone you follow, its line ("Unsubscribed from …") first on the page,
   above who isn't working, with the keyboard on Undo. Opened any other
   way, Unread, as before: the article and their list are gone with them.
4. Who isn't working, once opened, stays open for the visit, and the
   keyboard goes back to the line of the one just closed.

**Why.** Forgiving and cohesive: going back returns you to your place, as
Settings' own pages already do (decision 0120). Fixing broken feeds one
after another no longer means finding the list again each time.
