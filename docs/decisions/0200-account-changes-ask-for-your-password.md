# 0200: Change your password in Settings; deleting asks for your password

*6 November 2026.*

**Decision.** Three changes from the owner's review of the account flows
(the owner said "Implement all the three ideas and merge"):

- **Settings › Account › Password › Change…** opens a sheet asking for the
  current password and a new one. Before, the only way was to sign out and
  use Forgot?, a hidden path the Help page had to explain. A new password is
  stored as Forgot?'s is: every other device is signed out and every unused
  password or sign-in link stops working; this device stays signed in. Its
  icon is a new one, a closed padlock (one icon, one meaning: the key is
  Passkeys').
- **Delete account… and Delete data… ask for your password,** as Change
  email and adding a passkey already did, so a device left signed in can't
  delete anything. Both can't be undone, so they needed it most.
- **Every email that holds a link opens and ends the same way:** "Someone,
  hopefully you, asked to …" and "If you didn't ask, ignore this email: …",
  saying what happens if they do. The sign-up and change-of-email emails
  opened differently before.

**How.** One place checks the signed-in reader's own password and stores a
new one (`server/src/own_password.rs`), used by changing the password,
changing the email, adding a passkey, both deletes, and Forgot?'s new
password, instead of three copies.
