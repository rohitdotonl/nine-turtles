# 0067: WebSub, instant updates from publishers who offer them

*25 October 2026. Asked for by the owner (V2, Milestone 12; SPEC section 12).*

**Decision.** When a feed names a WebSub hub, nine turtles subscribes to it,
so new articles arrive within minutes instead of at the next check.

- **Where hubs deliver:** `NINE_TURTLES_PUBLIC_URL` + `/websub/{token}`. The
  container image sets the address to `https://app.nineturtles.app`, so the
  live app needs no new setting on Render. A copy without the setting (a
  computer, the tests) never subscribes, so it can't ask hubs to deliver to
  an address that isn't its own.
- **One random token and one random secret per feed,** in a new `websub`
  table (structure change 7, which only adds the table). The token makes
  the address unguessable; the secret signs each delivery.
- **Verification:** only a `subscribe` check for a known token *and* its own
  topic is confirmed (the challenge is sent back). `denied` is noted.
  nine turtles never confirms an `unsubscribe` while it follows the feed.
- **Signatures:** a delivery without a correct `X-Hub-Signature` is ignored
  but still answered 202, as the standard asks. The comparison takes the
  same time however much matches. Libraries: `hmac`, `sha1` and `sha2`
  (RustCrypto, the family argon2 and blake2 come from), approved by the
  owner on 25 October 2026; they were already in the lock file through
  other libraries.
- **Fat and thin pings:** a delivery holding articles stores them at once
  (as a check would). One that doesn't (some hubs only say "it changed")
  makes the feed due, costing the publisher one ordinary check, never
  sooner than 30 minutes after the last one.
- **Leases:** nine turtles asks for 10 days and believes between an hour and
  30 days. It renews a day before the end, at most once a day, five per
  round. A hub that never confirms, or let a lease run out, is asked again
  once a week.
- **Backup polling:** while a lease is active, the regular check waits at
  least 12 hours (its own rhythm if that's longer, up to a day).
- **Unsubscribing:** deliveries for a hidden feed are refused (404) at once;
  its `websub` line is deleted when the feed is cleared. nine turtles doesn't
  send hubs an unsubscribe request: the lease simply runs out within 10
  days, which keeps the code smaller and loses nothing.
- **Logs** name the feed by number only, never its address.

**Rejected.** Writing the signature maths by hand (more to trust, not the
boring choice). Reading hubs from the HTTP `Link` header too: feeds name
their hub inside the file in practice, and it can be added later if a real
feed needs it. A setting on Render for the address (agents can't reach
Render; the image is in the repository and reviewed).
