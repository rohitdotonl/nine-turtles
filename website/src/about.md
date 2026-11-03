---
layout: page.njk
title: About nine turtles
description: Why I made nine turtles, what it is, and who makes it.
permalink: /about/
---

<!-- Rohit's story (the owner's review, step 1b; decision 0166), a draft in his voice that he edits himself. -->

<p class="lede">
  Years ago, a social network introduced me to strangers. Through its little
  features, I got talking to people I'd never have met, and some of them
  became lifelong friends. Technology can do that. It can help you find
  people.
</p>

The big platforms don't do that any more. Their algorithms are built for
something else now. I can still meet someone new on them, but they take a
thousand times more than they give back.

I have a personal website. Sometimes a kind email arrives from a stranger
in another country. They found me on Bear Blog's discover page, found my
email on my contact page, and wrote about something I'd written and
something they'd lived: sometimes the same as me, sometimes not. Each time,
I get that feeling back: maybe technology can still give me new friends.

But there was nothing between us that helped. They had to find me, find my
address, and decide to write. Those emails are where nine turtles began. I
wanted something that helps people meet the strangers worth knowing,
through what they write, and write back.

## What it is

nine turtles is a quiet place to read the people whose writing you love:
their blogs, newsletters, videos and podcasts, under their names. No
algorithm, no likes, no counts. It ends when you've read what's there. When
something moves you, you write back from your own email. nine turtles never
sends or reads it.

## The name

Turtles are slow, and the social web is fast. I wanted a name you'd
remember, and I suspect you asked "why nine?". That's how you'll remember
it. The logo is nine small turtles, in three rows of three.

## Who makes it

I'm [{{ site.maker }}]({{ site.makerSite }}). I make nine turtles on my own,
and I read every email myself:
<a href="mailto:{{ site.email }}">{{ site.email }}</a>.

I design nine turtles and decide what it does; AI agents write its code, in
the open, where anyone can read it.

<!-- Nine turtles in single file (the logo's turtle, docs/logo/): seven ahead and two a few steps behind, drawn still (DESIGN.md, "The About page's end"). The line under them says it in words, so screen readers skip the drawing. -->
<div class="walk">
  <div class="procession" aria-hidden="true">
    {%- for i in range(9) %}<svg class="turtle{% if i == 1 %} behind{% endif %}" viewBox="-10 -4.5 22 8.5" focusable="false"><path d="M-9 3.5 A7.5 7.5 0 0 1 6 3.5 Z"/><circle cx="8.6" cy="0.6" r="2"/></svg>{% endfor -%}
  </div>
  <p>Some of us like to read slowly. That&rsquo;s the idea.</p>
</div>
