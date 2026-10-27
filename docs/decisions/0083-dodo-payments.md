# 0083: Dodo Payments takes payments, as merchant of record

*25 October 2026. The owner's choice. First numbered 0086, which many readers also took.*

## Decision

nine turtles will take payments through **Dodo Payments**, acting as
merchant of record: it is the legal seller, collects the money, handles
sales tax (VAT, GST) in every country, refunds and disputes, and pays out
to the owner. The owner, an individual in India with no registered
company, signs up as an Individual. Payments are built last, in Dodo's test
mode, and switched on only after Dodo approves the live website. The
website has pricing, terms, privacy, refunds and contact pages because Dodo
checks for them. The steps for applying are in
`docs/operations/dodo-application.md` until the owner applies.

## Why

- A merchant of record means no company and no tax filings in other
  countries.
- **Paddle** often turns down brand-new sellers for having "no processing
  history"; the owner's friend was refused. Worth revisiting after a few
  months of sales.
- **Stripe India** is invite-only and doesn't accept individuals for
  payments from abroad. **Razorpay** isn't a merchant of record, so the
  owner would handle tax everywhere.
- **Lemon Squeezy** is winding down into Stripe; Indian sellers are mostly
  paid through PayPal. **Polar** may not accept Indian individuals and is
  card-only.
- Fees: 4% + $0.40 a sale, plus 1.5% for foreign cards and 0.5% for
  subscriptions; payouts in USD/GBP/EUR to an Indian bank, $5 under $1,000.

## Risks and how we limit them

Some sellers report accounts closed after approval with money held for
about 120 days. We limit it with one product per account, no live-mode
self-tests, clear self-serve cancelling and refunds, frequent payouts, and
our own record of subscribers so we can move (Dodo offers a card export).

## Revisit if

Dodo refuses or freezes the account, its fees or payout terms change
much, or nine turtles has enough sales history for Paddle.
