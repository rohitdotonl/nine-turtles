# 21. Sharing

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

**What it does**
- In the article view, as **Share** (Apple's box with an arrow on a Mac, iPhone or iPad; three linked dots elsewhere), one press from the text: in the top bar on a computer, beside Save; in the bottom bar on a phone, where Aa was (decision 0292). A row's own menu has it too (section 6).
- On phones: the system share sheet. On desktop: **Copy link**.
- Always shares the publisher's original link, never a nine turtles link, without its tracking tags (`utm_…` and the like, section 7).
- No buttons for specific platforms.

**How to check it**
1. On desktop, press Share ("Copy link") above an article and paste somewhere: it's the publisher's address, with no `utm_…` part.
2. On a phone, tap Share in the bottom bar: your phone's usual share sheet opens with the publisher's link.
