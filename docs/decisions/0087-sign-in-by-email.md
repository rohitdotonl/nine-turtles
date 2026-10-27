# 0087: Signing in by email, and the sign-up switch

> **Partly replaced by [0115](0115-sign-up-always-open.md):** the sign-up switch and invite links are gone; sign-up is always open.

*25 October 2026. Part three of "Many readers in one app" (decision 0086),
at the owner's request. Builds on decision 0010 (sign-in).*

**Decision.** Each reader signs in with an email and a password; the owner
decides who may make an account.

**Signing in**

- **Structure change 13** adds `email` and `password_hash` to `people`. The
  email is unique however it's capitalised. Both start empty; nothing
  already stored changes.
- **The owner is never locked out.** Sign-in with no email is the owner's,
  checked against `NINE_TURTLES_PASSWORD_HASH`, exactly as before, so an old
  tab and the owner's habits keep working. Once the owner saves an email in
  Settings › Readers, they can sign in with it too, with the same password
  (unless they ever get a `password_hash` of their own).
- **Nothing tells a stranger which emails exist.** A wrong password and an
  unknown email get the same answer. An unknown email is checked against a
  scramble nobody chose a password for, so it takes about as long.
- **The wait after wrong tries is per account**: each email (in small
  letters) counts separately, the owner's email too, and the owner's
  password-only sign-in has a count of its own. A stranger guessing one
  email makes only that email wait. So the owner has two separate sets of
  five free tries (the password alone, and their email), and a guesser
  gets ten tries at the owner's one password before waiting, not five.
  That's accepted: counting the owner's email with the password alone
  would let a stranger find out which email is the owner's (use up the
  password-only tries, then try emails: only the owner's would say
  "wait"), and the waits still double up to an hour. At most 4,096 accounts' counts are kept, so made-up
  emails can't fill the memory; when full, quiet accounts are forgotten
  first and a waiting one only if all are waiting.
- **Checking a password never holds anyone else up.** The count is checked
  and recorded under a short lock, never held during the password check
  itself. Each try counts as wrong from the start and is forgotten if it
  turns out right, so tries sent together can't race past the five free
  ones; once an account has to wait, its tries are refused at once, with
  no check.
- **Only a few password checks at once.** Each argon2 check takes about
  19 MB, so a flood of tries could use up the server's memory. Two checks
  at a time are allowed for every sign-in by email, and one for the
  owner's password-only sign-in in a line of its own: guesses at made-up
  emails (up to five each, without end of emails) queue only behind each
  other. The owner's line stays short, because the password alone allows
  only five wrong tries. Every email, the owner's, another reader's or
  one nobody has, waits in the same shared line and is checked the same
  way, so the time doesn't tell which exists or which is the owner's.
  While such a flood lasts, sign-ins by email slow down (the owner's
  email too); the password alone doesn't.
- **A password over 1,024 bytes is refused at once** with the same answer
  as a wrong password, before it's counted or waits for a check. It could
  never match, and the answer is the same whatever the email, so it tells
  nothing; it just keeps long request bodies from waiting in the queue.

**Signing up**

- **One switch for the whole app**, in Settings › Sign-up, for the owner
  only: **Closed** (the default), **Invite link**, or **Open**.
- **Invite link.** The owner makes a link with a long random ticket (32
  bytes, as a device's sign-in ticket), shown once. The ticket is in the
  address's fragment (`/sign-up#invite=…`), which browsers never send, so
  it never reaches the server's or the host's request logs. The sign-up
  page reads it, takes it out of the address bar at once (so it isn't left
  in the browser's history) and sends it in the body of the sign-up. Only a BLAKE2s scramble
  of it is kept, so a copy of the database can't be used to sign up. One
  link works for several people (testers) until the owner makes a new one or
  closes sign-up; closing forgets it for good.
- **Where it's kept:** three lines in the app-wide `settings` table
  (`sign_up`, `sign_up_invite`, `sign_up_invite_made_at`), not a new table:
  there is only ever one link, and no structure change is needed for it.
- **Open** is shown but switched off, and the server refuses it whatever
  it's sent, until confirmation emails exist (a later change, with sending
  email). Without them, anyone could take someone else's address.
- **At most 20 sign-up tries in any hour, for the whole app.** nine turtles
  sits behind Render's proxy, so it can't reliably tell one place from
  another; a single app-wide cap is boring and can't be dodged. Every try
  that gets as far as scrambling a password counts, even one whose email
  turns out to be taken (its answer stays the same), so nobody can make
  the server scramble endlessly. Those tries are kept in memory; the
  accounts made in the hour are also counted from the database, so a
  restart doesn't reopen the hour, and checked again in the same database
  step that makes the account.
- **Sign-ups go one at a time.** Each scramble takes about 19 MB of
  memory, so a lock (held while the password is scrambled and the account
  made) keeps many sign-ups at once from using up the server's memory.
- **The owner should save their email before sending invites.** The owner
  starts with no email, so someone with an invite link could sign up with
  the owner's address first, and the owner couldn't then save it (removing
  a reader is "not yet"). Nothing is exposed and the password alone still
  works, so it's only a nuisance: SPEC says to save it first, and Settings
  says so beside the invite link while the owner has no email.
- New readers' passwords need at least 12 characters, the same as the
  owner's own (`nine-turtles set-password`). Their email needs one
  @ with something either side, no spaces, at most 254 characters. An email
  already used is refused with "That email already has an account": only
  someone holding an invite link can learn that.
- **The owner sees** each reader's email and when they joined, never what
  they read.

**Not yet.** Removing a reader, a reader changing their own email or
password, password reset, and confirmation emails.

**Careful.** Until structure change 12 (each reader's own feeds and marks,
decision 0086) is live, a new reader would share the owner's feeds and
marks, so sign-up should stay Closed until then.

**Rejected.** Usernames (an email is what people remember, and what
confirmation and reset emails will need); a per-place sign-up limit (behind
the proxy, places can't be told apart reliably); keeping the invite link
readable in the database (a stolen copy could be used to join).
