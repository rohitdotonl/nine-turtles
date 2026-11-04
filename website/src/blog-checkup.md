---
layout: page.njk
title: Is your blog easy to follow and write to?
description: "Paste your blog's address and see what a feed reader sees: your feed, your name, and a way for readers to write to you. Free, with nothing to sign up for."
permalink: /blog-checkup/
---
<p class="lede">
  Paste your blog's address. See what a feed reader sees: your feed, your
  name, and a way for readers to write to you. If anything's missing, it
  shows how to fix it on your platform.
</p>

<form class="finder" action="/blog-checkup/" method="get" data-app="{{ site.app }}">
  <label for="address">Your blog's address</label>
  <div class="finder-row">
    <input id="address" name="address" type="text" inputmode="url" autocomplete="url" autocapitalize="off" spellcheck="false" placeholder="example.com" aria-describedby="address-help" />
    <button type="submit">Check my blog</button>
  </div>
  <p id="address-help" class="help">Your blog's home page works best.</p>
</form>

<p class="finder-status" role="status"></p>

<noscript>
  <p>The blog checkup needs JavaScript switched on in your browser.</p>
</noscript>

<div class="checkup" hidden>

<h2>Easy to follow</h2>

<div class="check" data-check="feed">
  <h3>Your feed</h3>
  <p class="said"></p>
  <div class="fixes" hidden>
    <div class="fix" data-platform="bearblog">
      <h4>Bear Blog</h4>
      <p>Every Bear Blog has a feed at <code>/feed/</code>. Check that the address you gave is your blog's own.</p>
    </div>
    <div class="fix" data-platform="wordpress">
      <h4>WordPress</h4>
      <p>WordPress makes a feed at <code>/feed/</code> by itself. If it isn't found, a plugin or your host may be blocking it: check that your blog's address followed by <code>/feed/</code> opens.</p>
    </div>
    <div class="fix" data-platform="ghost">
      <h4>Ghost</h4>
      <p>Ghost makes a feed at <code>/rss/</code> by itself. Check that your blog's address followed by <code>/rss/</code> opens.</p>
    </div>
    <div class="fix" data-platform="own">
      <h4>Your own site (Hugo, Jekyll, Eleventy and others)</h4>
      <p>Hugo makes a feed by itself; Jekyll makes one with the jekyll-feed plugin, Eleventy with its RSS plugin. Then name it in every page's <code>&lt;head&gt;</code>, so feed readers find it from your home page:</p>
      <p><code>&lt;link rel="alternate" type="application/rss+xml" href="/feed.xml"&gt;</code></p>
    </div>
  </div>
</div>

<div class="check" data-check="name">
  <h3>Your name</h3>
  <p class="said"></p>
  <div class="fixes" hidden>
    <div class="fix" data-platform="bearblog">
      <h4>Bear Blog</h4>
      <p>When a feed names no one, readers see the blog's title. A title with your name in it, such as "Notes from Hal", gives them both.</p>
    </div>
    <div class="fix" data-platform="wordpress">
      <h4>WordPress</h4>
      <p>Each post's author is named by their display name: set it in <strong>Users</strong> › <strong>Profile</strong> › <strong>Display name publicly as</strong>.</p>
    </div>
    <div class="fix" data-platform="ghost">
      <h4>Ghost</h4>
      <p>Each post's author is named from their staff profile: write your full name in your profile, under <strong>Settings</strong> › <strong>Staff</strong>.</p>
    </div>
    <div class="fix" data-platform="own">
      <h4>Your own site</h4>
      <p>In an Atom feed, <code>&lt;author&gt;&lt;name&gt;Your Name&lt;/name&gt;&lt;/author&gt;</code>. In RSS, <code>&lt;dc:creator&gt;Your Name&lt;/dc:creator&gt;</code> in each item. In a JSON Feed, <code>"authors": [{"name": "Your Name"}]</code>.</p>
    </div>
  </div>
</div>

<h2>Easy to write to</h2>

<p>Three ways, from enough to best. One is all a reader needs.</p>

<div class="check" data-check="contact">
  <h3>Enough: a contact page</h3>
  <p class="said"></p>
  <div class="fixes" hidden>
    <div class="fix" data-platform="bearblog">
      <h4>Bear Blog</h4>
      <p>Write a page with your email address on it, with its link set to <code>contact</code>, and add <code>[Contact](/contact/)</code> to your blog's navigation.</p>
    </div>
    <div class="fix" data-platform="wordpress">
      <h4>WordPress</h4>
      <p>In <strong>Pages</strong> › <strong>Add New</strong>, make a page called Contact with your email address on it, then add it to your site's menu.</p>
    </div>
    <div class="fix" data-platform="ghost">
      <h4>Ghost</h4>
      <p>Publish a page called Contact with your email address on it, then add its link in <strong>Settings</strong> › <strong>Site</strong> › <strong>Navigation</strong>.</p>
    </div>
    <div class="fix" data-platform="own">
      <h4>Your own site</h4>
      <p>A page at <code>/contact/</code> with your email address written on it, linked from your home page with the word Contact.</p>
    </div>
  </div>
</div>

<div class="check" data-check="email">
  <h3>Best: your email in your feed</h3>
  <p class="said"></p>
  <div class="fixes" hidden>
    <div class="fix" data-platform="bearblog">
      <h4>Bear Blog</h4>
      <p>I don't know of a setting for this on Bear Blog. A contact page, or a Reply by email link in each post, does the same job.</p>
    </div>
    <div class="fix" data-platform="wordpress">
      <h4>WordPress</h4>
      <p>The free plugin <a href="https://wordpress.org/plugins/rss-reply-via-email/">RSS Reply via email</a> adds each author's email address (from <strong>Users</strong> › <strong>Profile</strong>) to every post in your feeds.</p>
    </div>
    <div class="fix" data-platform="ghost">
      <h4>Ghost</h4>
      <p>I don't know of a setting for this on Ghost. A contact page, or a Reply by email link in each post, does the same job.</p>
    </div>
    <div class="fix" data-platform="own">
      <h4>Your own site</h4>
      <p>In an Atom feed, <code>&lt;author&gt;&lt;name&gt;Your Name&lt;/name&gt;&lt;email&gt;you@example.com&lt;/email&gt;&lt;/author&gt;</code>. In RSS, <code>&lt;managingEditor&gt;you@example.com (Your Name)&lt;/managingEditor&gt;</code> in the channel. In a JSON Feed, <code>"authors": [{"name": "Your Name", "url": "mailto:you@example.com"}]</code>.</p>
    </div>
  </div>
</div>

<div class="check" data-check="reply">
  <h3>Optional: Reply by email on each post</h3>
  <p class="said"></p>
  <div class="fixes" hidden>
    <div class="fix" data-platform="bearblog">
      <h4>Bear Blog</h4>
      <p>At the end of each post, this link; Bear Blog fills in the post's title:</p>
      <p><code>&lt;a href="mailto:you@example.com?subject=Re:%20{{ "{{" }} post_title {{ "}}" }}"&gt;Reply by email&lt;/a&gt;</code></p>
    </div>
    <div class="fix" data-platform="any">
      <h4>Any other blog</h4>
      <p>At the end of each post, a link such as <code>&lt;a href="mailto:you@example.com?subject=Re: The post's title"&gt;Reply by email&lt;/a&gt;</code>. In the post itself, it goes into your feed too.</p>
    </div>
  </div>
</div>

</div>

<h2>What it looks at</h2>

It finds your feed as the [feed finder](/feed-finder/) does: the page you
give, and if that names no feed, your home page and the few addresses where
feeds usually live, one at a time. Then it reads your home page and, only if
that shows no email address, the one contact or about page it links to. It
never visits your posts.

Nothing about you is kept. Each answer is remembered for half an hour, and
any one site is looked at only a few times in half an hour.

nine turtles reads the same things when a reader follows you and presses
Write back. [For publishers](/publishers/) says how it treats your site.

<script src="/blog-checkup.js?v={{ checkupVersion }}" defer></script>
