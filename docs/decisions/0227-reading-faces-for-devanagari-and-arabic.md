# 0227: Reading faces for Devanagari and Arabic

*9 November 2026. Approved by the owner ("just implement your suggestions"),
the bold choice of OS-5 in the "other scripts" critique.*

**What we decided.** Literata has only Latin letters, so Hindi and Arabic fell
back to the device's sans-serif, and an English article was set in a book face
while a Hindi one was set in something closer to a sign. Two free faces (SIL
Open Font License) now follow Literata in `--font-serif`: **Noto Serif
Devanagari** and **Noto Naskh Arabic**, the book style of Arabic. Each is one
variable file (every weight), limited by `unicode-range` to its script's
letters, so a browser downloads it only for a page that shows them.
Chinese, Japanese and Korean fonts run to megabytes, so those scripts keep the
device's own, as do all others.

**The size budget.** The 400 KB font budget is for fonts any reader may
download. These two are downloaded only by readers of those scripts, so
`scripts/check-size.mjs` gives each its own budget of 150 KB (Devanagari about
124 KB, Arabic about 92 KB) instead of adding them to the shared one.
