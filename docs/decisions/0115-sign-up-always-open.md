# 0115: Sign-up always open

*October 2026.*

**Decision.** Anyone can make an account, at any time, with an email and a
password. The account is made at once and the device signed in. There is no
switch for the owner (Closed, Invite link and Open are gone), no invite link,
and no email to confirm the address. The owner asked for this in their own
words: "open once and for all", "no magic link or anything". It replaces the
sign-up switch of decision 0087 and the emailed sign-up link of decision
0088; everything else in those decisions stands.

**Why.** nine turtles is becoming a service people pay for, and the owner
will add plans and payments on top of plain sign-up. A switch and invite
links were for testing with a few people; a confirmation email adds a step
(and a dependency on email working) at the moment a new reader is most
likely to give up.

**What still guards it.**
- At most 20 sign-up tries, and 20 new accounts, in any hour for the whole
  app, and one sign-up at a time (unchanged), so a bot can't fill the
  database quickly or use up the server's memory.
- Passwords of at least 12 characters, as before.

**What we accept.**
- Nobody checks that an address belongs to whoever typed it. Someone could
  sign up with another person's address; that person can still take the
  account over with "Forgot your password?", which emails them, but only
  while nine turtles can send email. Sign-up works without email too; then
  a taken address can't be won back, and a reader who forgets their
  password has no way in.
- A stranger could sign up with the owner's address before the owner saves
  it in Settings › Readers. The owner had saved theirs when this was
  decided.
- Saying "That email already has an account" tells anyone whether an
  address is signed up here. Before, only someone with an invite link could
  learn that. Every sign-up page on the web does the same.

**What was removed.** The `/api/sign-up/settings`, `/switch` and `/invite`
routes, Settings › Sign-up, the "Check your email" step and the
"not confirmed yet" answer at sign-in, and the count of sign-ups waiting on
the Readers page. A link to `/confirm-email` now only confirms a changed
address. The old `sign_up*` rows in `settings` and any old `sign-up` links
in `email_links` are left unused; no structure change.
