# 0094: Paying for nine turtles, built in Dodo's test mode

*26 October 2026. Milestone 9 of the plan for 100 to 200 readers (decision
0086). Built overnight under the owner's go-ahead; the open choices are in
`docs/planning/questions.md`.*

## Decision

- **Who pays:** never the owner, and never anyone with an account before
  payments (structure change 18 marks them `free`). Everyone else has a
  free trial (`NINE_TURTLES_TRIAL_DAYS`, 14 unless set) from when they
  joined, or from when payments were first switched on if later
  (`settings.payments_on_at`), with no card asked for. Then one plan,
  monthly (and yearly if a yearly product is set), at prices that are
  settings (`NINE_TURTLES_PRICE_*`), shown as "Price to be decided" until set.
- **Dodo does the money** (decision 0086): nine turtles asks Dodo's API for a
  checkout session (`POST /checkouts`, the reader's email, `metadata.person_id`,
  `return_url` Settings, and the trial's remaining whole days as
  `subscription_data.trial_period_days`), and for a customer-portal session
  for Billing and cancelling. Test mode (`test.dodopayments.com`) unless
  `NINE_TURTLES_DODO_MODE=live`.
- **Dodo's messages (webhooks)** arrive at `POST /payments/dodo`, checked the
  Standard Webhooks way: HMAC-SHA256 of `id.timestamp.body` with the key in
  the `whsec_…` secret, base64, any `v1,` signature matching, at most five
  minutes old. Their ids are kept 90 days (`payment_messages`) so a repeat
  changes nothing. Only `subscription.*` messages change anything; the
  reader is found by the subscription already on record, else by
  `metadata.person_id` while that reader's email still matches the
  customer's (a deleted reader's number can be reused), else by the
  customer's email. A message older (by its own `timestamp`) than the last
  one kept for that subscription (`plans.message_at`) is ignored, and so is
  the end of an earlier subscription while a newer one gives access; two
  live subscriptions for one reader are logged as a problem for the owner.
- **Our own record** (`plans`, one row per reader): Dodo's subscription and
  customer ids, status, period, next charge, whether it's ending, and
  `access_until`: the next charge plus 7 days (`GRACE`) while active, 7
  days from the first failure while on hold, the end of what was paid once
  cancelled, now once expired or failed.
- **Once a plan has ended**, the reader keeps reading, starring, searching
  and exporting; they can't add feeds (`402 plan-ended`), and their feeds
  count as away (checked once a day) unless someone current follows them.
- **Deleting an account** cancels its subscription at Dodo first
  (`PATCH /subscriptions/{id}`, `status: cancelled`); if Dodo can't be
  reached (or answers 5xx, 401, 403 or 429), nothing is deleted. If it
  answers 400, 404, 409, 410 or 422 (already over, or unknown), the account
  goes and a problem is logged.
- **A plan starting again** brings the reader's working feeds forward
  (`admin::due_again`, shared with a reader coming back after being away).
- **No new library:** reqwest, hmac and sha2 were already approved; base64
  (about 40 lines) and reading ISO 8601 times are written by hand in
  `payments.rs`, with tests (including the Standard Webhooks example).

## Why

- A trial without a card is the calm choice: nobody is charged by surprise.
  Keeping reading and exports after a plan ends follows "your data is
  yours" and the plan's promise that cancelling keeps everything readable.
- Everything about the card stays with Dodo, the merchant of record; nine
  turtles only keeps who has which subscription, so moving away stays
  possible (decision 0086's risks).
- Test mode first, because Dodo approves live payments only once the site,
  prices and legal pages are final.

## Revisit if

The owner chooses another trial length, wants readers asked for a card at
sign-up, wants an ended plan to stop new articles entirely, or Dodo's API
changes (its messages are the one place it can quietly differ from what's
written here).
