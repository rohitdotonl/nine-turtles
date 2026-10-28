# 27. Rules and mutes

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

*Built in V2 (25 October 2026, decision 0077).*

A rule says "when a new article **matches this**, **do that**", in plain fields, never code. Only what the feed holds and what you wrote are used: no guessing, no ranking.

**What it does**
- **Matches this** (every part filled in must hold): a **word or phrase**, in **the title** or in **the title or the text**, found as whole words whatever their capital letters ("AI" never matches "said"; the HTML's own words never count); an **author**'s name; and **where**: all feeds, one folder, or one feed.
- **Do that:** **Mute** (the article is kept, counts as read, and waits in no list: not Unread, All, its feed or its folder; only search, Muted articles and, if it's starred, Starred show it), **Star** (it goes straight into Starred), or **Mark as read** (it stays in its feed's list, already read). Rules act on articles as they arrive, a new feed's first ones included, in the order the rules were made.
- **Where you find it:** Settings › **Rules ›**, its own page (`/settings/rules`; decision 0120). Each rule is one plain sentence, e.g. "Mute articles with “sponsored” in the title, in all feeds.", with **Edit** and a **switch** that pauses it ("Paused." follows the sentence). **New rule…** is the group's last row. Edit feed has a shortcut, **Add a rule for this feed…**, which opens Settings › Rules with a new rule already set to that feed. Nothing about rules shows anywhere else until you make one.
- **The rule editor** is a sheet over Settings (on a phone, the phone sheet): Word or phrase, Look in (a choice of one), Author (optional), In (All feeds, then folders, then feeds), Then (Mute, Star or Mark as read, each with a line saying what it does), and Cancel and Save; an existing rule also has **Delete** in red words at the far left. Escape or Cancel closes it unchanged.
- **Asking first:** once a new rule is saved, if unread articles already match, the line under the group asks once, with the number: "Also mute the 37 unread articles that match?" with **Mute them** and **Not now**. What it did ("Muted 37 articles.") has **Undo**, which puts back exactly those articles.
- **Deleting a rule** happens at once, with **Undo** on the line under the group. What a rule already did stays done.
- **Muted articles ›** appears in the group once anything is muted, with how many. Its page (`/settings/muted`, the feed health page's build) lists the newest 200, each with its feed, its time and **Unmute**; an unmuted article comes back unread and stays on the page saying so, with Undo, so nothing moves. Its X or Escape goes back to Rules, to its row.
- **Search still finds muted articles,** with "· Muted" after the time. Marking a muted article unread unmutes it.
- **Other apps** (section 26) see a muted article as read, so it stays out of their unread lists too; marking it unread there unmutes it here.
- **When a rule's feed or folder goes** (unsubscribed for good, or the folder deleted; Undo for deleting a folder hands its rules back), the rule stays, matching nothing, and its sentence says "in a feed or folder that's gone". Editing it asks you to choose where it applies again. It never spreads to every feed.

**How to check it**
1. Settings › Rules › New rule…: "sponsored", The title, All feeds, Mute, Save. The rule shows as one sentence.
2. If unread articles already match, the line asks "Also mute the N unread articles that match?". Press Mute them, then Undo: they're back.
3. When an article with "sponsored" in its title arrives, it's in no list and not counted. Search for it: it's found, marked "· Muted". Settings › Rules › Muted articles lists it; press Unmute and it's back in Unread.
4. Turn a rule's switch off: it says "Paused." and stops acting. Edit › Delete, then Undo: it's back as it was.
5. In Edit feed, press "Add a rule for this feed…": the new rule is already set to that feed.
