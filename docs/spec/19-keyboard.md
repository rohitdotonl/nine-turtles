# 19. Keyboard

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

**What it does**
- Every action works with standard keys (Tab, Enter, Escape) with a clearly visible focus outline. Vim keys are an extra (the keys nine turtles starts with; the reader can change most of them, below):

  | Key | Action |
  |---|---|
  | `j` / `k` | Next / previous item |
  | `n` / `Shift+N` | Next / previous unread item, passing over read ones |
  | `Home` / `End` | First / last article in the list (End: the last one loaded so far) |
  | `Enter` / `o` | Open item |
  | `Space` / `Shift+Space` | Scroll the open article down / up one screen |
  | `v` | Open original |
  | `c` | Copy the open article's link |
  | `+` / `-` | Text size while reading |
  | `s` | Star / unstar |
  | `l` | Add to collection (the open or selected article; section 34) |
  | `w` | Write back to whoever wrote the open or selected article (section 37) |
  | `h` | Highlight the words chosen in the open article (section 42) |
  | `Shift+H` | Write a note on the words chosen, or on the whole open article (section 42) |
  | `Esc` | Back / close |
  | `g` then `u` / `s` / `a` | Go to Unread / Starred / All (also when Starred or All is hidden from the sidebar) |
  | `g` then `r` | Go to Recently read (also when it's hidden from the sidebar) |
  | `g` then `f` | Go to Your feeds (Settings › Your library) |
  | `g` then `,` | Go to Settings |
  | `Shift+J` / `Shift+K` | Next / previous in the sidebar |
  | `i` | About this person or publication (their page, section 36) |
  | `/` | Search |
  | `[` | Show / hide sidebar |
  | `]` | Show / hide article list |
  | `\` | Full-screen reading (hide sidebar and list) |
  | `e` | Fold / unfold the folder you're in, in the sidebar |
  | `m` | Mark current item unread |
  | `Shift+A` | Mark all as read |
  | `u` | Undo |
  | `r` | Show new articles |
  | `Shift+E` | Edit this person, publication or folder |
  | `a` | Add a person or publication |
  | `?` | Shortcut cheat sheet |

- **Space** (decision 0103) moves the open article on by one screen, at once, never gliding, keeping a few lines of the last screen in view; `Shift+Space` moves it back. It works wherever the keyboard's place is (the article, its row in the list, a link in the sidebar) while an article is open, except on a control that takes Space itself (a button, a tick box, a switch, a menu, a field), where Space presses that control as always. At the end of the article it simply stops: it never opens the next one. With no article open, Space is the browser's own.
- **`n` / `Shift+N`** (decision 0103) choose the next / previous unread article listed, passing over read ones, and show it as `j` / `k` do; with none left that way, nothing happens. Like `j`, they never load more of the list on their own.
- **`e`** folds or unfolds, in the sidebar, the folder you're viewing (or the first folder of the person or publication you're viewing). **`Shift+E`** opens Edit for the person or publication you're viewing (on their page, section 36), or Edit folder for the folder. **`i`** (decision 0163, in Getting around after `Shift+J` / `Shift+K`) opens the page of the person or publication whose list you're in. **`c`** copies the open article's link to the original, as More › Copy link does, and the top bar says "Link copied.".
- `n` and `Shift+N` (like Go to Unread and Mark all as read) do nothing in river mode, and the cheat sheet leaves them out there.
- **`Shift+J` / `Shift+K`** (decision 0110; "Next / previous in the sidebar") go to the next / previous person or publication in the sidebar's order: folders A to Z, each with what's in it while it's open, then People, then Publications. A folded folder's feeds are passed over; a feed in two folders counts once, where it's first listed. Folders, saved searches and Unread, Starred and All aren't stops: from a folder, `Shift+J` goes to the first feed after the folder's row; from Unread, Starred, All or a saved search, `Shift+J` goes to the first feed and `Shift+K` does nothing. At either end nothing happens. On a phone every folder counts as open. They work from a list, not from Settings or a sheet.
- **`Home` / `End`** (decision 0110) choose the first / last article listed and show it, as `j` / `k` do. `End` goes to the last article loaded so far; it never loads more itself. They work only while a list is in view: in the open article (the keyboard anywhere in it, or the list hidden with `]`, or on a phone) they scroll the article to its top or end as usual, and on a page that isn't a list (Settings, Your feeds, Feed health, Muted, Readers) they scroll that page. On a field, a row of choices or a menu, Home and End stay that control's own.
- **`g` then `f`** opens Your feeds and **`g` then `,`** opens Settings, from anywhere outside a field. **`g` then `r`** opens Recently read.
- **Every reader has the same keys** (decision 0170). Choosing keys of your own (decision 0110) was removed in step 5 of the owner's review, with Settings › Keyboard; every shortcut stays. The `?` list's foot line has **Help**, which opens the website's "Every keyboard key" page in a new tab (section 40). A reader who had chosen keys of their own is told once, in a quiet line under it the first time they open the list after the change: "You can't choose your own keys any more, so every shortcut is back to the key shown here. If you miss it, write to hello@nineturtles.app." (the address a link that opens your email app) Their old keys are then removed, and the line never shows again, on any device.
- **One list of keys** (decision 0103): each shortcut is written down once, with its keys and what each does, and both the keys that work and the cheat sheet come from it, as do tooltips and menus. An automatic check presses every key a keyboard can type and fails if one does something the cheat sheet doesn't list, or if a listed key doesn't do what its row says.
- **Keys**, an icon and its word at the foot of the sidebar, opens the shortcut list (screen readers hear "Keys (keyboard shortcuts)"; its tooltip says "Keyboard shortcuts (?)"), and so does `?` anywhere (decision 0062). While the list is open the button sits on a faint ink tile (never the accent, since it's a button), and screen readers hear that it opens a dialog and whether it's open (decision 0054). There's no hint under the list, whether the sidebar shows or not.
- **One welcome tip, once** (decision 0062): on a screen with a keyboard, the first time the reading area shows its quiet line with articles in the list, a quiet line hangs under it in small muted type: "Press J to open the first article, or ? for every shortcut.", the keys as key caps. Once you open any article (by click or key) or the shortcut list, it never shows again on that device. Touch screens never show it. On a phone the keyboard icon isn't shown; `?` still opens the list from a hardware keyboard.
- The `?` cheat sheet groups the shortcuts by what you're doing (Reading, Getting around, Tidying up, Anywhere; decision 0062) in columns, what each does on the left and its keys on the right, and also documents the search filters. Keys are printed as a Mac prints them: letters in capitals and Shift as ⇧ (`Shift+A` shows ⇧A; screen readers hear "Shift A"), the same in the More menu (decision 0055). Its title is in the same serif as every other title. On a window at least 1024px wide it has three columns, each a stack of its own: Reading; Getting around and Anywhere; Tidying up and the search filters. On a medium window, two. **Find a shortcut**, a field in its top line (on a phone, on a line of its own under the title), shows only the shortcuts and filters whose words contain what's typed, or whose key it is ("star", "s", "g u", "shift a"); a group with none left steps aside, and with none at all it says "No shortcut matches". A letter typed anywhere in the open list goes straight into the field. Escape empties the field first, from anywhere in the list, then closes the list; it opens again whole. It's never taller than 720px and stays at least 48px clear of the window's top and foot, and at 1280 × 800 the whole list fits without scrolling. On a phone it fills the screen, as every sheet does there. It has an X to close it (or Escape); it opens with the keyboard on its title rather than the X, and the title shows no ring, since it can't be pressed (the X and the list ring as soon as Tab reaches them). When it does scroll, a faint line shows under the title once the list has moved, and one near its foot while more lies below. Until a shortcut's feature exists, it isn't listed, and the key does nothing.
- The keyboard's place is shown by a 2px outline in the text color (never the accent, which marks what's unread and what a search found). Rows draw it just inside their rounded edge, in a slightly softened text color, so it never reaches over the hairlines between rows; the selected row keeps its pill. A text field in use rings the same softened text color, 2px, 1px clear of the field, its own edge stepping aside, at 3 : 1 or more against the field and whatever it sits on in every theme (decision 0055). A title that receives the place (a screen opening, a sheet, an opened article, or a key such as `g` then `a`), so screen readers start there, shows no ring, even after a key: it can't be pressed, and the next Tab lands on a real control, which rings (decisions 0042, 0047; since 27 October 2026 for every title).
- **Skip to articles** is the first thing on the app's screen to take the keyboard while a list of articles shows (the keyboard starts later, on the list's title, so it's reached by Tab from the browser's own address bar and controls): hidden until the keyboard reaches it, then a small label at the top left with its ring. Enter takes the keyboard past the sidebar to the chosen article in the list, or the first (with none, to the list's title).
- A tooltip names its button's key after its name, in brackets, as a capital letter, the same way the key caps print it: "Star (S)", "Open original (V)" (decision 0064).
- Shortcuts don't fire while you're typing in a field, nor while a word is being composed (Chinese, Japanese and the like). Caps Lock doesn't change them: with it on, `a` is still `a`, and Shift+A still Shift+A.
- Podcasts add no keys (decision 0113): Space still scrolls the article, and the player's controls answer to Enter, Space and the arrow keys only while the keyboard is on them (section 35).

**How to check it**
1. Unplug the mouse (or don't touch it). Using only Tab, Enter and Escape, add a feed, read an article, star it and search. You can always see where the focus is. Reload: the keyboard is on the list's title; click the browser's address bar and press Tab: "Skip to articles" shows, and Enter on it lands on an article.
2. Try each vim key from the table.
3. Press `?` and type "star": only the starring shortcuts and filter show. Press Escape twice: the list closes.
4. Press `?`: the cheat sheet opens; Escape closes it. `\` is listed as "Full-screen reading (hide sidebar and list)".
5. Open a long article and press Space a few times: it moves down a screen each time and stops at the end, staying on the same article. `Shift+Space` moves it back up. With the keyboard on the article's More button, Space opens its menu instead.
6. In a feed, read the first two articles with `j` `j`, go back with `k` and press `n`: the third is chosen, the read one passed over.
7. Press `Shift+A` in a feed: what's listed turns grey and the note says "Marked … articles as read" with Undo. Press `u`: they're unread again. `Shift+O` does nothing (decision 0171).
8. With an article open, press `c`: "Link copied." shows in the top bar, and pasting gives the publisher's address.
9. In a feed inside a folder, press `e`: the folder folds in the sidebar; again, it unfolds. Press `Shift+E`: their page opens in Edit. Press `i`: their page opens.
10. In All, press `Shift+J`: the first feed in the sidebar opens; again, the next; `Shift+K` goes back. Fold a folder and its feeds are passed over. In a feed, `End` chooses the last article loaded and `Home` the first. Open an article and press `End`: it scrolls to the article's end, and the same article stays chosen. On Settings, `End` scrolls the page. `g` then `f` opens Your feeds; `g` then `,` opens Settings.
11. Press `?`: its foot has Help and no way to change keys, and Settings has no Keyboard page. If you had chosen keys of your own before, the foot says once that they're back to these; open the list again and the line is gone.
