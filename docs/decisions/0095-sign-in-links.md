# 0095: "Email me a sign-in link"

*26 October 2026. The owner asked for it in their list of next things to
build, with a yes to merging.*

**Decision.**

- **A link that signs in.** While nine turtles can send email, the sign-in
  page offers **Email me a sign-in link**. It emails a link that signs the
  device that opens it in. It's for every reader, the owner too once they've
  saved an email. Passwords keep working exactly as before; nothing about
  them changes.
- **Once, within 15 minutes.** Short, because whoever holds the link is
  signed in, without a password. It's used up when used, stops working once
  a new password is set, and stops working if the reader's email changes
  (it must still be theirs).
- **One press on its page.** The link opens a page with a **Sign in**
  button, as the confirmation link does, so a mail program that opens links
  to check them can't use it up or sign itself in.
- **Said once, and no repeated sends** (decision 0092): the same "Check
  your email" answer as for a new password, whether or not the address has
  an account, the same quiet Send again, and the same limits on the
  server: one sign-in link a minute and three emails an hour to any
  address. A link that stopped working after 15 minutes still counts
  towards the hour.
- **Nothing else changes when it's used:** other devices stay signed in,
  and the password and app password stay as they are.
- **Structure change 19.** SQLite can't change a table's checks in place,
  so `email_links` is made again with the purpose `sign-in` allowed, every
  line copied across. nine turtles stores a backup first, as before every
  structure change (decision 0076). The table holds only links, which last a
  day at most.

**Not chosen.** Signing in straight away when the link opens (a mail
program checking links could use it up), and a longer life such as an hour
(a link that signs in is worth more to someone reading over a shoulder
than a password link, which still needs a new password).
