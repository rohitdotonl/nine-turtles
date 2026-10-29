## 29 October 2026: Code tidy 30, the welcome in its own file

- Behind the scenes, the welcome a new reader sees before their first feed ("A quiet place to read.") moved out of the main screen's file into a small file of its own, `Welcome.svelte`. The main screen's file is about 45 lines shorter.
- Nothing looks or works differently. The app's download is about 120 bytes larger (a separate piece costs a little), well within its budget.
