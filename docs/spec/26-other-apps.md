# 26. Other apps: syncing with Reeder and NetNewsWire

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

*Added 25 October 2026 at the owner's request (decision 0070).*

**What it does**
- Other feed readers, such as Reeder and NetNewsWire, can use nine turtles as their sync service, through the "Google Reader API" that FreshRSS and Miniflux also offer. In the app, the owner adds a **FreshRSS** (or **Google Reader API**) account, with the server address shown in Settings (`https://app.nineturtles.app/api/greader`) and the app password; any username works. `/api/greader.php` answers too, for apps that expect FreshRSS's address.
- **What syncs, both ways:** feeds, folders and articles (with the text the feed carried, the link to the original and the feed's name); read and unread; starred. The app can also follow and unfollow feeds, rename them, put them in folders and take them out, and rename or delete folders (deleting a folder never unfollows its feeds, and from an app it has no Undo: only the grouping goes, never an article).
- **Unfollowing from an app** works as it does here: the feed is hidden at once and its unstarred articles are cleared ten minutes later. Following the same feed again from an app within those ten minutes brings it back as it was, with its articles, read marks and folders. Unlike unfollowing in nine turtles, unfollowing a second feed from an app doesn't cut the first one's ten minutes short; unsubscribing on nine turtles' own page does, as it always has (its Undo covers only the last action), so a feed an app unfollowed for you is then cleared at once (another reader's are never cleared early). A hidden feed is out of every list in the app too.
- **"Mark all as read" from an app** marks only articles that had arrived when the app last looked, never ones that arrived since, as nine turtles' own does.
- **Settings › Other apps:** **Make an app password** (ending in +) makes a 24-letter password in groups of four (`abcd-efgh-…`; no 0, 1, i, l or o) and shows it with the server address, each with a **Copy** button. The password is shown only this once; nine turtles keeps only a scrambled copy. Then **Make a new app password** (which signs out any app using the old one) and **Turn off other apps** (which signs every app out; feeds and articles are unchanged). The line under the group says what it's for and how to use it.
- The app password opens only the sync API, never nine turtles' own pages, and the owner's own password never works in an app.
- Following a feed from an app counts towards the 1,000 feeds one reader can follow (decision 0090); past it, the app is refused. Syncing counts as being here, so the feeds of a reader who reads only in another app never rest (section 11).

**How to check it**
1. In Settings › Other apps, press **Make an app password**: the address and password appear, each with Copy.
2. In NetNewsWire (Mac or iPhone), add a FreshRSS account with that address and password: your feeds and folders appear. Star an article there; refresh nine turtles: it's starred here too. Mark one read here; refresh NetNewsWire: it's read there.
3. Press **Turn off other apps**: NetNewsWire can no longer sync and asks you to sign in again.
