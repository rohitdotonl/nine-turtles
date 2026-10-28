## 28 October 2026: Code tidy 12, the reading settings get their own file

- Behind the scenes, the code that holds your reading settings (inbox or river, sort order, unread counts, when unread lets go, and which lists the sidebar hides) moved out of the main screen's file into its own small file, with its own tests.
- One small fix: if you changed one of those settings, or a shortcut key, in the first moment after opening nine turtles, before the server had answered, the server's older answer could quietly put it back. Your change now stays.
- Nothing else looks or works differently.
