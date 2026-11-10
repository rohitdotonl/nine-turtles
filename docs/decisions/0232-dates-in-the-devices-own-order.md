# 0232: Dates in the device's own order and clock

*10 November 2026.*

Rohit's "implement all suggestions from rounds 1 and 2 except P03-8"
(10 November 2026), suggestion P03-2 of the critique through the principle
"Fit what people already do". It revises point 3 of decision 0215.

**Decision.** Every date and time in the app is written the way the reader's
device writes them, read from its language and region settings:

- **The order of day and month.** A device that puts the month first (the
  United States, Canada, Japan) gets "Oct 20" and "Oct 20, 2025"; every other
  "20 Oct" and "20 Oct 2025", as before.
- **The clock.** A 12-hour device gets "2:05 PM" ("2:05 pm" where the day
  comes first, as in Australia); a 24-hour one "14:05", as before. The
  tooltip's exact time follows both: "Sunday, November 8, 2026 at 6:00 AM".

What 0215 settled stays: one form for every date, months always three
letters (September too), the year only when it isn't this one (always on
things that last), and "Today", "Yesterday" and the weekday first
(decision 0218). The words stay English, the interface's language, on a
device set to another language: only the order and the clock come from it.

**Why.** People read dates in the order they grew up with; "10/11" means
two different days on two sides of the Atlantic, and "20 Oct" makes an
American stop for a moment, as "Oct 20" would a Briton. Following the device
is what every app they use already does.

**How.** `web/src/lib/times.ts` asks the browser once how the device orders a
numeric day and month and whether its clock is 12-hour, then writes with
English month names in that order. Unit tests start each case as a British
device (`web/tests/unit-setup.ts`) and try American, German and Australian
ones; the browser tests run as a British device (`web/playwright.config.ts`),
and one runs as an American one (`web/tests/plan.spec.ts`). The server's own
words (the weekly email) are unchanged.
