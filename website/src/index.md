---
layout: base.njk
front: true
description: "A letter from Rohit, who makes nine turtles: a quiet place to read the people worth knowing, and to write back to them."
---

<!-- The front page is Rohit's letter (decision 0169; BRAND.md → "The website"; DESIGN.md → "The website's front page"). His story, in his voice, a draft he edits himself. The picture shows only what Write back does today (SPEC section 37). -->

<h1 class="hello">Hello,</h1>

<p>years ago, a social network introduced me to strangers. Some of them became friends I still have today. It did something simple: it showed me people, and let us talk.</p>

<p>The big platforms don't do that any more. They're built to keep you scrolling, and they take far more than they give back.</p>

<p>I write on my own website. Now and then, an email arrives from someone I've never met, in another country, about something I wrote and something they lived. Every time, I get that old feeling back. The internet can still give you new friends. It just needs a little help.</p>

<p class="big">So I made nine turtles: a quiet place to read the people worth knowing, and to write back to them.</p>

<p>You follow the people whose writing you love: their blogs, newsletters, videos and podcasts, together under their names. You read them without an algorithm, likes or counts. When a line stays with you, you highlight it and write back to them, from your own email.</p>

<div class="steps" role="img" aria-label="Three steps in nine turtles. Read: the essay The pleasure of a slow letter, by Asha Rao. Highlight: a line from it, marked in pencil. Write back: the button Write back to Asha, with her address under it, opens your own email app, addressed to her, with the subject Re: The pleasure of a slow letter, and your words.">
  <div class="panel">
    <span class="step">Read</span>
    <span class="title">The pleasure of a slow letter</span>
    <span class="by">Asha Rao · 20 Oct</span>
    <span class="text">Most of what I read now arrives instantly and leaves just as fast.</span>
  </div>
  <div class="panel">
    <span class="step">Highlight</span>
    <span class="text"><mark>The point of reading slowly is not to read less. It is to let what you read stay.</mark></span>
  </div>
  <div class="panel">
    <span class="step">Write back</span>
    <span class="writeback">Write back to Asha</span>
    <span class="by centre">asha@asharao.example</span>
    <span class="mail">
      <span class="field">To: asha@asharao.example</span>
      <span class="field">Re: The pleasure of a slow letter</span>
      <span class="text">This line stayed with me all week…</span>
    </span>
    <span class="by">In your own email app</span>
  </div>
</div>

<p>It ends when you've read what's there, and there's nothing to check. It's built on RSS, the open standard, so your list is always yours, and you can take everything with you in one click.</p>

<p>You can start reading today. When I set a price, it will be on the <a href="/pricing/">Pricing</a> page before anyone pays. That's what will keep nine turtles running, and keep it mine to answer for.</p>

<p class="signature"><span class="name">{{ site.maker }}</span><span class="quiet">I make nine turtles, and I read every email myself.</span></p>

<div class="letter-end">
  <p><a class="button" href="{{ site.app }}">Start reading</a></p>
  <p class="ps">P.S. Write back to me: <a href="mailto:{{ site.email }}">{{ site.email }}</a>. That's the whole idea.</p>
</div>
