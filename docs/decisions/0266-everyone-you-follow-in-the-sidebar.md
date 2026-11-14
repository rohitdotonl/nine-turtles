# 0266: Everyone you follow is a row in the sidebar

**In one line:** Everyone you follow leaves Settings for a row of its own in the sidebar (and on a phone's Home), under All articles, at `/following`: one press from home, marked as your place while open, with no back link on a computer and "‹ Home" on a phone. Revisit if the sidebar's fixed rows start to crowd.

*14 November 2026. The owner's choice from a now-and-suggested picture, in a design critique of the whole app ("3, 5, and 6: Implement them").*

**What was wrong.** nine turtles is about people, yet the one page that
shows them all (who isn't working, who could be either, everyone A to Z,
who was unsubscribed from) was two presses away, inside Settings ›
Your library, as if it were a preference.

**Decision.**
- **One row, "Everyone you follow"**, under All articles, built as the
  lists' rows are (the same height, icon column and pill). Its icon is the
  one the page already had in Settings, a feed's waves: one icon, one
  meaning (BRAND.md → "Icons"). The picture the owner chose from showed a
  small person; a single person already means "a person" on Add's tiles and
  two people mean Readers, so the page keeps its own sign.
- **Its address is `/following`.** The old `/settings/feeds` and
  `/settings/feed-health` still open it, and the address bar is tidied.
- **It's a place, not a page of Settings.** On a computer its row is marked
  as a list's is, the Settings button isn't, and the page draws no way back
  (Escape does nothing there, as in a list). On a phone the row is on Home
  and the page has "‹ Home"; Escape and the system's Back go there.
- **Settings › Your library keeps Your data only.** One way in, so the page
  never has to say which way you came.
- **`Shift+J` and `Shift+K`** still step through lists of articles and pass
  over this row, which isn't one.

**Why.** The writer comes first (principle 2), and clear at a glance
(principle 3): the people are the app's subject, so their page belongs
beside the lists, not among preferences.

**Changes.** Decisions 0163 and 0186, which put the page in Settings, and
0231's "‹ Settings" above its title. Everything on the page is unchanged.
