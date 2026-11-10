# 0235: Nothing the reader typed is thrown away

*10 November 2026.*

Rohit's "Implement every suggestion from round 1" (10 November 2026),
suggestions 1, 2 and 3 of the critique through the principle "Forgiving"
(DESIGN.md's "nothing the reader typed is thrown away").

**Decision.**

1. **Unsaved notes are kept.** A note on a whole article, on highlighted
   words, or on a person, written and not saved, is kept on this device.
   Not now, Escape, a press outside its box, Back and going to another
   article or page all keep it. Coming back, its box is open again with the
   words and "**Not saved yet.** Kept from when you left this article."
   (or "…this page." on a person's). A note on highlighted words waits in
   its box at the article's end, under the highlight; one on words chosen
   but not highlighted yet waits there under those words, and Save
   highlights them. Opening a box onto kept words in place says "**Not saved
   yet.**". **Discard** beside the line is the one way to throw them away,
   with Undo straight afterwards. No "Are you sure?" anywhere.
2. **A note that couldn't be saved keeps its words.** Every note box stays
   open, with the words, until the save is confirmed ("Saving…" after half
   a second, decision 0229). If it fails, the message sits right under the
   words in oxblood with the alert icon, "The note couldn't be saved, so
   your words are still here. Try again in a moment.", and Save becomes
   **Try again**. All three note boxes are one component (`NoteBox.svelte`)
   and behave alike. Without a connection a note is still kept to send
   later (section 32), so the box closes as before.
3. **Unsaved changes on Edit and in a sheet are kept.** Edit for a person or
   publication, Edit folder and Add keep what was typed when the reader
   leaves without Done or Save: by Escape, Back, a press on the dimmed page
   or on an article in the list. Coming back, the form starts from those
   changes, and Edit and Edit folder say "**Not saved yet.** Going elsewhere
   keeps these changes here for you." (Add simply has the address back in
   its field.) **Cancel** throws them away (on a phone's Edit folder, its
   X, which stands for Cancel there); Done or Save saves them, and
   Unsubscribe or Delete forgets them. Edit for one source keeps its switches
   (Pause and YouTube's two) with the rest of the form; the separate page a
   person's source opens on with › (`SourcePage.svelte`, only switches,
   left by "‹ Edit …") keeps nothing, and the sheets that ask for a password or an email keep
   nothing: a password is never written down.

The critique's message for a failed save said "Press Save again in a
moment." while its button said Try again; the message follows the house
style instead (BRAND.md → "Messages"), so the two agree.

**Why.** A slip (the right goal, the wrong press) should cost nothing, and
here a stray tap cost the reader their own words, the one thing in the app
only they can make; Undo can't help, because nothing was saved to undo.
A warning dialog would be pressed through out of habit; a kept draft makes
the slip harmless instead.

**How.** `web/src/lib/drafts.ts` keeps each draft under its own name
("note:article:12", "note:highlight:9", "note:words:12", "note:person:3",
"edit:feed:3", "edit:folder:2", "add") in the browser's storage, one entry
for each reader, the way changes made offline are kept (`notes.svelte.ts`).
A draft is written as it's typed, so it survives any way of leaving,
a reload too, and forgotten once saved, cancelled or discarded; a form's
draft is kept only while it differs from where it started. Nothing is ever
dropped on a timer, and nothing reaches the server until it's saved. Signing
out, or another reader signing in on the device, forgets every draft
(`forgetDrafts`, from `App.svelte`'s `forgetDevice`), so nothing typed is
left behind on a shared computer (SPEC section 32). A draft whose article,
person or folder is gone is never shown again; it stays small and goes at
the next sign-out.
Tests: `web/src/lib/drafts.test.ts` and `web/tests/drafts.spec.ts`.
