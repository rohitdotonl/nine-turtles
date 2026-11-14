## 14 November 2026: A tidy-up before Unread by person

- **Nothing you can see changed.** The code that draws one article's row in a list moved into a file of its own, because the list's file was nearly at its size limit. It makes room for the next change, Unread by person.
- **A check made steadier:** one automatic browser test (ticking who could be either, on Everyone you follow) failed when its made-up blog happened to be the only one still open: ticked, the group's name changes from "1 could be either" to "Could be either", and the test looked only for the first spelling. It now finds both.
