# 0100: Starter packs on the website

*26 October 2026. From the marketing plan, part of the owner's plan for 100
to 200 readers (decision 0086). The owner asked for the pages to be live
now, empty, and will choose the blogs himself.*

## Decision

- **Hand-picked packs of blogs, on the website only,** at
  nineturtles.app/packs/: a few blogs on one theme, each with a line on why
  it's worth reading, for readers who don't know where to start.
- **Not a discovery engine** (DESIGN.md Part 1): the packs are chosen by a
  person, the same for everyone, never ranked, never personalised, never in
  the reading screens. The only other recommendation is the welcome's five
  starter feeds (decision 0079).
- **Respect the publisher:** each blog is named as its writer names it and
  linked to its own website; the pack shows nothing from the feed itself.
- **Taking a pack anywhere:** a pack with blogs offers an OPML file built
  from the same list (`website/src/packs-opml.njk`), which works in nine
  turtles (Settings → Your data → Import OPML…, into a folder named after
  the pack) or any other reader. An empty pack offers none.
- **Checked like every page:** `scripts/check.sh website` builds a made-up
  test pack with blogs (`NINE_TURTLES_TEST_PACK=1`, never on the live
  website), so its list and its OPML file are checked before any real pack
  is filled.
