# 0116: Everyone signs in with an email, the owner too

*October 2026.*

**Decision.** The password alone no longer signs anyone in. Every reader,
the owner (reader 1) too, signs in with their email address and password.
The owner asked for this in their own words: "I don't need that 'still
sign-in with password alone' feature." It replaces the owner's
password-only sign-in of decision 0087; everything else there stands.

**A brand-new nine turtles.** Its owner has no email yet, only the password
set as `NINE_TURTLES_PASSWORD_HASH`. So while the owner has no email, the
first sign-in with an email nobody has and the owner's password signs in as
the owner and saves that email as theirs. From then on it's that email and
password, like everyone else. No new setting, and nothing to do in Render.

**What stays.**
- The owner's password is still `NINE_TURTLES_PASSWORD_HASH` until they
  choose their own with an emailed link, and a new line there is still their
  way back in without any email being sent (decision 0088,
  `docs/operations/owner-password.md`). They type it with their email.
- The owner changes their email in Settings › Readers, with their password,
  as before. It can't be emptied, so the owner can't end up with none.
- Wrong tries are counted per email, the owner's too. The owner no longer
  has a second, separate set of five tries; the separate count and check
  line for "the owner" now serve only an owner with no email yet confirming
  their password in Settings.

**What we accept.**
- On a brand-new nine turtles, whoever first signs in with the owner's
  password chooses the owner's email. Only someone who has the owner's
  password can do that, and they could already sign in as the owner.
- An owner who forgets which email they saved can't sign in with the
  password alone any more. Settings › Readers shows it while signed in, and
  every reader's email is on the Readers page.
