## 29 October 2026: Code tidy 38, three actions written once

- Behind the scenes, renaming a folder, deleting a rule and marking a whole feed read were written separately for the app, sync apps (like Reeder) and AI assistants. Each is now written once and shared, so a future fix reaches all of them.
- Nothing looks or works differently. An assistant's "mark this feed read" now counts the same articles the app's Mark all as read does.
