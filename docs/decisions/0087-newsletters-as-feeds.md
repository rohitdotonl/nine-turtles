# 0087: Newsletters as feeds

*25 October 2026. Milestone 10 of the plan for 100 to 200 readers
(https://claude.ai/artifact/V3GhrBxfXDG1TjPMsXQFPk). The owner approved the
feature, Cloudflare Email Routing, the mail-parser library and the change to
DESIGN.md's "is not" list on 25 October 2026.*

**Decision.** Newsletters arrive as feeds. Each reader will get a private
address at `in.nineturtles.app`; the first email from a newsletter makes a
feed for it, and every email is an article, read, starred and searched like
any other.

**How the email gets in.** nine turtles only talks over the web, so a mail
service receives the email and posts it to nine turtles:

- **Cloudflare Email Routing** (free, already holding the domain) receives
  every email for `in.nineturtles.app` (a "catch-all") and hands it to a
  small **Worker**, `cloudflare/newsletter-worker/worker.js`, kept in this
  repository.
- The Worker posts the email, whole and unchanged (the standard raw form),
  to `/newsletters/incoming`, with a shared secret
  (`NINE_TURTLES_NEWSLETTER_SECRET`) as its key. Without the secret the
  address doesn't exist.
- **No lock-in:** nine turtles accepts standard raw email from anything that
  can post one, so Cloudflare can be swapped for another service (Mailgun,
  Postmark, a small mail server) by replacing only the Worker.
- **Nothing is lost:** only a "200 OK" from nine turtles means "kept". On
  any other answer the Worker passes the email to an ordinary inbox
  (`FORWARD_TO`) if one is set; otherwise it bounces an email nine turtles
  refused and asks for one it couldn't deliver to be sent again later.

**How the email is read** (`server/src/newsletter.rs`, with mail-parser):
the sender is the feed (the mailing list's `List-Id` if it has one,
otherwise the From address), the subject the title, the Message-ID the
fingerprint, the HTML (or plain text) the content. Before the same safety
cleaning as feed articles, the email is tidied for reading: hidden preview
text, Outlook-only parts, styles, attached (`cid:`) images, tracking images
and the tracking parts of links go; tables used only for layout become
plain blocks (a table with headings stays); the "View in browser" link
becomes the article's "Open original".

**The publisher floor.** A newsletter is what its publisher sent: nine
turtles shows only what the email holds, credits the sender and links its
web version when it names one. It never fetches the web version or
anything else.

**In parts, because many readers is still being built** (decision 0086):

- **Part one (this change):** the Worker, reading and cleaning emails (with
  tests on made-up newsletters built like Substack's, Mailchimp's and
  others), and the address that receives them, off by default. When
  switched on it reads each email and answers what it would become ("202
  Accepted"), but keeps nothing yet. No database change.
- **Part two (after many readers is finished):** each reader's own address
  (with a Copy and a New address button in Settings), storing emails as
  articles under a feed per sender, limits per reader (emails per day, size)
  and the disk space they take.
