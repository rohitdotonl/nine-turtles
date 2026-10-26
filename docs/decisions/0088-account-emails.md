# 0088: Account emails: confirming, a new password, a new address, and deleting an account

*25 October 2026. Part of "Many readers in one app" (decision 0086), at the
owner's request. Builds on decision 0087 (signing in by email, the sign-up
switch).*

**Decision.** nine turtles sends a few short emails, so readers can confirm
their address, set a new password and change their email, and sign-up can
be Open. A reader can also delete their own account.

**Sending email**

- **Plain SMTP**, the standard way programs hand email to a mail service,
  with the `lettre` library (approved by the owner, 25 October 2026). Brevo
  to start with; any SMTP service works by changing the settings, so there's
  no lock-in. The how-to is `docs/operations/email.md`.
- **Five settings:** `NINE_TURTLES_SMTP_HOST`, `_PORT` (587 unless set),
  `_USERNAME`, `_PASSWORD` and `_FROM`. All four of host, username,
  password and sender, or none: some but not all (the port alone too) stops
  nine turtles with a message naming the missing ones. The links start with
  `NINE_TURTLES_PUBLIC_URL`, never with an address taken from a request, so
  nobody can make a link point elsewhere; the email settings without it stop
  nine turtles too. The settings' debugging print hides the SMTP password.
- **Encrypted:** port 587 upgrades the connection with STARTTLS before the
  password is sent, and gives up if the service can't; port 465 is
  encrypted from the start. Unencrypted only to a mail server on the same
  computer (the browser tests' made-up one).
- **Without the settings, nothing is sent.** "Forgot your password?" and
  "Change…" aren't offered, the server answers such requests with
  `no-email`, and Open stays refused.
- **The emails are short plain text**, with no images, no tracking and no
  link but the one the reader asked for. They go out behind the answer, so
  how long a request takes never tells a stranger whether one was sent. A
  failure is written to the log in nine turtles' own words, never the mail
  server's (which often repeat the address), and never the address.
- **Only a bare address** is accepted: no name before it, no `<` `>`,
  quotes, commas, semicolons, colons, brackets, backslashes, spaces or
  control characters, and lettre's own reading of it must be exactly what
  was typed. Otherwise `evil<victim@example.com>` would reach
  victim@example.com while counting as a different address (found in
  review). (Brevo's own link and
  open tracking must stay off: `docs/operations/email.md`.)
- **Tests** keep the emails in memory instead of sending them
  (`email::Mailer::outbox`); the browser tests use a made-up mail server on
  the same computer (`web/tests/mail-server.mjs`).

**Links**

- **Structure change 14** adds an `email_links` table. Each link carries a
  long random ticket (32 bytes, as a device's sign-in), of which only a
  BLAKE2s scramble is kept. A link works once, until it expires: **24 hours**
  to confirm an address, **1 hour** for a new password. Nothing already
  stored changes.
- **The ticket comes after the `#`** (`/reset-password#ticket=…`,
  `/confirm-email#ticket=…`), as the invite link's does (decision 0087):
  browsers never send that part of an address to a server, so the ticket
  never lands in a log. The page reads it, takes it out of the address bar
  at once, and sends it in the body of a POST. Rejected: `?ticket=…`, which
  the host's request log would keep.
- **Passwords here follow sign-in's rules.** Changing email checks the
  reader's password exactly as sign-in does: the same count of wrong tries
  (recorded before the check, so tries sent together can't race past it)
  and the same bounded lines of password checks (`AppState.password_checks`).
  A new password from a link is scrambled only once its ticket is found
  good, in the same lines, so made-up tickets cost the server nothing.
- **At most three emails go to one address in any hour**, whatever they're
  for, so nine turtles can't be used to fill someone's inbox. Past that,
  the answer is the same and nothing is sent. The count and the new link
  are saved in one step (`BEGIN IMMEDIATE`, SQLite's one writer at a time),
  so requests sent together can't race past three (found in review).
- **Tidying:** links past their time are deleted with every new link and
  every round of background checking, so on a quiet nine turtles too an
  email doesn't stay past its link's day. Once an Open sign-up is
  confirmed, the password scrambles waiting with its links are blanked.
- **The confirmation page asks for one press** (Confirm email) rather than
  confirming as it opens: some mail programs open links to check them, and
  would otherwise use the link up before the reader sees it.

**Open sign-up**

- Open can be chosen in Settings › Sign-up once the email settings are set.
- Signing up while Open makes no account yet: the email and the scrambled
  password wait with the link, and the account is made when it's followed.
  The answer is the same whether or not the address already has an account,
  and so is the time it takes: the password is scrambled either way (about
  19 MB of memory and a noticeable fraction of a second), one sign-up at a
  time as before (found in review), so nobody learns who is here.
- Signing in before confirming: the right password hears "Your email isn't
  confirmed yet", and the link is sent again (within the address's three an
  hour); a wrong password hears only "don't match", as always.
- The 20-an-hour caps still hold: each Open sign-up counts as a sign-up
  try when its link goes out, and the 20 accounts an hour are counted again
  when a link is followed and the account made. Following a link waits its
  turn behind the same one-at-a-time lock as sign-up (`AppState.sign_ups`),
  so links followed together can't race past the count.
- **Invite sign-ups don't confirm.** The owner chose whom to send the link
  to, and decision 0087 already makes those accounts at once; asking them
  to confirm would add a step for people the owner vouched for. The cost:
  someone with an invite link could sign up with an address that isn't
  theirs, which only the owner's own invite makes possible.

**A new password ("Forgot your password?")**

- On the sign-in page, while email can be sent. Always the same answer,
  whether or not the address has an account, after the same database work.
- The new password needs at least 12 characters, as at sign-up. Setting it
  signs out every device signed in as that reader, signs this one in,
  stops any other password link for them, and turns off their app password
  (other feed reader apps): someone resetting because they fear a break-in
  expects everything to stop.
- The owner can use it too, once they have an email. Their new password then
  replaces `NINE_TURTLES_PASSWORD_HASH` for signing in, with or without the
  email, **for as long as that setting stays as it was**.
- **The owner's way back that needs no email** (found in review: once the
  owner had used a link, a broken email service and a forgotten password
  would otherwise leave only editing the database). The reset saves a
  BLAKE2s fingerprint of the `NINE_TURTLES_PASSWORD_HASH` in force
  (`settings.owner_password_from`; never the line itself). On every start,
  if the setting is a real line whose fingerprint differs, the owner's own
  password is cleared and every device signed in as the owner signed out:
  the new setting is their password again. A missing or invalid setting
  changes nothing, so a slip on the host never locks the owner out. Steps:
  `docs/operations/owner-password.md`. Rejected: a command to run on the
  server (the owner can't run one on Render), and clearing it whenever the
  setting is present (every restart would undo the reset).

**Changing email** (Settings › Account, any reader)

- The new address and the reader's own password (checked as sign-in does,
  with the same waits), so a device left signed in can't hand the account
  to someone else.
- A link goes to the new address; nothing changes until it's followed. Then
  the old address gets a short note saying so.
- An address another reader already has gets nothing, and the answer is the
  same, so no reader learns who else is here. The try still counts towards
  the reader's three changes in an hour, saved as a spent line that's never
  emailed (`emailed = 0`) and never counts towards that address's own
  emails, so the "too many" answer can't tell either, and the other reader's
  password emails aren't used up (found in review). An address past its
  hour's emails is answered the same way.
- The owner keeps their own direct "Your email" box in Settings › Readers
  (decision 0087), which works without email. **It asks for the owner's
  current password** (checked as their password-only sign-in, with the same
  waits): that address receives the owner's password links, so a device
  left signed in as the owner must not be able to change it (found in
  review).

**Deleting an account** (Settings › Account, any reader but the owner)

- **The owner's choice:** one "Are you sure?", then deleted at once, with no
  waiting period. Before it, the sheet offers the reader's two downloads
  (OPML, and starred articles).
- **This is the second exception the owner accepted to "nothing deletes
  without undo"**, after unsubscribing: there is no undo, only the nightly
  backups.
- `people::delete` deletes the reader and every line of theirs in one
  transaction. Each feed they follow is let go as unsubscribing lets it go
  (structure change 12's `folders::clear`, their stars included), so a feed
  nobody else follows stops being checked and its articles go; other
  readers' feeds are untouched. Then it empties the reader's tables, naming each table (`PER_READER_TABLES`) rather than trusting
  each table's `ON DELETE CASCADE`. A test lists every table with a
  `person_id` column from the database itself and fails if one isn't
  named, or still holds the reader's lines afterwards (structure change 12's
  `subscriptions` and `entries` are named).
- Every emailed link to the reader's address goes too: an Open sign-up's
  links have no reader number, but hold the email (found in review). The
  test also checks that none of the owner's lines go.
- The owner's account can't be deleted: nine turtles needs its owner.
- **No password is asked for**, though changing email asks for one: the
  owner chose "ask once". A device left signed in can delete that reader's
  account; that's accepted, deliberately (raised in review, kept).

**Rejected.** An email service's own web interface (an "API") instead of
SMTP: one provider's way of working, where SMTP is the same everywhere. A
grace period before deleting (the owner chose none). A captcha on sign-up
(the owner chose limits and confirmation instead). Confirming invite
sign-ups (above). Confirming as the page opens (above).
