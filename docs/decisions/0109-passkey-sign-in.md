# 0109: Passkey sign-in

*27 October 2026. The owner asked for it, and said yes to one new library
for it.*

**Decision.**

- **Passkeys beside passwords, never instead.** A reader adds a passkey in
  Settings › Passkeys and can then press **Sign in with a passkey** on the
  sign-in page, or pick the passkey from the email field's suggestions (the
  browser's passkey autofill, "conditional mediation"). Email and password
  sign-in, the owner's password-only sign-in and sign-in links all work as
  before. Removing a passkey, or every passkey, never locks anyone out.
- **The password first.** Adding a passkey asks for the reader's password,
  as changing an email does, checked the same way (`auth::ask_password`:
  the same count of wrong tries and the same waits), so a device left signed
  in can't give someone a way back in.
- **webauthn-rs 0.5** does the checking (`server/src/passkeys.rs`): the
  best-known Rust library for it, by the Kanidm project. It checks each
  signed answer, insists the device checked who's there (fingerprint, face
  or PIN: "user verification required"), and refuses a passkey whose counter
  goes backwards (a sign it was copied). The tests use the same project's
  software passkey (webauthn-authenticator-rs, tests only). The browser side
  needs no library: `navigator.credentials` and small base64url helpers
  (`web/src/lib/passkeys.ts`). webauthn-rs uses the system's OpenSSL, so the
  Dockerfile installs its development files to build and its library to run.
- **Passkeys the device keeps itself** ("discoverable"): nine turtles asks
  for them (`residentKey: required`), so signing in needs no email typed
  first. The passkey hands back a random number (a UUID) that stands for its
  reader, the same for all of one reader's passkeys and nothing else; the
  passkey is found by its own number and both must match.
- **Challenges are kept in memory, five minutes, used once.** Each step (add,
  or sign in) gets a 32-byte random ticket; what's needed to check the answer
  stays on the server, never in the browser. A challenge is removed as soon
  as an answer arrives, right or wrong, so no answer can be sent twice.
  Sign-in challenges, which anyone can ask for, and adding challenges, which
  only a signed-in reader can, are kept apart. At most 1,000 sign-ins wait at
  once for the whole app; when that's full, the oldest is pushed out (expired
  ones go first) rather than refusing the new one, so nobody can switch
  passkeys off by opening sign-in pages, and a pushed-out one only says
  "That took too long. Try again." A reader adding a passkey has only their
  newest challenge, in a pool sign-ins can't reach. A restart
  forgets them, which costs only a second try. The sign-in page asks for a
  fresh autofill challenge every four minutes while it's open, and never
  sooner than five seconds after the last: a browser that turns the offer
  down at once (no passkey for this site) would otherwise ask in a loop.
- **No waits for wrong passkeys.** A passkey can't be guessed, so a refused
  one makes nobody wait, and can't be used to lock a reader's password out
  (as with app passwords). Refusals are noted in the log as information.
- **Signed in exactly as by password** (`auth::remember_device`): a year
  from last use, one device. No email is sent for a passkey sign-in or a new
  passkey, as none is sent for a password sign-in.
- **Where passkeys work:** a passkey belongs to one site. nine turtles' is
  `NINE_TURTLES_PUBLIC_URL` (https://app.nineturtles.app on Render), exactly;
  without it, `localhost` on any port, for trying nine turtles out on one's
  own computer. The session's answer says which (`passkeys`), and the page
  shows nothing about passkeys anywhere else (slowfeed.onrender.com, a
  numeric address) or in a browser without WebAuthn.
- **Remove, with Undo.** Removing marks the passkey removed: it stops signing
  in at once, and Undo brings it back for ten minutes, after which it's
  deleted for good. A removed passkey doesn't stop that device adding one
  again straight away; one added again replaces its removed line. Each reader keeps at most 20. A reader's passkeys are
  theirs only (`person_id`, `server/tests/passkeys.rs`), and go with their
  account (`people::PER_READER_TABLES`).
- **Structure change 25:** a new `passkeys` table (the passkey's public key
  and counter as webauthn-rs writes them, its number, its reader's random
  number, a name, when it was added, last used and removed). Nothing already
  stored changes; nine turtles stores a backup first, as before every
  structure change (decision 0076).

**Not chosen.**
- Writing the checking ourselves with smaller crypto libraries: the
  signature formats, counters and flags are easy to get subtly wrong, and a
  mistake here hands out accounts.
- Keeping challenges in the database: they last five minutes, and the
  library would need its "danger" option to save them.
- Passkeys as a second step after the password (two-factor): the owner asked
  for passkeys instead of a password, and most readers' passkeys already
  check a fingerprint, face or PIN.
- An email for each new passkey: no email goes out for other sign-in
  changes made while signed in, apart from a changed address.

**A new password keeps passkeys (the owner's choice, 27 October 2026).**
Setting a new password from an emailed link, and the owner's way back with a
new `NINE_TURTLES_PASSWORD_HASH`, sign other devices out but leave passkeys
as they are. The advice that goes with it, in SPEC section 1 and
`docs/operations/owner-password.md`: after a new password, look in Settings ›
Passkeys and remove any passkey you don't recognise.
