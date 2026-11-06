# 27. Hiding articles about…

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

*Built in V2 (25 October 2026, decision 0077); made one sentence in the
owner's plan, step 8 (4 November 2026, decision 0173).*

A rule is one sentence the reader fills in: **"Hide articles about [words] from [everyone / this person]."** Never code, no guessing, no ranking: only what the feed holds and what the reader wrote are used.

**What it does**
- **About:** a word or phrase, found as whole words in an article's title or text, whatever their capital letters ("AI" never matches "said"; the HTML's own words never count).
- **From:** **everyone**, or one person or publication. A person's rule covers every one of their sources, as their row does in the sidebar.
- **Hidden** means the article is kept, counts as read, and waits in no list: not Unread, All articles, their list or a folder's; only search, **Hidden articles** and, if it's starred, Starred show it. Rules act on articles as they arrive, a new person's first ones included.
- **Where you start one:** an article's More menu, **Hide articles about…**, and the same words as a quiet link on a person's or publication's page (section 36). Both open Settings › Hiding with the sentence already set to whoever wrote it. Settings › **Hiding ›** (`/settings/hiding`; decision 0120) lists every rule as its sentence, e.g. "Hide articles about “sponsored” from everyone.", with **Edit** and a **switch** that pauses it ("Paused." follows the sentence). **Hide articles about…** is the group's last row. Nothing about hiding shows in Settings' other pages until you make a rule.
- **The editor** is a sheet over Settings (on a phone, the phone sheet), named **Hide articles** (**Edit** for one that exists), that reads as its one sentence (on a computer the sentence is its first line: the name is said to screen readers but not drawn, since it would repeat the sentence), its blanks the fields (decision 0123): "Hide articles about [a word] from [everyone]." The From menu holds everyone, then each person and publication by name, A to Z. Each blank is named for screen readers (About, From). Under it, one quiet line: "Hidden articles are kept and marked read. Search still finds them." Then Cancel and Save; an existing rule also has **Delete** in oxblood words at the far left. Escape or Cancel closes it unchanged.
- **Asking first:** once a new rule is saved, if unread articles already match, the line under the group asks once, with the number: "Also hide the 12 unread articles that match?" with **Hide them** and **Not now**. What it did ("Hid 12 articles.") has **Undo**, which puts back exactly those articles.
- **Deleting a rule** happens at once, with **Undo** on the line under the group. What a rule already hid stays hidden.
- **Hidden articles ›** appears in the group once anything is hidden, with no count (the list itself shows what's there). Its page (`/settings/hidden`, Everyone you follow's build) lists the newest 200, each with who wrote it, its time and **Unhide**; an unhidden article comes back unread and stays on the page saying so, with Undo, so nothing moves. Its X or Escape goes back to Hiding, to its row.
- **Search still finds hidden articles,** with "· Hidden" after the time. Marking a hidden article unread unhides it.
- **When the person goes:** unsubscribing from one of a person's sources for good moves their rule to a source of theirs still followed. Once none is left, the rule stays, matching nothing, and its sentence says "from someone you no longer follow"; editing it asks you to choose who again. It never spreads to everyone.
- **Rules from before (decision 0173):** rules that already fit (mute, words, every feed or one feed) carry on, reworded. An old rule that looked in titles only still does, and says so: "Hide articles about “x” (in titles) from everyone." A rule for a folder became one rule per person in that folder. Rules with an author, or that starred or marked articles read, were switched off, then deleted (decision 0174). What any rule already did stays done.

**How to check it**
1. Open a person's page and press **Hide articles about…**: Settings › Hiding opens with the sentence set to them. Type "sponsored" and Save. The rule shows as one sentence.
2. If unread articles already match, the line asks "Also hide the N unread articles that match?". Press Hide them, then Undo: they're back.
3. When an article about "sponsored" arrives, it's in no list and not counted. Search for it: it's found, marked "· Hidden". Settings › Hiding › Hidden articles lists it; press Unhide and it's back in Unread.
4. Turn a rule's switch off: it says "Paused." and stops acting. Edit › Delete, then Undo: it's back as it was.
5. In an article, open More: **Hide articles about…** opens the same sentence, set to whoever wrote it.
