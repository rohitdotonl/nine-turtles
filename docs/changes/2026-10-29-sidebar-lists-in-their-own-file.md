## 29 October 2026: Code tidy 32, the sidebar's lists in their own file

- Behind the scenes, the sidebar's fixed lists (Unread, Starred, All, Recently read and Up Next) moved out of the main screen's file into a small file of their own, `SidebarViews.svelte`, together with the rule that keeps Up Next's row in place while it empties. The main screen's file is about 50 lines shorter.
- Nothing looks or works differently. The app's download is about 65 bytes smaller.
