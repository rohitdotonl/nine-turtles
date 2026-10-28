# 21. Sharing

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

**What it does**
- Only in the article view, in its More (…) menu (at the right of the top bar on a computer, in the bottom bar on a phone).
- On phones: the system share sheet. On desktop: **Copy link**.
- Always shares the publisher's original link, never a nine turtles link, without its tracking tags (`utm_…` and the like, section 7).
- No buttons for specific platforms.

**How to check it**
1. On desktop, choose Copy link in the article's More (…) menu and paste somewhere: it's the publisher's address, with no `utm_…` part.
2. On a phone, choose Share in the More (…) menu: your phone's usual share sheet opens with the publisher's link.
