## 29 October 2026: Code tidy 31, dependable browser tests

- Behind the scenes, three browser tests that failed now and then (and passed when run again) now wait for each change to be saved before they reload or move to another page: the sort order in Settings and the list's More menu, hiding Collections from the sidebar, and the Newsletters switch before New address. A shared helper (`settingsSaved`) does the waiting, and the "Recently read" test uses it too.
- Nothing in the app changed. Checks should no longer need a second run for these.
