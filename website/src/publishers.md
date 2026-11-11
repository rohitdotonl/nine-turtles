---
layout: page.njk
title: For publishers
description: How nine turtles checks your feed, and how to ask it to behave differently.
permalink: /publishers/
---

<p class="lede">
  If you found <code>nine-turtles</code> in your logs, this page is for you.
  nine turtles is a feed reader: people who like your writing follow your
  feed in it. Here's exactly how it treats your site.
</p>

## How it introduces itself

Every request says <code>nine-turtles/</code> followed by its version and
a link to this page, for example
<code>nine-turtles/0.1.0 (+https://nineturtles.app/publishers/)</code>. It
never pretends to be a browser.

## How often it asks

- **Once per feed, however many people follow it.** A hundred readers
  following your feed still means one check.
- **On your feed's own rhythm:** often if you post often, rarely if you
  don't. Its regular checks come never more than once an hour, and at
  least once a day. (A reader adding your feed, or looking for its new
  address when it isn't working, asks once, straight away.)
- **Your `Cache-Control` is respected.** If your feed says `max-age`, the
  next regular check waits at least that long, up to a day.
- **One request to your site at a time.** If several of its feeds are due,
  they take turns. Sites that share a host (like every blog on one
  platform) take turns too.
- **Spread out.** Checks drift apart over time instead of arriving all at
  once on the hour.

## How it saves you work

- **It asks "anything new?"** It sends back your `ETag` and
  `Last-Modified`, so an unchanged feed can answer `304 Not Modified` in a
  few bytes.
- **It accepts compressed answers** (gzip, brotli).
- **It hears straight away if you offer WebSub.** If your feed names a
  hub, nine turtles subscribes and checks only twice a day as a backup.
- **It reads only your feed.** It never visits your articles' pages to
  copy what the feed left out. It reads a page of yours only when someone
  adds your site or looks for its feed, and then only to find the feeds
  that page links to, or when someone checks your blog with the
  [blog checkup](/blog-checkup/).
- **It looks for your email address once, if a reader asks.** When a
  reader presses Write back to reply to you and your feed gives no
  address, nine turtles reads your home page and one contact or about page
  it links to, once, to find it. It never does this again for your site,
  however many readers press it. To be sure readers find the right
  address, put it in your feed or on your contact page. The
  [blog checkup](/blog-checkup/) shows what nine turtles finds.

## When something goes wrong

- **"Slow down" is obeyed.** A `429`, or a `503` with `Retry-After`, makes
  it wait as long as you ask, up to a week.
- **Moving is followed.** A permanent redirect (`301` or `308`) updates the
  address it keeps.
- **A failing feed is asked less and less**, twice as long between tries
  each time, down to once a day.

## If your site has a guard against bots

Some sites sit behind a guard that keeps bots out, such as Cloudflare's
Bot Fight Mode or "Under Attack" mode, or a firewall from Vercel, Sucuri
or Imperva. nine turtles can't pass the check a guard gives browsers, and
it never pretends to be one, so the guard turns it away and your readers
stop getting your posts. They see "The site's guard against bots turns
nine turtles away", so they know it isn't you or them.

To let it in, the best way is to let everyone reach your feed's address
past the bot checks: a feed is meant to be read by programs, and every
feed reader then gets through, not only nine turtles. In Cloudflare,
that's a custom rule under **Security › WAF** that skips the bot checks
when the address is your feed's. If you'd rather not, allow visitors
whose user agent starts with <code>nine-turtles/</code>; anyone can write
that, though, so it's the weaker door to leave open.

## Credit

Every article in nine turtles carries your name and links to your site.
Sharing shares your link. Your videos play in the player you chose, and
audio plays from your own address.

## Asking for something different

If you'd like nine turtles to check your feed less often, or anything
else about how it treats your site, write to <a href="mailto:{{ site.email }}">{{ site.email }}</a> and I'll
sort it out.
