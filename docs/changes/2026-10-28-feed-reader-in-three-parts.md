## 28 October 2026: The feed reader in three parts

- Behind the scenes, the server's biggest file (the one that reads a feed and cleans its articles) is now three smaller files: reading the feed, recognising each article, and cleaning its content. Nothing changes on screen; the cleaning that keeps feeds safe now sits in one small file that's easy to check.
