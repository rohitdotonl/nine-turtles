## 29 October 2026: Code tidy 33, the sidebar's foot in its own file

- Behind the scenes, the bar at the bottom of the sidebar (Add feed, Keys and Settings) moved out of the main screen's file into a small file of its own, `SidebarFoot.svelte`. The main screen's file is about 35 lines shorter.
- Nothing looks or works differently. The app's download is about 40 bytes smaller.
