## 29 October 2026: Code tidy 34, the list's title line in its own file

- Behind the scenes, the line at the top of the article list (the list's name, and beside it Search on a phone and the More (…) button) moved out of the main screen's file into a small file of its own, `ListHead.svelte`. The main screen's file is about 20 lines shorter.
- Nothing looks or works differently. The app's download is about 250 bytes bigger (a new file costs a little), still under its 150 KB limit.
