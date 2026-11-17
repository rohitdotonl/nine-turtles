# 21. Sharing

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

**What it does**
- In the article view, as **Share** (Apple's box with an arrow on a Mac, iPhone or iPad; three linked dots elsewhere), on a computer the first row of the article's More (…), its key `c` one press from the text (decision 0299); on a phone one press from the text, in the bottom bar, where Aa was (decision 0293). A row's own menu has it too (section 6).
- On phones: the system share sheet. On desktop: **Copy link**.
- Always shares the publisher's original link, never a nine turtles link, without its tracking tags (`utm_…` and the like, section 7).
- No buttons for specific platforms.

**How to check it**
1. On desktop, open More (…) above an article, choose Copy link (or press `c`) and paste somewhere: it's the publisher's address, with no `utm_…` part.
2. On a phone, tap Share in the bottom bar: your phone's usual share sheet opens with the publisher's link.
