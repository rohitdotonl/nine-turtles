## 28 October 2026: Code tidy 21, the empty list's words get their own place

- Behind the scenes, what the article list says when it has nothing to show ("Folder not found", "Nothing unread.", "Your collections couldn't be loaded…") moved out of the main screen's file into its own, with tests.
- One automatic test of hiding "Recently read" no longer reloads the page before the change is saved, so it stops failing now and then.
- Nothing looks or works differently.
