---
layout: page.njk
title: Accessibility
description: How nine turtles makes sure everyone can read, and how to tell us when something falls short.
permalink: /accessibility/
updated: 2026-10-25
---

<p class="lede">
  nine turtles has one rule above all the others: everyone can read here.
  No amount of calm or minimalism is worth text that some people can't
  read.
</p>

## What we hold ourselves to

The app and this website aim to meet the
[Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/)
at level AA, and go further where reading is concerned:

- **Contrast.** Every piece of text meets AA contrast, including the quiet
  grey of dates and counts. Article text meets the stricter AAA level, in
  every theme, by day and by night.
- **Never color alone.** Every state has a second sign: an unread article
  has a dot and a heavier title, a search match is underlined as well as
  shaded, a problem is described in words.
- **A keyboard for everything.** Every action works with Tab, Enter and
  Escape, with a clearly visible outline showing where you are. Single-key
  shortcuts are an extra, never the only way.
- **Screen readers.** Each part of the screen is a landmark, the article
  you're on is announced, changes like "marked as read" are spoken, and
  each article is marked with its language, so it's read in the right
  voice.
- **Your device's settings.** nine turtles follows your text size, light or
  dark, high contrast and reduced motion settings. It has no animations at
  all.
- **Room to touch.** Everything you tap on a phone is at least 44 pixels
  across.
- **Fonts for reading.** Besides Literata, you can read in Atkinson
  Hyperlegible, a typeface designed for people with low vision, at six text
  sizes and three line widths.

## How it's checked

Every change to nine turtles is checked automatically before it can go
live: each screen, by day and by night, on a computer and a phone, is
tested in a real browser for contrast and accessibility problems, and for
working with the keyboard alone. These checks catch a lot, but not
everything that matters to a real person reading, which is why we want to
hear from you.

## Known gaps

- The app's interface is in English only for now. Articles can be in any
  language.
- Search doesn't yet understand Chinese or Japanese.
- Articles come from publishers' own feeds. If a publisher's images have no
  descriptions, nine turtles can't add them.

## Tell us

If anything in nine turtles is hard to read or use, please write to
<a href="mailto:{{ site.email }}">{{ site.email }}</a> and tell us what
happened and what you use to read (your device, browser, screen reader or
settings). We treat it as a serious bug.
