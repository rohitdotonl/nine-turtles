# 0122: Simpler sign-in pages, and Forgot? as a link that signs in

*27 October 2026.*

**Decision.** The owner chose the "My pick" version of finding S2 in the
design try-outs: the usual sign-in pattern. What it looks like is in
`docs/SPEC.md` section 1 and `docs/DESIGN.md` Part 2 ("The sign-in pages");
this note records the rules and the choices the try-out left open.

1. **Names above fields.** Every field on sign-in, sign-up, Forgot? and the
   page its link opens has its name as real text above it, as in a sheet,
   never a placeholder alone (it replaces decision 0048's names inside the
   fields). The password's name sits 24px under the email field.
2. **One way back in: Forgot?** "Email me a sign-in link" (decision 0096)
   and "Forgot your password?" (decision 0088) become one small **Forgot?**
   at the right of the Password name's line. It emails the sign-in link
   (15 minutes, the same limits and the same never-says-who-has-an-account
   answer); the link's page signs in with one press, then offers a new
   password, with **Not now** to keep the old one. Choosing one there does
   exactly what a password link does: other devices signed out, the app
   password off, unused links spent.
3. **The choice of a password lives in memory only.** Using a sign-in link
   answers a second random ticket (`accounts::PasswordChoices`): kept as a
   BLAKE2s scramble, for one reader and the address the link went to, for an
   hour, spent once by `/api/password/reset`, which takes it as it takes an
   emailed password ticket. It isn't in `email_links`: that table's checks
   allow an unemailed line only for a spent change of email, and a line
   marked as emailed would wrongly count towards the address's three emails
   an hour. Keeping it in memory needs no structure change; a restart (or a
   deploy) forgets it, and the reader presses Forgot? again.
4. **Forgot? keeps the old rules about email.** Without email it isn't
   shown, as the old links weren't; asking anyway gives the old "Forgot your
   password?" answer ("Ask whoever runs it to set a new password for you").
   The `/api/password/forgot` route and the `/reset-password` page stay, so
   a password link already sent, or a page left open from before, still
   works; nothing on the sign-in page uses them now.
5. **Where the try-out and earlier decisions differ, the decisions win:**
   - No "Check your email" after signing up: sign-up sends no email and
     signs in at once (decision 0115).
   - "It works once, within 15 minutes", not "within the hour": the sign-in
     link's real lifetime (decision 0096).
   - "Didn't get it? Look in your spam folder." and **Send again** stay under
     Check your email (decision 0092).
6. **Passkeys:** "Sign in with a passkey" is a quieter, edged button under
   Sign in (it was words under the form). The keyboard goes Email, Password,
   Forgot?, Sign in, the passkey, Sign up: Forgot? comes after the password
   field in the page and is only drawn on the name's line.
7. **Autocomplete:** the email fields say `email`, the passwords
   `current-password` or `new-password`. Where passkeys are offered, the
   sign-in email field keeps `username webauthn`, the form browsers document
   for passkey autofill.
8. **Sign-up's "already has an account"** no longer adds a second Sign in
   button: "Have an account? Sign in" is always under the form.
