# 39. The weekly email

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.
Decision 0150; the shape agreed with the owner on 2 November 2026 (PLAN.md →
V1, item 5; decision 0140). Its look gets a refinement round.*

**What it does**
- **The one exception to "no notifications"** (decision 0140): one plain
  email, chosen by the reader, that ends, and stops in one press. It's
  **off** until the reader turns it on. nine turtles never offers it at
  setup, and never asks again.
- **Settings › Account › Weekly email,** right under Email: **Off**,
  **Weekly** or **Twice a week**, a segmented control like the Reading
  group's. The line under its name says what it is and when it comes. It
  shows only while nine turtles can send email and the reader has an email
  address; it follows the reader to every device.
- **Started from the address itself:** the first time it's turned on for an
  address, one email goes there, "Start your weekly email", with a link to a
  page with one button, **Start the weekly email**. Until it's pressed,
  nothing more is sent there, and the line under Weekly email says "Waiting
  for you: press Start in the email just sent to your address." (Sign-up
  never checks an address, decision 0115, so this keeps anyone from sending
  it to someone else.) At most one such email an hour; a changed email needs
  Start again; turning it off and on again for the same address doesn't.
- **When it comes:** Weekly is Saturday at 08:00, the reader's time; Twice a
  week is Wednesday and Saturday at 08:00. "The reader's time" is the
  device's clock when they chose, so after a move or a summer-time change it
  may come an hour off until they choose again. The first one comes on the
  next of those mornings after it's turned on.
- **What it says** ("New from the people you read", from nine turtles,
  signed by Rohit like every email, BRAND.md → Emails): "Here's what the
  people you read wrote this week." (twice a week, "since Wednesday" or
  "since Saturday"); then each person with something unread that arrived
  since the last one (never more than a week back), by name, A to Z (a
  person with several places is one, section 36). Under each name, their
  newest titles, at most three, each with the first line of its words, cut
  at about 140 characters, and the publisher's own link. At most 30 people.
  When there's more than it shows, one line: "The rest is in nine
  turtles." **Never a count:** no number of articles, people or days.
- **Nothing new, nothing sent.** Articles already read, muted (section 27)
  or from places the reader no longer follows never appear.
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
  off makes all of them spent. Choosing Off in Settings does the same. A
  link that no longer works says so ("This link no longer works: the email
  is already off, or the link is from an older email. If weekly emails still
  come, turn them off in Settings."), never that it stopped something.
- **Each reader's own:** what it lists is only theirs. It's sent at most
  once for each morning, even if nine turtles restarts.

**How to check it**
1. In Settings › Account, under Email, Weekly email shows Off. Choose
   Weekly: the line under it asks you to press Start in the email just
   sent. Open that email, press Start the weekly email: Settings now says
   Saturday mornings, on every device you're signed in on.
2. Follow someone who writes often and leave a few of their articles
   unread. On Saturday morning an email comes with their name, their
   titles, a line each and links, and no number anywhere.
3. In that email, open the stop link: the page shows one button. Press it:
   "The weekly email is off." Settings shows Off.
4. On a nine turtles without email set up, Settings has no Weekly email row.
