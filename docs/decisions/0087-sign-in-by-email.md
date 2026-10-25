# 0087: Signing in by email, and the sign-up switch

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
  letters) and the owner's password-only sign-in count separately. A
  stranger guessing one email makes only that email wait. At most 4,096
  accounts' counts are kept, so made-up emails can't fill the memory; when
  full, quiet accounts are forgotten first and a waiting one only if all
  are waiting. Tries are decided one at a time, as before, so pushing a
  waiting account out takes thousands of slow checks.

**Signing up**

- **One switch for the whole app**, in Settings › Sign-up, for the owner
  only: **Closed** (the default), **Invite link**, or **Open**.
- **Invite link.** The owner makes a link with a long random ticket (32
  bytes, as a device's sign-in ticket), shown once. Only a BLAKE2s scramble
  of it is kept, so a copy of the database can't be used to sign up. One
  link works for several people (testers) until the owner makes a new one or
  closes sign-up; closing forgets it for good.
- **Where it's kept:** three lines in the app-wide `settings` table
  (`sign_up`, `sign_up_invite`, `sign_up_invite_made_at`), not a new table:
  there is only ever one link, and no structure change is needed for it.
- **Open** is shown but switched off, and the server refuses it whatever
  it's sent, until confirmation emails exist (a later change, with sending
  email). Without them, anyone could take someone else's address.
- **At most 20 new accounts in any hour, for the whole app.** nine turtles
  sits behind Render's proxy, so it can't reliably tell one place from
  another; a single app-wide cap is boring and can't be dodged. It's counted
  from when accounts were made, so it survives a restart, and checked again
  in the same database step that makes the account.
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
