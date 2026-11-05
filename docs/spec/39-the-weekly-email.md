# 39. The weekly email

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.
Decision 0150; the shape agreed with the owner on 2 November 2026 (PLAN.md →
V1, item 5; decision 0140). Once a week or off since 5 November 2026
(decision 0184). Its look gets a refinement round.*

**What it does**
- **The one exception to "no notifications"** (decision 0140): one plain
  email, chosen by the reader, that ends, and stops in one press. It's
  **off** until the reader turns it on. nine turtles never offers it at
  setup, and never asks again.
- **Settings › Account › Weekly email,** right under Email: a **switch**,
  like Unread's, off or on (once a week; Twice a week went, decision
  0184). The line under its name says what it is ("Once a week: the people
  you read, their titles and a line each, in one plain email.") and, once
  on, when it comes ("Saturday mornings: …"). It
  shows only while nine turtles can send email and the reader has an email
  address; it follows the reader to every device.
- **Only to a confirmed address** (decision 0154): signing up confirms
  it, and so do confirming a changed email and signing in with an emailed
  link. An account made while nine turtles couldn't send email has none, so
  switching it on there says "The weekly email goes only to a confirmed
  address. Signing in once with an emailed link (Forgot? on the sign-in
  page) confirms yours." This keeps anyone from having it sent to someone
  else.
- **When it comes:** Saturday at 08:00, the reader's time. "The reader's
  time" is the device's clock when they switched it on, so after a move or a
  summer-time change it may come an hour off until they switch it off and on
  again. The first one comes the next Saturday morning after it's turned on.
- **Readers who had chosen Twice a week** have it on Saturday mornings now,
  and their next email says so once, under its first line: "This email now
  comes once a week, on Saturday mornings, instead of twice."
- **What it says** ("New from the people you read", from nine turtles,
  signed by Rohit like every email, BRAND.md → Emails): "Here's what the
  people you read wrote this week."; then each person or publication with something unread that arrived
  since the last one (never more than a week back), by name, A to Z (a
  person with several sources is one, section 36). Under each name, their
  newest titles, at most three, each with the first line of its words, cut
  at about 140 characters, and the publisher's own link. At most 30 people.
  When there's more than it shows, one line: "The rest is in nine
  turtles." **Never a count:** no number of articles, people or days.
- **Nothing new, nothing sent.** Articles already read, muted (section 27)
  or from sources the reader no longer follows never appear.
- **Plain text,** no pictures, no tracking, no logo. Its only links are the
  publishers' own, nine turtles' front page, and the stop link.
- **Off in one press:** the email ends "You turned this email on in
  Settings. To stop it, open this link and press Stop:" with a link to a
  page that says "Press Stop to turn the weekly email off." and one button,
  **Stop the weekly email**. Pressed, "The weekly email is off. No more will
  come. You can turn it on again in Settings." It works signed in or not, on
  any device, and shows "Stopping…" while it works. Nothing happens until
  Stop is pressed, so a mail program that opens links to check them can't
  stop it. The link of each of the last ten emails works; turning the email
  off makes all of them spent. Switching it off in Settings does the same. A
  link that no longer works says so ("This link no longer works: the email
  is already off, or the link is from an older email. If weekly emails still
  come, turn them off in Settings."), never that it stopped something.
- **Each reader's own:** what it lists is only theirs. It's sent at most
  once for each morning, even if nine turtles restarts.

**How to check it**
1. In Settings › Account, under Email, the Weekly email switch is off.
   Switch it on: the line under it says Saturday mornings. Reload: it's
   still on, on every device you're signed in on. There's no Twice a week.
2. Follow someone who writes often and leave a few of their articles
   unread. On Saturday morning an email comes with their name, their
   titles, a line each and links, and no number anywhere.
3. In that email, open the stop link: the page shows one button. Press it:
   "The weekly email is off." In Settings its switch is off.
4. On a nine turtles without email set up, Settings has no Weekly email row.
