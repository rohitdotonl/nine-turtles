# The newsletter forwarder

A tiny program that runs at Cloudflare (a "Worker"). Cloudflare Email Routing
hands it each email sent to nine turtles' newsletter addresses, and it posts
the email to nine turtles. Everything else (reading the email, cleaning it,
filing it under a feed) happens in nine turtles itself, so this can be
swapped for any mail service that can post an email to a web address.

- `worker.js`: the program. Its comments say what it does with each answer.
- `wrangler.toml`: its settings, for Cloudflare's command-line tool.
- The steps to set it up: `docs/operations/newsletters.md`.
- Its test: `scripts/check-newsletter-worker.mjs`, part of `scripts/check.sh`.
