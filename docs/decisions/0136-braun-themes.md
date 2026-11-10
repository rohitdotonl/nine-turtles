# 0136: Five themes after Braun's colors

**In one line:** Five themes after Braun's colors (Brushed, Anodised, Fountain pen, Heather, Signal); their bright accent, only the unread dot, held to 3 : 1. Partly replaced by 0145: only Fountain pen and Signal remain; all replaced by 0176

*Partly replaced by [0145](0145-four-themes.md) (2 November 2026): Brushed, Anodised and Heather retired; Fountain pen and Signal remain, and the 3 : 1 rule for their accent still holds.*

*1 November 2026.*

**Decision.** Five new themes join Original and Plain, each with a day and
a night version: Brushed, Anodised, Fountain pen, Heather and Signal. The
owner picked them from ten colour mockups based on Dieter Rams' Braun
products. Each is a neutral body whose one color is its accent, the unread
dot: orange in Anodised and Fountain pen, petrol blue in Brushed, ochre in
Heather and indigo in Signal. None is green or red (the owner, 2 November
2026): green means only a starred article's star, red only "this removes
something", and red and green are the colors most often confused. Their
bright accent is held to 3 : 1, WCAG's contrast for marks,
instead of the 7 : 1 the other accents reach (Exceptions log). The themes'
colors move from `app.css` to their own file, `web/src/themes.css`.

**Why.** The owner wants an iconic look in Rams' spirit: one small signal
color on a neutral body, like the single colored control on a Braun radio.
A bright orange or ochre can't reach 7 : 1 without turning brown, and
the accent is never text, only a dot and a faint tone behind search
matches, so the owner chose 3 : 1 (1 November 2026). Everything else
(text 7 : 1, muted grey 4.5 : 1, the pill, focus outlines) is unchanged
and checked automatically.

**The download budget.** Seven themes took the app's download just past its
150 KB budget. The owner raised the budget to 200 KB (2 November 2026);
`scripts/check-size.mjs`, `docs/ENGINEERING.md`, `docs/spec/25-speed.md`
and `docs/operations/checks.md` say so.
