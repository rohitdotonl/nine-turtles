---
layout: base.njk
front: true
description: "Read people. Write back. There are people online you'd like to know. Most of them have a blog, a newsletter or a channel."
contents:
  - [people, "People, not sources"]
  - [write, "Writing back"]
  - [keep, "You keep who you find"]
  - [ends, "It ends"]
  - [between, "Nobody in between"]
  - [me, "Made by a person"]
---

<!-- The front page (BRAND.md → "The website"; DESIGN.md → "The website's front page"): one text size, one left edge, the settled positioning copy word for word (docs/RnD/positioning.md). -->

<h1 class="lead">Read people. Write back.</h1>

<p>There are people online you'd like to know. Most of them have a blog, a newsletter or a channel. nine turtles keeps them in one quiet place, helps you write back to them, and ends when you've read what's there. No algorithm, no likes, no AI in between. Built on RSS, the open standard, so your list is always yours.</p>

<p><a class="button" href="{{ site.app }}">Open the app</a></p>

<figure class="shot">
  <img class="day" src="/images/app-light.webp" width="1600" height="1000" alt="nine turtles on a computer, by day. On the left, a sidebar with Unread, Starred and All, two folders and three blogs. In the middle, the blog Reading Room's three articles, the last line saying That's everything. On the right, the article The pleasure of a slow letter, by Asha Rao, set in a calm serif on white paper, with a quotation and a drawing of a river." />
  <img class="night" src="/images/app-dark.webp" width="1600" height="1000" alt="nine turtles on a computer, by night: the same sidebar, list and article, in light text on near-black." />
  <figcaption>nine turtles on a computer, following made-up blogs for this picture.</figcaption>
</figure>

<section id="people" aria-labelledby="people-h">
  <h2 id="people-h">People, not sources</h2>
  <p>A writer's blog, newsletter, videos and podcast, together under their name.</p>
</section>

<section id="write" aria-labelledby="write-h">
  <h2 id="write-h">Writing back is built in</h2>
  <p>Reply by email from the article, privately.</p>
</section>

<section id="keep" aria-labelledby="keep-h">
  <h2 id="keep-h">You keep who you find</h2>
  <p>Share any page from a blog into nine turtles and it asks, "Follow this person?"</p>
</section>

<section id="ends" aria-labelledby="ends-h">
  <h2 id="ends-h">It ends</h2>
  <p>No endless scroll, no counts, nothing to check.</p>
</section>

<section id="between" aria-labelledby="between-h">
  <h2 id="between-h">Nobody in between</h2>
  <p>No algorithm, no AI rewriting or ranking, no likes. Export everything in one click.</p>
</section>

<section id="me" aria-labelledby="me-h">
  <h2 id="me-h">Made by a person you can write to</h2>
  <p>Write to <a href="mailto:{{ site.email }}">{{ site.email }}</a>. Every message is read by a person, not a bot.</p>
</section>

<p class="close"><a class="button" href="{{ site.app }}">Open the app</a></p>
