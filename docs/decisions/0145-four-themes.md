# 0145: Four themes

*2 November 2026.*

**Decision.** Seven themes become four: **Original**, **Plain**,
**Fountain pen** (the warm one) and **Signal**. Brushed, Anodised and
Heather retire. A reader who had chosen one sees its closest successor:
Brushed moves to Original; Anodised and Heather move to Fountain pen.
Their other choices (Appearance, reading font, size, width) stay as they
were. Brand decision in `docs/BRAND.md` → "Color".

**Why.** The owner, 2 November 2026: Anodised, Heather and Fountain pen
looked the same, and Brushed was too close to Original. Fewer themes that
each look clearly different (less, but better).

**How a saved choice moves.** A reader's theme is kept in their browser,
not on the server, so there's nothing to change in the database. Each time
the app reads the saved preferences, `savedTheme` in `web/src/lib/themes.ts`
turns a retired name into its successor (and anything unknown into
Original, as before). The old name stays in the browser until the reader
next changes a preference; it's harmless and always read the same way.
Nobody ever lands on a theme that doesn't exist.

Replaces the five-theme set of decision 0136; its 3 : 1 rule for the
Braun themes' accent still holds for Fountain pen and Signal.
