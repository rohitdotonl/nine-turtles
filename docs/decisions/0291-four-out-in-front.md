# 0291: The website's other pages wear "four out in front"

**In one line:** On every website page but the front page, the top shows the name "nine turtles" with the nine walking on it (five on the letters, four ahead of the name) instead of the nine before it; the front page, the app and the app icon keep the nine.

*16 November 2026. The owner: "Keep the 'turtle' icon the same. Can you show me how you can add nine turtles around the name (I will use that on website, not home page)." He picked "four out in front" from the mockups and said "get this one shipped".*

**What changes.**
1. **The drawing** (BRAND.md → "The logo"): today's turtle, unchanged, nine
   times. Five on the letters (the two n's, the u, the l, and the e of
   "turtles", which climbs its curve), a small gap off them; four on the
   baseline after the s, walking ahead, as if on the frontier. The i keeps
   its dot. Positions were measured from Literata 600's own outlines at 60px;
   the drawing is `docs/logo/four-in-front.svg`.
2. **Where:** the website's top (`website/src/_includes/base.njk`) on every
   page but the front page. The front page keeps the nine before the name.
3. **Size:** the name 28px on tablets and computers, so the turtles read;
   today's 22px on a phone, so Help and Open the app stay on one line. The
   owner didn't pick, so the designer's suggestion stands.
4. **Built to last:** the name stays real text (screen readers hear "nine
   turtles"; the turtles are hidden from them). The turtles are one SVG in
   the name's own units, pulled back over the name, so they keep their
   places at any size. Literata 600 is preloaded on those pages so the
   turtles never land on a stand-in font's letters.

**Why it's an exception.** BRAND.md said the turtle "never acts"; here the
nine walk and one climbs. The owner chose it, for the website only, where the
name is shown once at the top of a page.
