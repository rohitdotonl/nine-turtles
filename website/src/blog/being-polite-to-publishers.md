---
title: Being polite to publishers
description: How nine turtles checks feeds without burdening the sites that publish them.
date: 2026-10-25T11:00:00Z
---

A feed reader is a guest. Every time it checks a feed, someone else's
server does a little work, often a person paying for their own small
website. nine turtles is built to be the kind of guest people are glad to
have.

## Each feed on its own rhythm

Some sites publish ten times a day; some publish twice a year. nine
turtles notices which is which, and checks often where it's worth it and
rarely where it isn't: never more than every 30 minutes, and at least once
a day. Checks are spread out over time, never all at once.

## Asking "anything new?"

Each time it checks, nine turtles tells the site what it already has,
using two standard labels of the web (called ETag and Last-Modified). If
nothing has changed, the site can answer in a few bytes instead of sending
the whole feed again.

## Listening when a site says "slow down"

If a site answers that it's busy, nine turtles waits as long as it's
asked. If a feed keeps failing, it tries less and less often, up to once a
day, and that never affects any other feed. If a feed has moved for good,
nine turtles updates its address.

## Hearing straight away, when a site offers it

Some sites announce new posts the moment they're published, through an
open standard called WebSub. For those, nine turtles doesn't need to keep
asking: it's told, once, when there's something new.

## Saying who it is

Every request names itself as nine turtles, with its version, so a
publisher looking at their logs knows exactly who came by.

## Only the feed, never the page

nine turtles reads the feed, and only the feed. It never visits an
article's web page to copy what the feed left out. The only page it ever
looks at is the one you paste when you add a site, once, to find its
feed.

## Credit where it's due

In nine turtles, every article carries its publisher's name and a link to
the original. Sharing shares their link. And when a publisher includes a
video, it plays in their chosen player, so the views count for them.

Publishers are the reason there's anything to read. If you publish a feed
and would like nine turtles to treat it differently, [tell us](/contact/).
