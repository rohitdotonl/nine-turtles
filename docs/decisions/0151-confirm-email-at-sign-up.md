# 0151: Confirm the email address at sign-up

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
  `/confirm-email`, the page that already confirms a changed address. It
  works once, for 24 hours. The page waits for a press of **Confirm
  email**, so a mail program checking links can't use it up.
- Pressing it makes the account (the 20-accounts-an-hour cap is checked
  again; if it's reached, nothing is kept and the same link works later),
  sets `people.email_confirmed_at`, and signs the device in.
- Only the newest sign-up link for an address works: a second sign-up
  spends the first, so an older link can't make the account with an older
  password. Once an account is made, every other waiting link for that
  address is spent.
- Sign-up emails keep the limits every emailed link keeps: three to one
  address in any hour, one a minute (pressing Sign up twice sends one).
  The sign-up email counts as one of the address's three for that hour.
- `people.email_confirmed_at` is also set when a reader follows a link
  to a changed address or a sign-in link (Forgot?): both prove the address
  is theirs. `GET /api/session` says `email_confirmed`, so features that
  send email can ask for a confirmed address.
- **Without the email settings** (nine turtles on someone's own computer)
  sign-up makes the account at once, as before, with its address not
  confirmed.

**Readers who signed up before this.** Their address starts unconfirmed
(empty `email_confirmed_at`). They keep reading as before. The owner was
asked what else should happen to them; their answer is recorded here once
given.

**What we accept.**
- A new reader waits for one email before they can read. If email stops
  working, nobody new can sign up until it's fixed.
- Two people signing up with the same address: the newest link wins. If a
  stranger signs up with someone's address right after them, the real
  owner may follow the stranger's link and get the stranger's password.
  They can choose a new one at once with Forgot?, which only they can
  receive. Three emails an hour to an address keeps this rare.
- Saying "That email already has an account" still tells anyone whether
  an address is signed up here, as decision 0115 accepted.
