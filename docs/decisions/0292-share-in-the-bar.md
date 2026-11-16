# 0292: Share sits in the article's bar; Aa moves into More as "Text and page"

**In one line:** An article's Share (each platform's own icon: Apple's box with an arrow on a Mac, iPhone or iPad, three linked dots elsewhere) is one press from the text where Aa was, Aa becomes **Text and page** in More, and every item in the article's More has its icon before its words.

*17 November 2026. The owner, reviewing the reading experience against the New York Times' app: "instead of Appearance change, let's give the share button", then picked version 1 of ten mockups and asked for "the share icon … like that of nytimes", with icons added to the three-dot menu.*

**What changes.**
1. **Phone's bottom bar:** More · Share · (Write back) · Save | Previous · Next. Share takes Aa's place, so nothing else moves (SPEC section 20). It opens the phone's own share menu, or copies the link where there's none (section 21).
2. **Computer's top bar:** View original · Share · Save · (Write back) · More. Without a share menu, Share copies the link: screen readers hear "Copy link", its tooltip says "Copy link (C)", and `c` still copies.
3. **More:** Text and page (the reading panel, decision 0123), Mark unread, Add a note…, then apart Info about and Hide articles about…, each with its icon before its words (the way Write back's menu already draws them, decision 0286). Copy link leaves More, since Share does it. The panel opens under More, and Escape gives the keyboard back to More.
4. **The share icon** is each platform's own: Apple's box with an arrow on a Mac, iPhone or iPad (`apple.ts`), three linked dots (Android's, and the New York Times' there) everywhere else. The owner asked for the New York Times' icon; Claude pointed out the Times itself shows Apple's on iPhones, and the owner said "okay, do it".

**Why.** Sharing is what readers do most to an article besides reading it, so it earns a place one press away; text size is set once and seldom changed, so one more press is fine (it replaces decision 0241's "Aa one press from the text"). News apps put Share in the bar and text size in a menu; reading apps (Apple Books, Kindle) do the opposite. The owner chose the news apps' way.

**Why each platform's own icon.** People learn their device's share icon from every app they use, and both Apple's and Google's guidelines ask apps to use it.

**Revisit if** readers say they can't find text size.
