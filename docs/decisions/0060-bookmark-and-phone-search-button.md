# 0060: A bookmark in every article, and the phone list's search behind a button

*25 October 2026. The owner asked for both after a fresh-eyes review of the
app ("Implement 2, 6").*

**Why.** Slow reading means long pieces read over more than one sitting, and
starting again from the top each time feels like losing your page in a book.
On a phone, the search field took a row of the screen above the first
article on every list, though most visits never search.

**What changed.**

- **Your place in an article is kept**, like a bookmark. Leave an article
  part of the way through and it opens there next time, at once (never
  gliding: no motion). The place is the block of text (paragraph, picture,
  heading) at the top of the window and how far into it, not a pixel count,
  so it holds when pictures load late or the text size changes. For five
  seconds after opening, it is put back if late pictures push the text down,
  until the reader scrolls.
- Only the reader's own movement (wheel, touch, a press, a key) moves the
  place; opening an article or putting it back never does. Less than half a
  window from the top, or within half a window of the end, the place is
  forgotten: a finished article opens at its top again.
- **Kept on the device, not the server**, in the browser's storage (as the
  reader controls are), for the 200 most recent articles. No database change,
  so nothing can be lost; a phone and a laptop each keep their own place.
  Keeping it on the server (to follow you between devices) can come later if
  the owner wants it.
- Moving the keyboard's place to the article's title no longer scrolls the
  text, so it can't undo the bookmark.
- **On a phone, the list's search field waits behind a Search button**
  (a magnifier) beside More, so the first article sits right under the
  title, about one more article on the screen. A tap shows the field with
  the keyboard in it. It stays until the button is tapped again with
  nothing searched, Escape, or going to another place, never on its own,
  so nothing moves under a finger (an earlier try that hid it when the
  field lost focus made rows jump as they were tapped). While a search is
  on it always shows. Computers keep the field as it was.

**Not done.** Idea 3 (a contents page in the empty reading pane), reading
time and a "Next" line at an article's end are suggestions waiting for the
owner.
