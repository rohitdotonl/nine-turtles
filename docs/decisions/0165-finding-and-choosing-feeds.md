# 0165: Finding a feed in a few more places, and choosing among several

**In one line:** A page naming no feed tries the usual address under it, the home page and eight usual addresses (at most ten, one at a time); a site's several feeds each show their newest title and how often they post, repeats and missing ones left out, one left followed straight away; one shared lookup for Add feed, "Follow this person?" and the website's finder

*3 November 2026. V1 items 9 and 10 (decision 0160), shown to the owner as
clickable copies of the real screen before building.*

## Decision

**A page naming no feed tries a few more places** (`server/src/lookup.rs`),
one at a time, stopping at the first feed:

1. the usual address under the pasted page (`/@someone/feed`), when it's a
   page inside a site, so a blog inside a bigger site finds its own feed
   before the big site's;
2. the site's home page, and the feeds it names;
3. eight usual addresses at the top of the site, most common first:
   `/feed`, `/feed.xml`, `/rss`, `/rss.xml`, `/index.xml`, `/atom.xml`,
   `/blog-feed.xml` (Wix) and `/feeds/posts/default` (Blogger).

At most ten addresses besides the page. A site that asks to slow down or
stops answering isn't asked again, and the reader is told it didn't answer,
not that it has no feed. It is still only when someone asks, once,
never in the background and never an article's page. This replaces decision
0016's "never guesses other addresses".

**A site's several feeds are each looked at once,** one after another (at
most ten, at most 12 seconds in all), and each row shows the feed's newest
title and how often it posts (`frequency::of_dates`, the words of Edit
feed). A feed that isn't there or isn't a feed is left out, and so is one
whose ten newest links match a feed above it (the same posts as RSS and
Atom). A site left with one feed follows it without asking. The feeds just
fetched are kept in memory for ten minutes (`lookup::Recent`: only feeds of
1 MB or less, 16 MB in all), so following the chosen one doesn't ask the
publisher again. How often a busy feed posts is told from its own few days
when it holds five posts or more, instead of "too new to tell".

**How many requests a lookup makes,** at most: a feed pasted, 1. A page
naming one feed, 2. A page naming several, 1 plus one for each (at most
11). A page naming none, 1 plus up to 10 more places, then any the home
page names. The website's finder previews the first feed from the copy
already fetched, with no request of its own.

**One lookup for everything that finds feeds:** Add feed, "Follow this
person?" and the website's feed finder. Other apps (`greader`, assistants)
use it without looking inside, since they follow the first feed anyway. The
website's finder keeps its limit of six lookups of one site in half an hour:
a lower one would also stop a reader sharing a few pages of one big site
into "Follow this person?". Each lookup still asks one address at a time,
and answers are remembered. "Find new address" is unchanged: it
reads the home page of a feed that stopped working, where the usual
addresses would mostly find the broken one again.

## Why

Many small sites have a feed at `/feed` without naming it in their pages, and
"This site doesn't seem to offer a feed" was wrong for them. A list of "RSS
feed", "Atom feed", "Comments feed" doesn't tell a reader which one is the
writing they want; a newest title does.

## What others do

Miniflux also tries well-known addresses after the page and reuses the feed
it just fetched. Feedly and Inoreader show posts a week before following.
The order of addresses follows a count across the small web
(jamesg.blog/2025/03/08/common-paths-for-web-feeds). Not borrowed: follower
counts (a number that pulls) and site icons (one more fetch from every site).
