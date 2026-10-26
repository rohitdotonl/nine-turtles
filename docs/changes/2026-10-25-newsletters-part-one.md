## 25 October 2026: Newsletters, part one

- nine turtles can now read newsletter emails: it works out which newsletter
  sent each one and cleans it for reading (hidden preview text, tracking
  images, tracking parts of links and email layout tables go; pictures,
  links and real tables stay). It's tested on made-up emails built like
  Substack's and Mailchimp's, plain-text ones and Japanese ones.
- The address that receives them is switched off until you set
  `NINE_TURTLES_NEWSLETTER_SECRET`. Even then nothing is kept yet: emails are
  read and passed back to your inbox. Keeping them, and each reader's own
  address, come in part two, after many readers is finished.
- The small forwarder that runs at Cloudflare is in the repository
  (`cloudflare/newsletter-worker/`), with the setup steps in
  `docs/operations/newsletters.md`.
