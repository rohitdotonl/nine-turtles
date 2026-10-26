# Starter packs

Each file here is one starter pack on nineturtles.app: a small, hand-picked
shelf of blogs on one theme, for readers who don't know where to start.
`index.njk` is the page that lists them all, at nineturtles.app/packs/.

Every pack is live on the website, even before its blogs are chosen: an
empty pack says "The blogs for this pack are still being chosen." The list
page is linked from the website's footer.

## Filling in a pack

In the pack's file, list each blog under `blogs:`:

```yaml
blogs:
  - name: Example Blog
    site: https://example.com/
    feed: https://example.com/feed.xml
    why: Short, careful essays about one idea at a time.
```

- **name:** the blog's own name, as its writer spells it.
- **site:** its home page. The pack links there, so the writer gets the visit.
- **feed:** its feed's address. The feed finder (nineturtles.app/feed-finder/)
  finds it from the home page.
- **why:** one line on why it's worth reading, in your own words.

8 to 12 blogs a pack is plenty. Change `title`, `description` or `order`
(its place in the list, a whole number: 1, 2, 3…) freely, add a pack by copying a file, and remove one
by deleting it.

Once a pack has blogs, it also gets a download, `/packs/<name>.opml`,
that adds every blog in it to nine turtles or any other feed reader.

The checks also build a made-up test pack with blogs (`NINE_TURTLES_TEST_PACK=1`
in `scripts/check.sh`), never on the live website, so the list and the
download are checked before any real pack has blogs.
