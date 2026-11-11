# 0258: The last detail

**In one line:** What arrives from outside is shown with care: the byline's name is a link that wraps as text, Write back is one short button with "to {name}, {address}" under it, a broken picture, an embedded frame and a wide table each say so in a quiet line, a feed's name loses the words that only say it's a feed and twice-coded symbols in titles show as themselves, and the chosen page shows from the first moment, with "Opening your reading…" after a second

*11 November 2026.*

The fresh critique of principle 7, "Made by a person, to the last detail"
(a page for the owner, kept outside this repository), found that what nine turtles controls was designed (waiting,
offline, empty lists, errors, other scripts, large text), and that what
was left was what real feeds send in. Rohit chose four of its five ideas
(1, 2, 4 and 5; not 3, folding a busy feed) on 11 November 2026.

**Decision.**

1. **The line under the title holds a long name.** The followed writer's
   name under an article's title was a button, which a browser lays out as
   one block: a long name sat as a centred block of its own and "· author ·
   date" dropped underneath. It is now a link to their page (`/people/5/about`),
   wrapping as text, so the line reads as one sentence; a plain click opens
   their page in place as before, Command-click or a middle click a new tab.
   Its 44px touch height stays (an inline link's padding never moves its line).
2. **Write back is one short button.** At an article's end it says
   "Write back", with "to Maya Chen, maya@example.com" in the small muted
   line under it (only the name when no address is known). With the name
   inside it, a long name swelled the button to three centred lines on a
   phone. Screen readers still hear "Write back to Maya Chen". On their page
   it still says "Write to Maya Chen".
3. **What didn't arrive says so.** A picture that fails to load becomes the
   offline copy's quiet line: "A picture didn't load: *its description*.
   See it on the original", with the open arrow. An embedded frame other
   than YouTube's (which already became a link, decision 0072) becomes
   "Something from openstreetmap.org is embedded here. Open it", linking
   the frame's own address. The server, as it cleans the article, keeps
   only an empty link to the frame (ENGINEERING.md → "Sanitizing article
   content"); the web app writes the words, so they're never stored and
   search, rules, an untitled post's opening and the article's language
   never see them. Invisible frames and known trackers leave nothing. Each
   note's link is drawn as every link out of nine turtles is: the open
   arrow, "Opens in a new tab" for screen readers, 44px to press. A
   table wider than the column says "Scroll the table sideways to see all
   14 columns." ("Swipe" on a touch screen) and can be reached by Tab to
   scroll; tables and code blocks show a thin bar where the system shows one.
   Only articles arriving from now on get the frame's note: there's no pass
   over stored articles. (The critique's idea 1 is points 1 and 2 here,
   its idea 2 is point 3, and its ideas 4 and 5 are points 4 and 5.)
4. **Names and titles, tidied.** A feed's own name loses the words that only
   say it's a feed, once, as it's read (`feed/names.rs`): "Blog – Pete's
   Site » Latest Posts" is "Pete's Site", "Posts on Small Kitchen" is "Small
   Kitchen", "Maren Holt's Blog RSS Feed" is "Maren Holt". A name made only
   of such words stays whole. A reader still calling a feed (or a
   person it's one place of) by its untidied name gets the tidy one at its
   next check; a name they gave or brought
   from another app under another name stays. A title whose symbols were
   coded twice (`&amp;amp;`, `&amp;#8217;`, `&lt;em&gt;`) shows them as
   themselves, its formatting tags dropped; a title with nothing coded is
   left exactly as it came, so one about `<video>` keeps it.
5. **The first moment is the reader's page.** A few lines written into
   index.html read the page saved on the device and set it before anything
   is drawn, so Paper or Night never opens white first (Match device was
   already right, from the stylesheet). After a second without the app,
   "Opening your reading…" shows where a list's title will be; the app
   takes its place, and screen readers hear it (a status line). The script
   is allowed by its fingerprint in the Content Security Policy, checked by
   a test: a change to a Part 3 security rule, which the owner was asked
   about before it went live.

**Why.** Each of these is something a reader saw every day as a broken app,
though the fault was the publisher's or the connection's (principle 7,
"Is any state left to chance?"). None changes what nine turtles fetches,
and nothing moves (principle 8).

**Not chosen:** folding the rest of a busy feed's day into one line in a
list (idea 3).
