# 0107: Opening a picture in an article larger

*October 2026.*

**Decision.** The owner approved, on 27 October 2026, letting a picture in
an article be opened larger, as Apple Books opens a book's picture on its
own (SPEC section 7).

- **Which pictures:** only one the page shows clearly smaller than it really
  is: its natural size at least a fifth bigger, and at least 40 CSS pixels
  bigger, in width or height (`shownSmaller` in `web/src/lib/pictures.ts`).
  It must have loaded and must not be inside a link (a link already says
  where a press goes). Everything else stays exactly the publisher's
  picture, with nothing added. Whether a picture qualifies is looked at
  again whenever a picture loads or changes size, so a change of window
  size, text size or line width is caught by one `ResizeObserver`.
- **How it's reached:** such a picture gets `role="button"`, `tabindex="0"`
  and the name "Open picture larger: {alt}", and the pointer's hand. A click,
  a tap, Enter or Space opens it; Enter and Space are kept from the page's
  own shortcuts.
- **How it's shown:** `PictureSheet.svelte`, a native modal dialog like the
  shortcut list, on the raised surface over a sheet's dim (`dialog.dimmed`).
  The picture as large as fits with a margin, never stretched past its own
  size; its alt text as a caption in the second ink; a quiet "Open in new
  tab" to the picture's address (`rel="noopener noreferrer"`); an X, since
  it's only looked at (DESIGN.md → "One close rule"). Escape, the X or a
  press on the dim closes it and the keyboard returns to the picture. No
  motion. On a phone it stays a card over the dim, not a screen of its own:
  it is a picture, not a form, and pinch-zoom is never blocked.
- **By night:** the picture in the article keeps its slight dimming
  (decision 0050), brightening under the pointer or the keyboard as a linked
  picture does. Opened, it shows at full brightness: the dimming keeps a
  pale picture from glaring beside the text, and here the reader asked to
  look at the picture itself, alone.
- **Offline:** kept articles carry no pictures (decision 0101), and a
  picture that failed to load has no natural size, so neither is offered.
- **The publisher floor:** nothing new is fetched; the opened picture is the
  same address the article already loaded, and "Open in new tab" goes to the
  publisher's own copy.
- **Not done:** no zoom or pan controls of our own, no stepping between an
  article's pictures. The device's pinch-zoom is enough.
