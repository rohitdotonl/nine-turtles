## 25 October 2026: Emails for accounts, and deleting an account

- nine turtles can now send a few short, plain emails, through Brevo or any other email service (`docs/operations/email.md`). Nothing is sent until you add the five email settings in Render.
- With email on, sign-up can be **Open**: anyone can make an account by opening the link emailed to them (within 24 hours). Invite links work as before, without an email.
- **Forgot your password?** on the sign-in page sends a link to choose a new password (it works once, for an hour, and signs out your other devices). It never says whether an email has an account, and sends at most three emails to an address in an hour.
- Every reader can change their email in Settings › Account: a link goes to the new address, and the old one is told.
- Readers (not the owner) can delete their account in Settings › Account: the sheet offers their downloads first, then one "Are you sure?". It can't be undone.
- The emailed links keep their secret part after the `#`, which never reaches a server's log, as invite links now do; checking a password to change an email counts towards the same waits as signing in.
- Saving your own email in Settings › Readers now asks for your password, so a device left signed in can't send your password links somewhere else.
- If you set a new password by email and later can't use email, putting a new `NINE_TURTLES_PASSWORD_HASH` in Render makes it your password again and signs out every device (`docs/operations/owner-password.md`).
- A new password by email also turns off that reader's app password for other feed reader apps. Only plain addresses are accepted (no name or `<…>` around them), and nothing about an address's account shows in how long an answer takes or when "too many" is said.
- Structure change 14 adds a table for the emailed links (nothing already stored changes; a backup is taken first).
