# 0077: Rules and mutes

*25 October 2026. Asked for by the owner ("implement Rules and mutes"), as agreed in the planning thread the same day.*

**Decision.** The reader can write rules: "when a new article matches this,
do that" (SPEC section 27). A rule looks for a word or phrase (in the title,
or in the title or the text), an author, or both, in all feeds, one folder
or one feed, and **mutes**, **stars** or **marks as read** what matches.

- **Only what's in the feed and what the reader wrote.** Words are matched
  whole, whatever their capitals (the article's text as plain words, never
  its HTML), so a rule never surprises: no guessing, no scoring, no
  ranking. That keeps it clear of DESIGN.md's "Never: algorithmic ranking".
- **Muting hides, never deletes.** A muted article is kept with `muted = 1`
  and also marked read, so every unread count, the Unread list and other
  feed readers (section 26) already leave it out without new rules of
  their own. All, a feed's and a folder's lists leave it out too; Starred
  and search still show it, search saying "· Muted". Settings › Rules ›
  Muted articles lists them with Unmute. Marking a muted article unread (here
  or in another app) unmutes it, so a mark is never silently swallowed.
- **Rules act on arrival.** `feeds::store_articles` hands the articles it
  just numbered to `rules::apply_to_new`, so every way an article arrives
  (a check, WebSub, a new feed, an app) goes through the rules. An article a
  publisher edits later is not checked again.
- **What's already here is touched only when asked.** A new rule answers how
  many unread articles already match; Settings asks once, with that number,
  and Undo reverses exactly the articles it changed.
- **Nothing is lost without Undo.** Deleting a rule has Undo (the screen
  makes it again). A rule whose feed or folder goes stays, paused in effect
  and saying so ("in a feed or folder that's gone"), rather than vanishing or
  quietly spreading to every feed; the database keeps no foreign key for its
  place for that reason, and a number reused by a new folder is never
  picked up, because the rule's place is cleared when its folder goes.
- **A switch,** a new control, pauses a rule (DESIGN.md → Visual language).

**Structure change 10** adds the `rules` table, the `articles.muted` column
(every stored article starts not muted) and a small index for the Muted page.
Nothing stored is changed or removed; `tests/structure_changes.rs` tries it
on real-shaped data first.

**Not now:** rules that look at links or tags, regular expressions, and
re-running a rule on read articles. Each can come later if missed.
