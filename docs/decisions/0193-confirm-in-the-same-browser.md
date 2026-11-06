# 0193: Confirm sign-up in the same browser with one press

*6 November 2026.*

**Decision.** Changes decision 0154. Opening the "Confirm your email" link
in the browser that signed up asks no password: the page holds only
**Confirm email**, and pressing it makes the account, signs in and opens
nine turtles on its welcome. Anywhere else (another browser or device) it
asks the password chosen at sign-up, as before. Either way there's no
"You're signed up" stop any more: the app opens straight away. (The owner's
onboarding review, finding 3; Rohit said go on 6 November.)

**How.** Pressing Sign up sets a cookie of its own in that browser
(`nine_turtles_sign_up`): a random secret, HttpOnly (the page's code can't
read it), Secure, SameSite=Lax, sent only to `/api/sign-up`, gone after
the link's 24 hours, and cleared once the account is made. Only its
scrambled copy is kept, with the waiting sign-up
(`email_links.browser_hash`, migration 0044). The page asks
`/api/sign-up/check` whether this browser holds the secret, which uses
nothing up; a mail program checking links has no secret, and nothing
happens until Confirm email is pressed.

**Why it stays safe.** 0154 asks the password so a stranger who signs up
with your address can't make the account theirs, or yours with their
password. That still holds: the stranger's browser holds a secret, but
they never get the link; you get the link, but your browser holds no
secret of theirs, so you're asked your password. Every other limit stays:
one use, 24 hours, the address's three newest sign-ups, the hourly caps.
Sign-ups from before this change have no secret; their links ask the
password.

**The one case it gives up, accepted.** On a browser two people share (a
family computer, a library's), a stranger who signed up there with your
address within the last 24 hours leaves their secret in it. If you then
open your own link in that same browser, without having signed up from
it yourself, their secret picks their sign-up, and the account is made
with their password. Before, your password picked yours. It needs the
stranger at your browser and you confirming there within a day, so it's
accepted for one press everywhere else; you'd notice at once, as your
password wouldn't work, and Forgot? gets the account back by email.

A browser keeps one secret for all its sign-ups (a new one only when it
has none), so a link sent before "Use another email" still needs only one
press there.
