---
title: Bring your feeds from Feedly, Inoreader or another reader
description: Move everything you follow, and your folders, from another feed reader in one file, and bring your starred articles too.
groupId: getting-started
order: 3
spec: 13 and 16
updated: 2026-11-10
related: [follow-someone, download-everything, questions]
---

<p class="lede">
  Every feed reader can save what you follow as one file, called an
  <strong>OPML</strong> file. nine turtles reads it, folders and all.
</p>

## Move what you follow

1. In your old reader, look for **Export** or **OPML** (often under
   Settings, Import/Export or Account). Save the file it gives you.
2. In nine turtles, open **Settings › Your data** and press **Import
   OPML…**
3. Choose the file.

nine turtles says how many it added, for example "Added 120 feeds and 8
folders." Their articles arrive over the next few minutes, and you can
watch them come: Unread says "Bringing in your list: 40 feeds still to
check." and fills in by itself as each feed is read, and in the sidebar
each one still waiting says **checking…** after its name. Once you open an
article, new ones wait for you to press **r** (or Show), as usual.

Chose the wrong file? Press **Undo the import** on the line under it: exactly
what that import added goes again, and everything you followed before stays.

New here? At the foot of the welcome screen, **Bring your list from another
app…** does the same thing.

## Bring your starred articles

Many readers, including Inoreader, Feedly, Feedbin, The Old Reader and
FreshRSS, can export starred or saved articles as a JSON file. In **Settings
› Your data**, press **Import starred articles…** and choose that file.
Pocket's export isn't one nine turtles can read.

## Bring your YouTube subscriptions

Ask Google Takeout for your YouTube subscriptions, then, in **Settings ›
Your data**, press **Import YouTube subscriptions…** and choose the
<code>subscriptions.csv</code> file.

## Good to know

- Each feed brings its five newest articles into **Unread**; older ones are
  on its page, already marked read.
- Importing twice is safe: anything you already follow isn't added again.
- If the file puts folders inside folders, each feed goes into the folder
  closest to it.
- If the file has lines nine turtles can't read, it tells you which.
