# 0187: One line width, one sidebar, shorter words

*6 November 2026.*

**Context.** Points 5, 6 and 15 of the owner's whole-app review of what to
remove or simplify. How an article looks was set in two places, with a line
width choice (Narrow, Medium, Wide) the reader is least likely to
understand; a whole Settings page hid Starred, Notes or All articles from the
sidebar; and some lines explained the machinery instead of what the reader
can do. The owner agreed to all three.

**Decision.**

- **One line width for everyone:** Medium, about 71 characters a line in
  Literata. The usual guidance is 45 to 75 characters, about 66 the ideal,
  and WCAG 1.4.8 (AAA) asks for no more than 80; a larger text size makes
  lines shorter by itself. Line width leaves Settings and the Aa panel. A
  width saved on a device before is let go.
- **Font sits on Settings itself,** beside Page and Text size, so the Font
  and line width page goes; `/settings/font` opens Settings.
- **The sidebar is the same for everyone:** Show in the sidebar and its
  setting go. Starred and All articles always show, Notes once there's a
  note, Unread while it's on. `/settings/sidebar` opens Settings. The server
  no longer reads or saves the setting; rows saved before are left in place,
  unread (nothing a reader made is lost: it only ever hid a list).
- **Shorter words:** Look and feel says "Apply to this device only. The Aa
  button above an article changes these too."; Hiding says "Hidden articles
  are kept, and search still finds them."; Pause for a while says "Their new
  articles wait until you untick this."; and every list ends "That's
  everything.", Unread too (replacing decision 0142's "That's everything for
  now.").

**Why.** Less, but better: a good line length is the app's job, not the
reader's, and one sidebar means Help, screenshots and keys always match what
a reader sees. If a reader misses either, the removal line applies: write to
hello@nineturtles.app.
