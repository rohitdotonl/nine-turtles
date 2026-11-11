# 0255: A highlight is saved once, however often it's sent

**In one line:** Each new highlight carries a random key made on the reader's device; the server keeps it (`notes.made_key`, structure change 50) and answers a highlight sent again under the same key with the one already saved, so a page reloaded mid-save never doubles it

*11 November 2026.*

Rohit's "yes" (11 November 2026) to fixing a bug found while building pull
request #355: reloading or closing the page in the instant a highlight was
being saved could save it twice (about 1 in 10 times locally, with the save
slowed down).

**What happened.** The browser cancels a request when the page goes away,
but the server may already have saved the highlight. The app hears no
answer, takes it for a lost connection, keeps the highlight on the device
and sends it again later. The server had no way to tell it was the same
highlight, so it made a second one. A save that took longer than 15 seconds
did the same.

**Decision.**

- The app makes a random key for each new highlight (16 random bytes, as
  hex) and sends it with it, including when it's sent again from the
  device. The server stores it in `notes.made_key`, unique for each reader.
  A highlight sent with a key already saved is answered with that highlight
  as it is now (`201`, its own number), never made again; the same key on
  another article is refused as not found.
- A key that isn't letters, digits and `-`, or is longer than 64
  characters, is ignored. An assistant's highlights (SPEC section 33) and
  ones kept on a device from before this change have none, and are saved as
  before.
- Changes left waiting on the device are now also sent when an article
  opens, not only when the connection comes back; before, after a reload
  they waited for the next change.
- An open article's highlights come with their keys (and a highlight's
  stand-in carries its key too), so one waiting on the device that the
  server already has is shown once, as the server's, with whatever was done
  to it here; a note left unsaved on it moves to the server's number before
  the article's kept boxes open. When a kept note moves to a number that
  already has one, both are kept, the older first.
- What's done to a highlight while it waits is never lost to the server
  answering its older copy: a note written on it meanwhile is sent as a
  change straight after (when the note the server answers differs from the
  one sent), and one removed meanwhile is kept waiting, marked removed, so
  it's sent and then removed there too. (A highlight that never reached
  the server, made and removed offline, is thus made and removed once the
  connection is back: the app can't tell the two apart.) One kept on a
  device from before this change, with no key, is simply dropped, as before.
- Nothing else needed a key. A note on a highlight and the note on an
  article are set, not added, and a removal sent twice finds nothing the
  second time, so sending them twice changes nothing. Read and starred
  marks already carry the time they were made (decision 0101).

**Also fixed here** (left over from the reviews of #355): each words chosen
now keep their own unsaved note (before, one per article, so a second could
strand or replace the first), and words highlighted with `h` while a note
on them is kept take that note with them, so its Save doesn't highlight
them again (and Save on a kept note whose words are highlighted already,
even one still saving, puts the note on that highlight, after any note it
has). Several kept boxes are told apart by a screen reader: each reads its
words after its name.

**Why not match on the words?** The reader may highlight the same words
twice on purpose, and two highlights made a moment apart look alike. A key
is the only thing that says "this is the same one".
