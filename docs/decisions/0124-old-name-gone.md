# 0124: The old name slowfeed is gone from the code

*28 October 2026.*

**Decision.** The owner said to remove the old name everywhere (survey
question 1 of the code tidy-up) and confirmed Render's settings already use
`NINE_TURTLES_*`. So nine turtles no longer reads or writes anything under
the name it had before the rename (decisions 0056 and 0058):

1. **Settings:** only `NINE_TURTLES_*`. A `SLOWFEED_*` setting is ignored.
2. **Database file:** only `nine-turtles.sqlite`. A `slowfeed.sqlite` is no
   longer renamed on start. A backup from before the rename restores as
   before (`NINE_TURTLES_RESTORE_FROM` puts any copy in place under the new
   name); a copy put in place by hand is renamed `nine-turtles.sqlite` first
   (`docs/operations/backups.md`).
3. **Sign-in cookie:** only `nine_turtles_session`. A device still holding
   only the old `slowfeed_session` cookie signs in once more.
4. **Version header:** only `x-nine-turtles-version`.
5. **Command:** only `nine-turtles` (the `slowfeed` link in the image is gone).
6. **Saved on the device:** only `nine-turtles.preferences` and
   `nine-turtles.open-folders`. Choices saved only under the old names go
   back to the defaults (the look, text size and open folders), once. The
   table that turned themes from before decision 0056 into Original is gone
   too: those were only ever saved under the old name. A theme the app
   doesn't know still opens as Original, keeping its Appearance.

**Kept.** History stays as written (decision notes, the changelog, the
archive, the website's story of the name). Names only the owner can change
stay too: the Render service, its address `slowfeed.onrender.com` and its
disk `slowfeed-data`, the GitHub repository's address, and the daily
check's own `SLOWFEED_ADDRESS` and `SLOWFEED_DIAGNOSTICS_KEY` (set in the
routine's environment, not read by nine turtles).
