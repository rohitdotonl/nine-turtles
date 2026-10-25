# 0068: Other apps sync through the Google Reader API, with an app password

*25 October 2026. Asked for by the owner ("working with other apps").*

**Decision.** nine turtles offers the **Google Reader API**, the sync
language FreshRSS and Miniflux speak, at `/api/greader` (and
`/api/greader.php`, FreshRSS's address). Reeder, NetNewsWire and other
feed readers can then use nine turtles as their sync service: they see the
feeds, folders and articles, and read, unread and starred stay in step both
ways (SPEC section 26). Code: `server/src/greader.rs` and
`server/src/apps.rs`; no new library.

**What apps may change.** The owner chose (25 October 2026, asked first
because unfollowing deletes articles) that apps may do what they do with
FreshRSS: follow and unfollow feeds, rename them, file them in folders,
rename and delete folders. To keep the floor "nothing deletes without
undo" as close as an app allows, unfollowing from an app goes through
nine turtles' own hide-first step (decision 0020): the feed is hidden, and
cleared by background checking ten minutes later. Following it again from
an app in that time brings it back as Undo would, with its articles, read
marks and folders. An app's unfollow doesn't clear earlier unfollowed feeds
early (nine turtles' own Unsubscribe does, because its Undo only covers the
last action). "Mark all as read" from an app touches only articles that had
arrived when the app last looked (its `ts`).

**Signing in.** Apps never get the owner's password:

- **An app password**, made in Settings by a signed-in page: 24 letters and
  digits from 31 easy-to-type ones (about 119 bits), grouped in fours, shown
  once. The database keeps only its BLAKE2s scramble in the `settings`
  table, like a device's sign-in ticket (decision 0010): a password that
  can't be guessed doesn't need argon2's slowness. No structure change.
- Apps sign in with it (`ClientLogin`) and send it back as their token in an
  `Authorization: GoogleLogin auth=…` header with every request. Browsers
  never add that header on another website's behalf, so these requests
  can't be forged by a web page, and the sign-in cookie isn't accepted
  here. The app password opens nothing else.
- Wrong app passwords don't trigger the sign-in page's waits: guessing is
  hopeless anyway, and a shared wait would let a stranger lock the owner
  out of the web app. They're counted on the diagnostics page.
- **Make a new app password** replaces it (apps using the old one are
  signed out); **Turn off other apps** forgets it.

**Rejected.** The Fever API (older, md5 of the password, weaker). Letting
apps use the owner's own password (one leaked app would expose the web
sign-in). A table of per-app tokens (a structure change, for a choice the
owner doesn't need yet: one app password covers all their apps).
