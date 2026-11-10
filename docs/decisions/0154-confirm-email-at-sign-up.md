# 0154: Confirm the email address at sign-up

**In one line:** Confirm the email address at sign-up: signing up emails a link, and only following it with the password chosen makes the account, confirms its address and signs the device in (replaces 0115's "no confirmation email"); without email settings the account is made at once; readers who already had an address count as confirmed

*Changed by [0193](0193-confirm-in-the-same-browser.md): in the browser that signed up, the link asks no password.*

*3 November 2026. The owner's choice, in their own words: "Confirm at
sign-up". Replaces decision 0115's "no email to confirm the address"; the
rest of 0115 stands (sign-up is always open, no switch, no invite).*

**Decision.** While nine turtles can send email, signing up makes nothing
at once. It emails a link to the address, and only following that link
makes the account, marks its address confirmed and signs that device in.

**Why.** The weekly email (decision 0150) sends mail, signed by the owner,
to a reader's address every week. Its review found that anyone could sign
up with a stranger's address and have that mail sent to them. Confirming
the address at sign-up closes that for everything nine turtles will ever
email, instead of each feature asking on its own.

**How it works.**
- `POST /api/sign-up` checks the email and password as before, counts
  the try towards the hour's 20 and scrambles the password. An address
  that already has an account is still told so. Otherwise the address
  and the scrambled password wait in a `sign-up` row of `email_links`
  (structure change 31 lets that table hold them again, as it did before
  decision 0115), and the answer is 202 with `sent_to`. No account, no
  cookie.
- The email, "Confirm your email for nine turtles", holds one link to
  `/finish-sign-up`. It works once, for 24 hours. The page asks for the
  password chosen at sign-up and waits for a press of **Confirm email**,
  so a mail program checking links can't use it up.
- **Why the password too.** The link proves the address is the reader's;
  the password proves the sign-up is. Without it, a stranger could sign
  up with someone's address just after them, and the real person,
  opening the newest email, would make the account with the stranger's
  password, so the stranger could sign in to it (the second-agent review
  found this). Now every waiting sign-up for the address stays, and the
  password typed picks the one that's theirs. Wrong passwords count as
  sign-in's do, for that address.
- Finishing makes the account (the 20-accounts-an-hour cap is checked
  again; if it's reached, nothing is kept and the same link works later),
  sets `people.email_confirmed_at`, spends every other waiting sign-up
  for the address, and signs the device in.
- Sign-up emails keep the limits every emailed link keeps: three to one
  address in any hour, one a minute (pressing Sign up twice sends one).
  The sign-up email counts as one of the address's three for that hour.
  **Send again** on Check your email sends the same sign-up again, so it
  counts as one of the hour's 20 sign-up tries too.
- `people.email_confirmed_at` is also set when a reader follows a link
  to a changed address or a sign-in link (Forgot?): both prove the address
  is theirs. `GET /api/session` says `email_confirmed`, so features that
  send email can ask for a confirmed address.
- **Without the email settings** (nine turtles on someone's own computer)
  sign-up makes the account at once, as before, with its address not
  confirmed.

**Readers who signed up before this** count as confirmed: structure change
31 sets `email_confirmed_at` for everyone who already had an address. The
owner chose this on the decision card ("Count them as confirmed"), knowing
that an account already made with a stranger's address would count as
confirmed too.

**What we accept.**
- A new reader waits for one email before they can read. If email stops
  working, nobody new can sign up until it's fixed.
- Saying "That email already has an account" still tells anyone whether
  an address is signed up here, as decision 0115 accepted.
- A few people pressing Send again use up the hour's 20 sign-up tries as
  any sign-up does; the cap is for the whole app, as before.
