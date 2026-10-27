## 27 October 2026: Passkey sign-in

- You can now sign in with your fingerprint, face or device PIN. Add a
  passkey in Settings › Passkeys (it asks for your password first), then
  press **Sign in with a passkey** on the sign-in page, or pick it from the
  email field's suggestions. Every reader can; passwords keep working.
- Each passkey can be renamed, and removed with Undo straight afterwards.
  Removing one never locks you out.
- Passkeys work at app.nineturtles.app; slowfeed.onrender.com doesn't offer
  them.
- One new library, webauthn-rs, checks passkeys (your yes, decision 0109),
  and a new table holds them (structure change 25, backed up first).
