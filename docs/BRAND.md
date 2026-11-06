# nine turtles: the brand sheet

*Every brand decision on one page. Last updated: 6 November 2026 (decisions 0141, 0148, 0153, 0176, 0181, 0185, 0199).*

**How to use this page.** Every change a reader can see (in the app, on the
website, in an email, in a link preview) follows this page. This page is
part of [`DESIGN.md`](DESIGN.md) and has its standing: DESIGN.md Part 1 (the
floors and the principles) wins over it, and it wins over everything else
about the brand. Each line says one decision; the measurements behind it
live where the decision is built (mostly DESIGN.md Part 2), and this page
links there instead of copying them.

**Changing it.** Something new for the brand (a color, a typeface, a drawing,
a new use of the turtles, a new line of marketing copy) is added here first,
with Rohit's yes and the reason, before it's built. Never as a one-off.

**Live** means the app or website shows it today. **Being built** means Rohit
has decided it and the work is under way: build towards it, and don't build
anything that goes against it. Until it lands, DESIGN.md Part 2 describes
what's live.

## Name and words

- **The name** is *nine turtles*, always lowercase, even at the start of a sentence. At nineturtles.app. (Live)
- **The headline** is "Read people. Write back." (Live: the sign-in pages and the share picture. The website's front page is Rohit's letter instead, decision 0169.)
- **The first line under it:** "There are people online you'd like to know. Most of them have a blog, a newsletter or a channel." The rest of the paragraph and the website's points are in [`RnD/positioning.md`](RnD/positioning.md), used word for word. (The source for the brand's words; the front page no longer uses them, decision 0169.)
- **Who speaks:** "I" when Rohit speaks (website, emails, About, the 404 page). Never "we". The app itself speaks without a pronoun. Details: DESIGN.md → "Voice". (Live)
- **How it sounds:** warm, never cute. True, specific facts, never invented feelings. No stories or metaphors (letters, fountain pens) told about the brand: it wins on craft. One exception: the website's front page is Rohit's own letter, his true story in his voice, signed, ending "P.S. Write back to me" (decision 0169). Nothing else takes a letter's form. (Live)
- **Marketing copy** isn't written fresh by an agent: use settled copy word for word, and ask Rohit before adding any. (Live)

## Typefaces (Live, decision 0141)

- **Literata** for everything written: reading, the article list's titles, page titles and the wordmark (weight 600).
- **Atkinson Hyperlegible Next** (400, 500, 600) for the whole interface, on every device. It replaced the device's own font and Inter.
- **Atkinson Hyperlegible Mono** for code in articles. It replaced JetBrains Mono.
- The reader can still pick another reading font in the Aa panel: Atkinson Hyperlegible Next or the device's own serif.
- All served by nine turtles itself, never by a font service.

## Color

- **Themes are named by the page they give** (Live, decision 0176): one setting, **Page**, with **White**, **Paper** (warm cream) and **Night**, and **Match device** (the default), which shows White by day and Night by night. There are no separate day and night versions and no Appearance setting.
- **Each page has one color, its accent:** the unread dot (beside an article, and a smaller one at the end of a sidebar row with something new, decision 0148) and the faint tone behind a search match, nothing else. Never a button, a link or a focus outline. (Live)

  | Page | Page color | Words | Accent |
  |---|---|---|---|
  | White | `#FFFFFF` | `#141414` | ink blue `#2C4F8C` |
  | Paper | `#F7F3EA` | `#1F1A14` | old-ink brown `#8C5500` (a mark, held to 3 : 1) |
  | Night | `#121212` | `#E8E8E8` | pale blue `#94B2E6` |

- **Links in articles** are the text's own color, underlined, on every page. (Live)
- **The dot is never green or red** (green and red are the colors most often confused). (Live)
- **The star** is drawn in the page's own ink: filled when starred, an outline when not. Green retired. (Live, decision 0143)
- **Delete and errors** are oxblood, `#8C2F39` by day and `#E39AA4` by night, always with words that say what. (Live, decision 0143)
- **No brand color outside the app.** The website, icons and share picture use ink only: near-black `#141414` and light `#EFEFF1`. The reader's page color is theirs, not the brand's. (Live)
- **No more colors.** A new feature uses ink strengths, the greys, the one accent and oxblood. Tags and folders get names, never colors. (Live)

## The logo

- **The drawing:** nine small turtles seen from the side, in three rows of three, the middle row a little to the right. One ink, the page's text color, never colored, never cut off, never moving. (Live)
- **The nine** is the logo wherever the name is: the original drawing, half-circle shells and round heads, brought back on 4 November 2026 at the owner's request in place of the heavier redrawn nine (D2). Beside the name it sits on the name's baseline, the name in Literata 600 (in the sidebar: the nine 27px tall, the name 22px, 9px apart, so the lockup fits on one line beside the sidebar button). All nine turtles stay in the sidebar. (Live)
- **A single turtle** appears only in the browser-tab icon. (Live)
- **The app icon:** a black tile `#141414` with the nine in light `#EFEFF1`, the same by day and by night. (Live)
- **The tab icon:** the app icon's black square, always, with one light turtle filling most of it (the original turtle: a half-circle shell and a round head), so it shows on any tab, light or dark. (Live)
- **The share picture** (the preview when someone shares a nineturtles.app link): a black tile 1200 by 630 with the nine (132px tall, the same original drawing), "Read people. Write back." in Literata 600 in light ink, and "nineturtles.app" small in grey. Its description for screen readers: "nine turtles: Read people. Write back." (Live)

## The turtles' only job

The turtle is the logo's drawing, nothing else. It never acts, speaks,
sleeps, celebrates or stands for a feeling. No mascot.

- **May appear:** the logo (sidebar, sign-in, the website's top, app icon, tab icon), the share picture, and the two drawings that already exist, unchanged: "Wrong turn?" (the 404 page) and the end of the About page.
- **Never:** empty lists, the end of a list, the reading pane, emails, buttons, loading, errors, confirmations, settings, or any new drawing that tells a story.
- **When it appears:** the logo's own drawing, at most once per screen, still, in the page's ink, and skipped by screen readers, because the words beside it say it.

## Icons (Live, decision 0181)

A glance at an icon tells the reader, without doubt, what it's for.

1. **Clear at a glance.** An icon names its feature, not a mood. *A heart with a beat is health; a heart alone could be "like".*
2. **One icon, one meaning.** No two features share a drawing. *Weekly email is the envelope, so Newsletters is the envelope with a feed's sign and Email (your address) a person with an @; the sliders open search options, so Hiding is the eye with a line through it.* A list's own mark is the one exception: the unread dot in the list is the colored dot, and Settings' Unread row is a page with a new dot.
3. **Familiar signs first.** Use the sign people already know (the eye with a line through it, a card, a key, a robot, the unread dot). Invent only when none exists, and then join two known signs. *An envelope and a feed's sign: an email that becomes a feed.*
4. **Simple, not empty.** One object, plus at most one sign that pins down its meaning. Drop decoration, keep meaning. *The card loses its chip and digits; the heart keeps its beat; the keyboard keeps its keys; the eye keeps its pupil, or it stops being an eye.*
5. **Outlines for shapes, solid only for tiny marks.** A shape big enough for its inside to show is an outline; a mark too small to outline stays solid. *The heart, the bookmark and the readers' heads are outlines; the palette's paint, the unread dot, More's three dots, the feed's dot, the alert's dot, the keyboard's keys and the headphones' ear cups are solid.* Plain signs (close, back, search, plus, check) are never solid.
6. **Judged at real size.** Every icon is chosen at 18px on White, Paper and Night, never only enlarged.
7. **One hand.** A thin 1.5px line on a 20px grid, round ends and corners, the players' buttons too. One size per role: a row's › is always 18px.

"View original" is an arrow with no box. **A person** is one head and shoulders (the Readers icon's single figure) and **a publication** a newspaper page with one solid picture, on Add's two tiles; **Write back** and **Write to** are a paper plane, on the one solid ink button in the reading pane (decision 0183). A new icon follows these rules; if Rohit dislikes one later, offer three versions side by side at real size.

## Empty screens and the ends of lists (Live, decision 0142)

- **One shape for every empty list:** on the list's left edge, never centred. First the fact in Literata, in the second ink ("Nothing in this folder yet."). Then, only if there's something to do, how to do it in Atkinson, muted ("Add an article from its More menu."). A button only where one action is the obvious next step. No picture, no turtle, no icon.
- **One pattern for the words:** "Nothing … yet." A feed says when it was last checked; a search says where it looked ("Nothing found for "walking" in Starred.").
- **The end of a list:** every list ends "That's everything.", Unread too (decision 0187); search "No more results."
- **The reading pane with nothing open:** one quiet line in Literata, at 40% of the pane's height. When you left an article part of the way through, the line offers it: "You were reading *{title}*, by {writer}.", the title a link in the text color (decision 0175); on a phone, the same line at the top of the list.
- **The welcome:** "Hello." then "Who would you like to read?"
- **"Wrong turn?"** (the 404 page): everything on one left edge, "404 error" in sentence case, the turtle drawing unchanged.
- Exact sizes: `spec/06-item-list.md` for lists, DESIGN.md Part 2 for "Wrong turn?".

## Messages (Live, decision 0199)

Every line the app says after you do something, or when something fails:
the floating note at the bottom of a list, the line under a form or a
group in Settings, the line in a sheet. One house style, so the same thing
is always said the same way.

- **Something you did:** one full sentence, with a full stop, naming what changed. "Starred.", "Marked 3 articles as read.", "Unsubscribed from Mira Okafor.", "Deleted the folder Essays."
- **Something failed:** name the thing, then what to do. "*The thing* couldn't be *done*. Try again in a moment." ("The star couldn't be saved. Try again in a moment.") Never a vague "That couldn't be saved.", "That didn't work just now." or "Couldn't change that."
- **When to try again:** "Try again in a moment." when nine turtles itself had trouble; "Try again later." when another site didn't answer; "Try again in *2 minutes*." when the wait is known. When trying again won't help, say what will instead ("Select the address and copy it yourself.").
- **nine turtles can't be reached:** "nine turtles can't be reached right now. Try again in a moment."
- **No connection:** "You're offline." first, then what it means here ("You're offline. Adding a feed works again once you're back online.").
- **Undo:** a successful undo always says "Undone.", nothing more. An undo that failed says "That couldn't be undone. Try again in a moment."
- **Plain words:** no file formats, commands or network terms in a message ("That file doesn't look like a list of feeds.", never "…an OPML file."). Help can name them. The lines said in many places are written once, in `web/src/lib/messages.ts`.
- **Never** "Oops", "Sorry", "Error", "Failed", "Success" or an exclamation mark. Errors are oxblood with the alert icon and words that say what (see "Color").

## Emails (Live, decision 0142)

- **Plain text,** no pictures and no logo: the name is text.
- **From** "nine turtles <hello@nineturtles.app>"; replies reach Rohit.
- **Signed** on two lines: "Rohit", then "nine turtles".
- The weekly email (the one a reader chooses, SPEC section 39) follows the same rules: plain text, signed by Rohit, never a count.
- **Every email with a link** opens "Someone, hopefully you, asked to …" and ends "If you didn't ask, ignore this email: …", saying what happens if they do (Rohit's ask on 6 November 2026, decision 0200).
- The "your email was changed" note ends: "Reply to this email and I'll help you get your account back."

## The website

- **Look:** the same as the app: ink only, Literata and Atkinson, one left edge, generous space. Every page wears the front page's look: one centred 640px column with the logo, name and places along its top, the letter's 21px text, and no grey band (Rohit's ask on 5 November 2026; live, decision 0185, replacing the grey sidebar band of 0153). The front page is a letter, with its own larger sizes ("Hello," large, one line set large, the signature; decision 0169; sizes in DESIGN.md Part 2).
- **Copy:** the settled positioning copy, word for word (above, under "Name and words"); the front page is Rohit's letter, a draft he edits himself (decision 0169).

## Where the details live

- Screens, sizes and spacing: [`DESIGN.md`](DESIGN.md) Part 2.
- How each feature behaves: [`SPEC.md`](SPEC.md) and [`spec/`](spec/).
- Why each decision was made: [`decisions/`](decisions/README.md), the brand ones from 0132 on.
