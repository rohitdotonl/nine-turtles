---
layout: page.njk
title: About nine turtles
description: Why nine turtles exists, the rules it's built by, and who makes it.
permalink: /about/
---

<p class="lede">
  nine turtles exists to help people leave social media behind and come
  back to reading the open web: finite, calm and quiet, where social media
  is infinite, urgent and attention-grabbing.
</p>

## Why it exists

Some of the best writing anywhere is on people's own websites: essays,
notes, letters, recipes, research, the slow work of people who care about
a subject. It's free to read and nobody owns it. But it's easy to lose
among feeds designed to keep you scrolling.

Feed readers have solved this for twenty years. Many have also slowly
taken on the habits of the apps they replaced: counters, badges, unread
numbers in red, "catch up" pressure. nine turtles goes the other way. It
treats your reading list like a book you're in the middle of, not an inbox
to clear before you're allowed to rest.

## How it's made

nine turtles follows a short, written philosophy that settles every
question about what it does and how it looks. Two rules come before
everything else and are never traded away:

- **Everyone can read here.** Strong contrast, never color alone, a
  keyboard for everything, a screen reader for everything, and respect for
  your device's own settings. ([Accessibility](/accessibility/))
- **Respect the publisher.** Show only what the feed shares, always credit
  and link the original, check feeds politely, and play videos in the
  publisher's own player.

After those: reading comes first, calm over engagement, clear at a glance,
a slow app with a fast interface, nothing moves unless you move it, power
that's hidden but never missing, and respect for your time. Its look takes
its lead from Apple Books.

## The name

The logo is nine small turtles, in three rows of three. Turtles are slow
and steady and in no hurry, which suits a reader made for unhurried
reading.

## Who makes it

nine turtles is made by [{{ site.maker }}]({{ site.makerSite }}), who wanted
a calmer way to read the web. It started as
"slowfeed" on 22 October 2026 and took its own name two days later. The
[blog](/blog/) follows along.

Questions, ideas or problems are always welcome: [get in touch](/contact/).

<!-- Nine turtles in single file (the logo's turtle, docs/logo/): seven ahead and two a few steps behind, drawn still (DESIGN.md, "The About page's end"). The line under them says it in words, so screen readers skip the drawing. -->
<div class="walk">
  <div class="procession" aria-hidden="true">
    {%- for i in range(9) %}<svg class="turtle{% if i == 1 %} behind{% endif %}" viewBox="-10 -4.5 22 8.5" focusable="false"><path d="M-9 3.5 A7.5 7.5 0 0 1 6 3.5 Z"/><circle cx="8.6" cy="0.6" r="2"/></svg>{% endfor -%}
  </div>
  <p>Some of us like to read slowly. That&rsquo;s the idea.</p>
</div>
