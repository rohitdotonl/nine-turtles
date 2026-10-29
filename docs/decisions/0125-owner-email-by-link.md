# 0125: The owner changes their email by a link, like everyone

*28 October 2026.*

**Decision.** The owner said yes (survey question 2 of the code tidy-up):
the owner changes their email the same way every reader does, with
**Settings › Account › Change…**, which asks for their password and sends a
link to the new address; the email changes once the link is opened. So:

1. **Gone:** the "Your email" and "Your password" boxes in Settings ›
   Readers, and the server's direct save behind them
   (`POST /api/people/me/email`). Readers now holds only All readers ›.
2. **Gone from the database** (structure change 27, with the automatic
   backup first, decision 0076): what was kept only for the emailed sign-up
   links that decision 0115 ended. The `sign-up` purpose of `email_links`,
   its `password_hash` column (a waiting account's password), and the old
   Sign-up switch and invite link's settings (`sign_up`, `sign_up_invite`,
   `sign_up_invite_made_at`). Every emailed link now belongs to a reader
   (`person_id` is required). Any sign-up link still stored was already
   unusable and is dropped; no reader, password or other link changes.

**Why.** One way to change an email, for everyone: the new address is
proved before it's used, and the old one is told. The owner's direct save
skipped both, and it was the last code written only for the owner's email.

**What it costs.** Without the email settings, nobody can change their
email, the owner included (Change… isn't shown). The owner's first sign-in
on a brand-new install still saves their email (decision 0116), so they
always have one.

Replaces the owner's "Your email" box of decisions 0087 and 0088.
