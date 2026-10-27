# 29. Paying for nine turtles

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

*Built in V2 (26 October 2026, decision 0094), in Dodo Payments' test mode: no real money until the owner applies to Dodo and switches to live. On only while the Dodo settings (`NINE_TURTLES_DODO_*`) are set; without them nobody pays and nothing below happens.*

**Who pays**
- **Never the owner, and never anyone with an account on the day this part went live** (26 October 2026; they are marked free for good). Readers who join after that, even while payments are still switched off, have the trial below once payments are switched on. Everyone who joins later has a **free trial**, 14 days unless the owner sets another length, from the day they joined (or from the day payments were switched on, if that's later). No card is asked for to start.
- After the trial: **one plan, everything included**, monthly or yearly, at the prices the owner sets (shown as "Price to be decided" until then). Payments are taken by Dodo Payments, the merchant of record (decision 0083): it takes the card, adds any sales tax and sends receipts. nine turtles never sees a card.

**Settings › Your plan** (for every reader but the owner, and not for readers who are free)
- One row says where you stand, in a few words with a line under it: **Free trial** ("Your trial ends on 9 November 2026."), **Monthly plan** or **Yearly plan** ("Renews on 26 November 2026.", or after cancelling "Cancelled. It lasts until 26 November 2026."), **Your last payment didn't go through** ("Update your card under Billing by 2 November 2026 to keep your plan."), or **Your free trial or plan has ended** (what still works, below).
- While you have no plan renewing: **Monthly · price** and **Yearly · price** rows (Yearly only once the owner sets up a yearly plan), each opening Dodo's checkout page in the same tab. Choosing a plan during the trial keeps the trial's remaining days (rounded up to a whole day): the first charge never comes before the day the trial would have ended. Dodo sends you back to Settings; if you've just paid, it can take a minute to show.
- Once you've bought a plan: **Billing and cancelling**, which opens Dodo's own page for your card, receipts and cancelling. Cancelling is yours to do, any time, with nobody to ask (the website's refunds page says so).
- The words under the group say Dodo takes the card and nine turtles never sees it. In test mode, one more line says no real money is taken and gives Dodo's test card number.
- Nothing about the plan appears anywhere else in the app: no banners, no countdowns, no emails about the trial (the "Never" list).

**When a payment fails or a plan ends**
- A renewal that doesn't go through keeps your plan for **7 days** while Dodo tries the card again. A cancelled plan lasts to the end of what you paid for.
- **Once the trial or plan has ended,** you still read, star, search and export everything you have, change settings, and can delete your account. You **can't add feeds** (the Add field, an OPML file or another app say "Your free trial or plan has ended. Choose a plan in Settings to add feeds again."), and your feeds are checked **once a day**, as for a reader who has been away for a month (section 11): a feed someone current also follows is still checked as usual. Newsletters keep arriving, new senders included (they cost nothing to fetch). Choosing a plan brings everything back at once: adding works again and the feeds are due for a check within minutes.
- **Deleting your account cancels your plan first.** If Dodo can't be reached just then, nothing is deleted, so nobody is charged for an account that's gone.

**The owner's Readers page** shows each reader's plan under their line in a few words ("Free trial", "Monthly plan", "Plan cancelled", "Payment didn't go through", "Plan ended"), never what they paid. Readers are told so under Account in Settings and in the privacy policy.

**How it works:** nine turtles asks Dodo for a checkout page (with the reader's email and number), and Dodo tells nine turtles about each subscription in signed messages (webhooks) at `/payments/dodo`. A message without Dodo's signature, or more than five minutes old, is ignored; one sent twice changes nothing, and neither does one older than the last kept for that subscription, or the end of an earlier subscription once the reader has bought a new one. Deleting an account waits only when Dodo can't be reached; if Dodo answers that the plan is already over, the account goes. nine turtles keeps its own record of each reader's subscription, so moving to another payment company stays possible. Setup: `docs/operations/payments.md`.

**How to check it** (test mode, after the setup steps)
1. Sign up as a new reader: Settings › Your plan says "Free trial" and when it ends.
2. Press Monthly: Dodo's test checkout opens. Pay with `4242 4242 4242 4242`, any future date and any three digits. Back in Settings, within a minute it says "Monthly plan" and when it renews.
3. Press Billing and cancelling and cancel: Settings says "Cancelled. It lasts until …".
4. Signed in as yourself (the owner), Settings has no plan group, and the Readers page shows the new reader's plan.
