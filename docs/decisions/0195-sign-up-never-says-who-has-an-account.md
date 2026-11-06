# 0195: Sign-up never says who has an account

*6 November 2026.*

**Decision.** Three changes to signing up, from the owner's onboarding
review (the owner said "just implement your suggestion"):

- **Sign-up never tells whether an address has an account.** Signing up
  with one answers "Check your email", exactly as for a new address, and
  the address gets an email instead of a link: "You already have a nine
  turtles account", saying to sign in with the password or press Forgot?.
  The email keeps the limits every sign-up email keeps (one a minute, three
  to one address an hour), so it can't be used to flood an inbox. This
  replaces what decision 0115 accepted: sign-in and Forgot? never said
  whether an address had an account, but sign-up did ("That email already
  has an account."), so anyone could test any address. Once sign-up
  emailed a link (decision 0154) there was no longer a reason to say it on
  the page. Only where nine turtles can't send email (on someone's own
  computer) is it still said, since nothing else could tell them.
- **Up to 100 sign-ups an hour, for the whole app** (was 20). One good
  post somewhere could have turned real people away with "Try again
  later". An account is made only once its emailed link is followed, and
  each address keeps its own email limits, so the higher number lets
  through no accounts a bot could use; sign-ups still go one at a time.
  The cost: sign-up is the one form that emails an address with no
  account, so a bot typing a new address each time could make nine turtles
  send up to 100 emails an hour (was 20), which could use up a small daily
  email allowance and hold back everyone's Forgot? emails until the next
  day. Told this, the owner chose 100 over the 200 first suggested.
- **A quiet link to the reader's inbox** under "Check your email" (after
  signing up and after Forgot?), when the address shows where it is:
  Gmail, Outlook or Hotmail, iCloud, Proton. A link in words that opens a
  new tab; nothing opens by itself. Any other address shows nothing.

**How.** The taken-address answer does the same work as a new one (the
password scramble and the counted, one-writer-at-a-time save), so the time
taken doesn't tell either. Its saved line in `email_links` is spent at once
and keeps no password, so it counts towards the address's emails but can
never finish a sign-up. No structure change.

**Not changed.** "How did you hear about nine turtles?" stays where it is
on the sign-up form.
