# 0117: Delete my data

*27 October 2026, at the owner's request ("Add a delete my data. And delete
my account buttons too."). The owner chose one "Are you sure?" with the
downloads offered first and no undo, on a decision card.*

**Decision.** Every reader, the owner too, can empty their account from
Settings › Account › **Delete data…**, keeping the account itself.

- **What goes:** feeds (each let go as unsubscribing lets it go, so a feed
  nobody else follows stops being checked and its articles nobody has go),
  folders, read history, stars, collections, saved searches, rules, episode
  progress and Up Next.
- **What stays:** email and password, passkeys, app password, connected
  assistants, settings, plan and the newsletter address. The reader stays
  signed in. A newsletter they still followed starts its feed again when
  its next email arrives; one they had stopped stays stopped.
- **How:** the same one "Are you sure?" sheet as Delete account (decision
  0088): it says what goes, offers Export OPML, Export starred articles and
  Export collections first, then Delete data. No undo; the nightly backups
  still hold it. This device's saved copies go too, and the app opens again,
  empty.
- **Code:** `people::delete_data` shares `people::let_go` with
  `people::delete`, emptying only `people::DATA_TABLES`; every per-reader
  table is in exactly one of `DATA_TABLES` and `ACCOUNT_TABLES`, checked by
  a test. The route is
  `POST /api/people/me/data/delete`. No password is asked for, as with
  deleting an account.
- **Delete account** already existed for every reader but the owner
  (decision 0088); it now offers Export collections too. The owner still
  can't delete their own account: nine turtles needs its owner.
