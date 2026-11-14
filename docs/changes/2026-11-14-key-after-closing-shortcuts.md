## 14 November 2026: A key pressed right after closing the list of keys counts

- **No lost key press.** After Escape closed the `?` list of keyboard shortcuts, nine turtles went on ignoring keys for an instant, until the list reported it had closed. A key pressed in that instant, `j` for the next article say, did nothing. Keys now work the moment the list is really gone.
- **Why it showed up now:** one automatic browser test presses `j` right after closing that list. It began to fail on main once two changes merged close together moved the tests around, though neither had caused it. That test passes again, and a new one presses Escape and `j` together so this can't come back unnoticed.
