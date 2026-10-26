# 0098: Bringing stars over from other feed readers

*26 October 2026. Asked for by the owner ("Bringing your stars over from
other services"), with merging approved.*

## Decision

- **Where:** Settings › Your data › **Import starred articles…**, beside
  Export starred articles. It opens the device's file chooser, like Import
  OPML, and says plainly what it did.
- **What it reads:** the JSON file feed readers export starred articles in.
  The Google Reader format (Inoreader, Feedly, The Old Reader, FreshRSS,
  BazQux and others), JSON Feed (so nine turtles' own export comes back
  whole), and flat lists of articles (as Feedbin's is). At most 10,000
  articles or 25 MB a file, and 10,000 imported articles (50 MB of text) per
  reader in all, since every reader shares one disk.
- **Pocket is left out:** it saves whole web pages, not what a feed sent,
  and nine turtles shows only what a feed contains (the publisher floor).
- **Every star keeps its original link;** an article without one isn't
  brought over, and the summary says how many.
- **Already here:** an article nine turtles already stores from the feed the
  file names gets the star, so the reader stars the publisher's own copy.
- **Not here:** the article is kept as the file has it, cleaned like any
  feed's text, in a feed of the reader's own (`imported:<reader>:<feed>`).
  Never in the shared feed: otherwise one reader's file could put words in
  another reader's lists as if the publisher had sent them (decision 0086's
  walls). That feed is never fetched and is hidden, like a feed unsubscribed
  from whose starred articles stay, so the reader's sidebar doesn't change
  and the stars show in Starred and search.
- **Read, and only added:** imported stars arrive read, so Unread doesn't
  fill up. Importing never unstars, removes or changes anything already
  there, so it needs no Undo; the same file twice stars nothing new.
- **No structure change:** it uses the tables as they are, so no backup
  before an update is needed, and nothing in the live data changes until a
  reader imports a file. The nightly backups hold what an import added.

## Considered

- **Fetching each article's page** for the text when a file has none: no,
  never fetch an article's web page.
- **Following the feeds the stars came from:** no, the reader chose what to
  follow; an OPML import does that.
- **Putting stars of unfollowed feeds in one "Imported" feed:** kept only
  for articles whose file names no feed; otherwise each keeps its feed's
  name (by its address, or by its name when the file gives no address), so
  the credit travels with it.
