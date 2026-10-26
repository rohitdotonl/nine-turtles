# 0092: "Check your email", once, and one password link a minute

*26 October 2026. The owner pressed Send link twice on "Forgot your
password?" and got two emails; the page also said twice that an email was
coming (the line under the field, then the answer under it), and the button
stayed there to press again.*

**Decision.**

- **Said once.** Once a link is asked for, the form gives way to **Check
  your email**: where the link went (in the same words whether or not the
  email has an account) and how long it works. The keyboard goes to the
  heading. Open sign-up's "A link to finish signing up…" does the same.
- **A quiet way to ask again.** Under it, "Didn't get it? Look in your
  spam folder." and **Send again**, a link in words, there from the start.
  Pressed within a minute of the last link it sends nothing and says to give
  it a minute. Nothing on the page changes by itself (no countdown, no
  button appearing later: nothing moves unless you move it).
- **One password link a minute, on the server too** (`EMAIL_GAP` in
  `accounts.rs`), on top of three emails an hour per address. A second press
  within the minute, from this page, another device or a script, gets the
  same answer and sends nothing. A change of email is held to it too.
  **Sign-up links aren't:** someone who signs up again to fix a mistyped
  password must get that password's own link (each link carries its
  password), and a new reader can confirm and then ask for a new password
  straight after. The hour's three still apply to everything.
- **No limits per IP address.** nine turtles sits behind Render's proxy and
  can't reliably tell where a request comes from (the same reason as
  sign-up's whole-app cap, decision 0087); the limits count each address
  instead, wherever the requests come from.
- **Change email** in Settings already closes its sheet once the link is
  sent and says so once in Settings; the minute's gap covers a quick second
  try there too.
