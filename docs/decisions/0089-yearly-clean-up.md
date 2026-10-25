# 0089: The yearly clean-up runs after each night's backup

*25 October 2026. Milestone 6 of the plan for 100 to 200 readers ("Room to grow"): the one real limit is the disk, and keeping every article forever would fill it.*

**Decision.** Every night, right after the backup is safely stored, nine
turtles removes what's more than a year old (SPEC section 23):

- **Each reader's entries first.** An entry the reader hasn't starred, for
  an article received over a year ago, goes, read or not, muted or not.
  Another reader's star keeps the article for them only, so what one reader
  sees never depends on another (decision 0086).
- **Then the articles.** An article received over a year ago that no reader
  has any more goes, with its words in search. Its fingerprint stays in a
  small `forgotten_articles` table (structure change 15), so the publisher
  still listing it doesn't bring it back as new. The records of a feed go
  when nobody follows it any more.
- **Counted from arrival.** The year counts from when nine turtles first
  received the article, not its published date, so a blog added today keeps
  its old posts for a year.
- **Only after a backup.** It runs only just after a nightly copy was
  stored, so whatever it removes is in that copy, and in that month's copy
  for a year. While backups fail, or aren't set up, nothing is removed.
- **A little at a time:** 500 at once, each in a short transaction.

**Switched on, not a dry run.** Articles are counted from when nine turtles
received them, and nine turtles has only been fetching since October 2026,
so nothing qualifies until October 2027. Shipping it on costs nothing now
and means the disk is looked after without anyone remembering to switch it
on. Tests cover starred articles staying, other readers' stars, removed
articles not coming back, and article numbers never being reused.

**Why after the backup, not "if the latest backup succeeded".** Running in
the same step as a successful backup means there is never a gap between the
last copy and the removal, and needs no extra state. The earlier plan said
the feed health page would show a waiting clean-up; with many readers that
page is each reader's own, and backups are deliberately invisible in the app
(SPEC section 23), so a failing backup shows on `/status` instead, as it
already did.
