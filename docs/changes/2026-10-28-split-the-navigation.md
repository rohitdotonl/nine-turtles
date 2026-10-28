## 28 October 2026: Code tidy 14, moving between places gets its own file

- Behind the scenes, the rules for moving around the app (which places open as a sheet over the one you were on, when the open article stays as you move, and giving the keyboard back to the button that opened a sheet when it closes) moved out of the main screen's file into their own small file, with tests for each rule. Two copies of "give the keyboard back" became one.
- Nothing looks or works differently.
