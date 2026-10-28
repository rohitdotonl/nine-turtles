# 31. Starter packs (on the website)

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

*Built 26 October 2026 (decision 0100), as an empty skeleton for the owner to fill. Pages at nineturtles.app/packs/, for anyone, with no account.*

- **Starter packs** (/packs/) lists the packs in order, each with its name and one line. Linked from the website's footer.
- Each pack (/packs/think-more-deeply/ and so on) shows its name, its line, then its blogs: each blog's name linking to its own website, and one line, in the owner's words, on why it's worth reading. Under them, **Download this pack**: an OPML file with every blog's feed, for nine turtles (Settings → Your data → Import OPML…, where the blogs land in a folder named after the pack) or any other reader.
- A pack with no blogs yet says "The blogs for this pack are still being chosen." and offers no download.
- The first five: Think more deeply, Do focused work, Live slowly, Curious minds, and Newsletters, out of your inbox. How to fill one in: `website/src/packs/README.md`.

**How to check it**
1. Open nineturtles.app, and in the footer, Starter packs: five packs are listed.
2. Open one: it says its blogs are still being chosen.
