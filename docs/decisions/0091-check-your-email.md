# 0091: "Check your email", once, and one link a minute

*26 October 2026. The owner pressed Send link twice on "Forgot your
password?" and got two emails; the page also said twice that an email was
coming (the line under the field, then the answer under it), and the button
stayed there to press again.*

**Decision.**

- **Said once.** Once a link is asked for, the form gives way to **Check
  your email**: where the link went (in the same words whether or not the
  email has an account) and how long it works. The keyboard goes to the
  heading. Open sign-up's "A link to finish signing up…" does the same.
- **A quiet way to ask again.** Under it, "Didn't get it? Look in your spam
  folder, or send it again in a minute." After a minute **Send again**
  appears, a link in words, in room kept for it so nothing on the centred
  page moves (no countdown ticking: nothing moves unless you move it).
- **One link of a kind a minute, on the server too** (`EMAIL_GAP` in
  `accounts.rs`), on top of three emails an hour per address. A second press
  within the minute, from this page, another device or a script, gets the
  same answer and sends nothing. It counts per kind (a password link, a
  sign-up link, a change of email), so a new reader can confirm their
  address and ask for a new password straight after.
- **No limits per IP address.** nine turtles sits behind Render's proxy and
  can't reliably tell where a request comes from (the same reason as
  sign-up's whole-app cap, decision 0087); the limits count each address
  instead, wherever the requests come from.
- **Change email** in Settings already closes its sheet once the link is
  sent and says so once in Settings; the minute's gap covers a quick second
  try there too.
