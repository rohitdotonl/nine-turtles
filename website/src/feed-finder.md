---
layout: page.njk
title: Feed finder
description: Paste a website's address and get its feed address, to follow it in nine turtles or any feed reader. Free, with nothing to sign up for.
permalink: /feed-finder/
---
<p class="lede">
  Paste the address of a blog, magazine or news site, and get the address of
  its feed: the one you paste into a feed reader to follow it.
</p>

<form class="finder" action="/feed-finder/" method="get" data-app="{{ site.app }}">
  <label for="address">A website's address</label>
  <div class="finder-row">
    <input id="address" name="address" type="text" inputmode="url" autocomplete="url" autocapitalize="off" spellcheck="false" placeholder="example.com" aria-describedby="address-help" />
    <button type="submit">Find its feed</button>
  </div>
  <p id="address-help" class="help">The home page usually works. For a blog inside a bigger site, use the blog's own page.</p>
</form>

<p class="finder-status" role="status"></p>

<div class="found"></div>

<noscript>
  <p>The feed finder needs JavaScript switched on in your browser.</p>
</noscript>

<h2>What it looks at</h2>

Most sites name their feed in a hidden line of their pages. The finder reads
the one page you give it, once, and the first feed it names, to show you its
newest titles. It never guesses addresses or visits the site's articles, so it
only finds what the publisher chose to share.

Nothing about you is kept: no address you look up is written down. Each
answer is remembered for half an hour, and any one site is looked at only a
few times in half an hour, so a site that many people look up isn't asked
over and over.

If no feed turns up, look on the site for a link called RSS, Atom or Feed.
Some sites don't have one.

<h2>Find feeds from any page</h2>

<p>
  On a computer, drag this button to your bookmarks bar. Press it on any
  website to bring that page here and find its feed.
</p>

{%- set bookmark = "javascript:void(location.href='" + site.url + "/feed-finder/?address='+encodeURIComponent(location.href))" %}
<p class="actions"><a class="bookmarklet" href="{{ bookmark }}">Find feed</a></p>

<p>
  Or make a new bookmark yourself, name it Find feed, and paste this as its
  address:
</p>

<div class="bookmark-copy">
  <code class="bookmark-address">{{ bookmark }}</code>
  <button type="button" class="copy copy-bookmark">Copy bookmark address</button>
</div>

<h2>Then what?</h2>

Paste the feed's address into any feed reader. In nine turtles it goes in
**Add feed**. New to all this? [Start here](/new-to-feeds/).

<script src="/feed-finder.js?v={{ finderVersion }}" defer></script>
