# 0269: Read one thing at a time, a trial for the owner

**In one line:** A trial switch, "Read one thing at a time", in Settings for the owner only, kept on that device and off by default: on a computer, the list alone (beside the sidebar, its rows in a centred column), then the article alone in the whole window with "‹ Unread" (the list's name) at its top left and Escape going back; not adopted, so three panes stay the rule (decision 0134) and `f` stays as decision 0241 says. Revisit when the owner decides.

*14 November 2026. From the owner's review of flow 4, "Reading on a laptop": the owner wants to live with it before deciding.*

**What the owner saw.** On a laptop the article gets about half the window,
beside the sidebar and the list. Suggested: the list alone, then the article
alone, the way a phone already reads, which is today's full-window reading
(`f`, decision 0241) made the usual way.

**Decision: a trial, not a change.**
1. **Who and where.** Only the owner sees the switch (Settings → Your nine
   turtles, beside Readers). It's kept on the device (local storage), so it
   changes nothing on other devices or for any other reader, and nothing on
   the server. Off, the app is exactly as before.
2. **With it on, on a computer** (wide and medium windows):
   - nothing open: the sidebar, as the reader has it (shown by default on a
     medium window too), and the list alone in the rest of the window, its
     rows in a centred column 42rem wide with its edges;
   - an opened article fills the whole window, with **‹ Unread** (the list's
     own name) at the start of its bar and the tools at its end; it and
     Escape go back to the list, where it was, with the keyboard on the row
     that was open. Opening is a step in the browser's history, as on a
     phone, so Back does the same, and reloading at an article's address
     opens it alone;
   - j, k and the arrows still move to the next and previous article while
     reading;
   - a person's or publication's page and their settings fill the whole
     window too, with their × back to their list;
   - Settings, Everyone you follow and Add stay as they are;
   - full-screen reading (`f`, its menu item and its line in the keyboard's
     cheat sheet) has nothing left to do, so it isn't offered.
   A phone is unchanged: it already reads one thing at a time.
3. **Built in the layout** (`layout.svelte.ts`, with the switch in
   `oneThing.svelte.ts`, the centred column in `web/src/one-thing.css`):
   the same steps a phone takes for an article, so there's no second way
   of opening one.

**If the owner adopts it,** it would change DESIGN.md Part 1's "What's fixed"
(three panes, decision 0134) and replace full-screen reading (decision 0241);
it would then be for every reader, probably as the computer's only layout or
a setting of Look and feel, and the help pages would describe it. If not, the
switch, `oneThing.svelte.ts` and `one-thing.css` are deleted with this note's "Replaced by".

**Why a trial.** A layout is felt over days of reading, not from a picture
(DESIGN.md → "Design comes first": words alone don't settle a look), and
three panes are the owner's own choice to change.
