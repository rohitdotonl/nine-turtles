# 0010: How sign-in works

*October 2026, Milestone 2. Password method and libraries approved by the owner.*

**Setting the password.** The owner runs `slowfeed set-password` in Render's
Shell tab and pastes the printed line (the argon2id scramble, with its own
random salt) into `SLOWFEED_PASSWORD_HASH`. The readable password is never
stored anywhere. Typing is hidden with the system's `stty` command rather
than a library. Until the setting exists (or if it's garbled), slowfeed runs
but refuses every sign-in, so nobody can claim it during setup. Rejected:
the readable password as a setting (it would sit in Render's dashboard), and
a "choose your password" page on first start (anyone could get there first).

**Signed-in devices.** A successful sign-in gives the device a 32-byte random
ticket (from `getrandom`) in a cookie that is `HttpOnly` (scripts can't read
it), `Secure` (only sent over HTTPS) and `SameSite=Strict` (never sent from
other sites). The `sessions` table keeps only a BLAKE2s scramble of the
ticket, so a stolen database can't be used to sign in. A device stays signed
in for a year from its last use, renewed at most once a day. Signing out ends
that device only. Rejected: tickets signed with a secret key (needs another
secret to manage, and can't be ended one device at a time).

**Wrong passwords.** Counted for the whole app, not per device or network
address: there's only one password, so guesses from everywhere count
together. Five free tries, then waits of 1, 2, 4… minutes, at most an hour; a
right password resets the count, and so does an hour with no wrong tries
(counted from the end of any wait), so old guesses don't cost the owner their
free tries. Tries are checked one at a time so parallel guesses can't slip
past. The cost: a guesser can make a *new* device wait, and one who keeps
guessing about once an hour can keep that up; devices already signed in are
unaffected. The count is kept in memory, so restarting slowfeed clears it,
and the owner's guide says so. Wrong tries are counted on the diagnostics
page but not kept as "problems", so they can't push real problems out of the
last 20.

**Other sites.** Every action (anything but reading) must come from
slowfeed's own pages: the browser's `Sec-Fetch-Site` or `Origin` header is
checked, a second lock behind `SameSite=Strict`. Every response carries a
strict Content Security Policy (only slowfeed's own scripts, styles, fonts
and connections), `nosniff`, `DENY` framing, no referrer, and HSTS.

**Logging.** slowfeed's own small `log` module prints plain lines, which
Render shows in its Logs tab, and remembers the last 20 problems for the
diagnostics page. The approved `tracing` library needs a companion
(`tracing-subscriber`) to print anything; both wait until logs get busier
(feed fetching, Milestone 8), when they'll be proposed again.

**Revisit if:** passkeys arrive (DESIGN.md plans them for later), or more
than one person ever uses one installation.
