## 28 October 2026: Code tidy 15, the screen's layout gets its own file

- Behind the scenes, the code that arranges the screen (how many areas show at each window width, hiding and showing the sidebar and the article list, and remembering how wide you dragged them on this device) moved out of the main screen's file into the small file that already held the layout rules, with new tests for each of those jobs.
- Nothing looks or works differently.
