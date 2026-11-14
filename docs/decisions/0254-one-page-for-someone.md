# 0254: One page for someone

**In one line:** A person's or publication's page is one page with no Edit mode: their name set large as an article's title, where they publish as links, Write to, your note and highlights, then their settings as Settings' rows that change as they're touched (Folders opening in place, Sources with Take out); `/edit` and `/sources/N` open it, `e` lands on Name, an X closes it on a computer, and their name under an article is underlined (since 0267 their settings are a page of their own, one press from their page, and `e` lands on its title)

*11 November 2026.*

Rohit asked for the whole author page to be rebuilt, for people and
publications alike, as Jony Ive would: "Right now, there are basically two
pages: one opens when you click on the author name, and another opens when
you click on edit. I don't like the whole thing." He chose it from screens
running on his Mac, over three rounds (11 November 2026).

**What was wrong.** Someone had three screens: their page, Edit (which
turned it into a form with Cancel and Done), and a source's own settings
behind a › in Edit. Each fact about them lived twice: the email address
under Write to and again in Edit, their sources on the page and again in
Edit. Edit was the one place in the app where settings waited for a Done;
everywhere else (Settings, the Aa panel) a setting changes as it's touched
(principle 8). And the page itself had no order of importance: a 24px name,
then a stack of equal parts.

**Decision.**

1. **One page, read top to bottom as a book is:** who they are, then what's
   yours of them, then the small print.
   - **Their name** is the one large thing on the screen, set as an
     article's title is (Literata's display cut, regular weight, 38px; 32px
     on a phone), standing where an article's title stands (decision 0219).
     It breaks the 24px title of "The system" on purpose: this page is the
     writer's, and the writer comes first (principle 2; DESIGN.md's
     Exceptions log).
   - Under it, **where they publish**, in the reading serif and the second
     ink, each place a link to its own site, underlined as every link is,
     44px to touch: by its own title when that isn't their name ("Garden
     Letters" under Hal Brennan, as decision 0167 put it), else by its
     website or name; one called just what they are ("xkcd.com" under
     xkcd.com) by what it is (Website, YouTube channel), so the line never
     repeats the name. On a phone, one place to a line.
   - A paused source's line (with Resume) and a failing one's, now naming
     what isn't working ("andrewconner.com hasn't worked since 2 Nov.", not
     "This feed").
   - **Write to**, the page's one solid button, with the address under it
     and **Change** beside the address: the address is corrected where it's
     shown, in the same box Write back asks in, with Save and Not now.
   - **Your note** and **Your highlights** always show their labels; with
     none yet, "Add a note…" and "Nothing highlighted yet." with how it
     fills. Highlights are their words in the reading serif a size up, where
     the eye rests; your note is your words, in the interface face.
   - **Settings**, Settings' own rows, each changing as it's touched: Name
     (kept on Enter or on leaving the field, "Saved." under it; Escape puts
     it back), This is (with the person and publication drawings of Add's
     tiles), Folders (the ones they're in, in words; pressed, the tick list
     of decision 0045 opens in place, with New folder… as its last row),
     Pause for a while (every source at once), a channel's Include Shorts
     and Include live streams, and Hide articles about… ›. Then, for someone
     with two or more, **Sources**: each by its name over its kind, with
     **Take out** at its end; then + Add a source; then, apart,
     Unsubscribe.
2. **No Edit, Cancel or Done,** and no source page. `/people/12/edit` and
   `/people/12/sources/34` still open, as their page with the keyboard on
   Name, and the address bar is tidied to `/people/12/about`. `e` in their
   list does the same.
3. **On a computer the page has the article's bar,** solid, with an X at its
   right end, where an article's ••• is, to go back to their list (Escape
   too), and a hairline under it once the page has scrolled.
4. **Hiding opened from their page goes back there:** its back button reads
   "‹ Steph Ango", and Escape goes there too.
5. **Their name under an article's title is underlined** at rest in the edge tone
   (65%), as every link is, so it reads as the way in; the line comes up to the ink
   under the pointer.

**Why.** One person, one page: every fact once, where it's shown, and every
setting behaving as every other setting in the app does. Chips for folders
were tried first and dropped: round chips aren't how the app chooses things
(Rohit, 11 November 2026).

**Changes.** Decisions 0163 (Edit on their page), 0183 (Edit's fields),
0215 (Edit as a quiet word), 0235 (Edit's kept changes) and 0243 (Edit's
phone finish) for this page. Nothing typed there needs keeping now: a name
is kept on Enter or on leaving the field (refused, what was typed stays in
it), and Escape in the address box or New folder… clears only that box,
never the page. Changes an old Edit left unsaved on a device (its drafts,
`edit:feed:N`) are no longer shown; Edit folder's drafts are untouched. Decision 0192
stands: a publication has no Write to and no address.

**Not changed.** Edit folder, its sheet and its kept changes. The server:
every change goes through the same calls as Edit's did
(`/api/feeds/{id}`, `/write-to`, joining and taking out).
