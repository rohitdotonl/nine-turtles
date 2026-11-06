# 0191: A smoother way in

*6 November 2026.*

**Decision.** Five small fixes from the owner's onboarding review (findings
1, 2, 8, 11 and the empty exports), each removing a stumble a new reader
meets, with no new feature:

- The website's **Start reading** opens the app's sign-up page, not sign-in:
  the most important button on the website was landing newcomers on a form
  for people who already have an account.
- **The sign-in pages' password fields have a Show button** (sign-in,
  sign-up, confirming the email, a new password; not Settings' password
  checks). Typing 12 characters blind on a phone causes
  mistakes that only show up at the confirm step. Show becomes Hide; the
  page always opens with the dots. One shared field (`PasswordField.svelte`)
  so the five pages can't drift apart.
- **No "where you are" pill in the sidebar while the welcome shows:** the
  reader is on the welcome, not in Unread.
- **In the "several feeds" choice, an address stays on one line** ending in
  "…", never cut off at the card's edge or broken mid-word.
- **An export with nothing in it says so:** "Nothing starred yet" and "No
  notes yet" in the muted grey, as a line that isn't a button, in Settings ›
  Your data and on the delete sheets. The sidebar's feeds already say
  whether there are notes; they now say whether anything is starred too, and
  starring something switches the row on at once.

**Not done.** Hiding the phone welcome's "‹ Feeds" (finding 7) is waiting on
the owner: on a phone the Feeds screen is the only way to Settings, Help and
signing out while the welcome shows.
