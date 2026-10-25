# 0079: "New to feeds?" in the first-visit welcome

*25 October 2026. Milestone 7 of the owner's plan for going multi-user ("A friendly start: the 'New to feeds?' welcome with a few suggested feeds to pick"). The plan lives outside this repository, in the owner's project notes; the owner approved it in the project chat on 25 October 2026, including changing DESIGN.md Part 1 (the "is not" list) to match it.*

**Decision.** The first-visit welcome gains one quiet link under its
sentence, "New to feeds? Start here". It opens a sheet (`/new-to-feeds`;
a page sheet on a phone) with:

- two sentences on what a feed is, in the website's words;
- "Here's how feeds work", a link to the website's guide,
  nineturtles.app/new-to-feeds, in a tab of its own;
- "A few to start with": five fixed feeds (The Marginalian, The Public
  Domain Review, kottke.org, Austin Kleon, NASA Image of the Day) as a
  grouped list of tick boxes, none ticked;
- Cancel and "Add chosen feeds", which adds the ticked feeds one after
  another through the ordinary add path.

- **Not a discovery engine, still.** The list is short, fixed, the same for
  everyone and never ranked or personalised. It shows only before you
  follow anything, and only if you open it. DESIGN.md's "is not" list and
  Exceptions log say so.
- **Respect the publisher.** Each starter is its publisher's own feed
  address, so adding one fetches only the feed, never a web page.
- **Many readers.** The list lives in the app (`web/src/lib/starters.ts`),
  not the database, so each reader's own first visit shows the same
  welcome with nothing to set up. Changing the list is a one-file change.
- **A sheet, not more welcome.** Putting the list in the welcome itself made
  it twice as tall and pushed its one action off the middle; a sheet keeps
  the welcome to one message and one action, as Apple Books' empty library is.

**Why.** Someone who has never used feeds doesn't know what to paste. A
short explanation and a first few feeds get them reading in a minute, after
which they choose everything themselves.
