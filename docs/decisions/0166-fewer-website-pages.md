# 0166: Fewer website pages, and Rohit's story on About

*3 November 2026. Step 1b of the owner's review. Rohit asked for fewer
pages, each one true, and his own story on About; he said go on the whole
plan the same day.*

## Decision

- **The tour ("How it works") and Questions (FAQ) go.** What the tour said
  is in Help, one page per feature; the front page stays as it is, ending
  on its button (Help is in the band and footer). Questions' price answers ("Can I use it today?", "What will it
  cost?") move to Pricing; the rest become one Help page, **Questions people
  ask** (`/help/questions/`), with the tour's lines on polite fetching and
  accessibility.
- **About is Rohit's story,** in his voice, a draft he edits himself: how a
  social network once found him friends, the emails strangers send after
  reading his website, and why nine turtles helps people write back. Then
  what it is, the name, who makes it and how (AI agents write its code, in
  the open). The written philosophy that was there lives in `DESIGN.md`; the
  accessibility promise has its own page in the footer. The turtles' walk
  still ends the page.
- **The band** holds Help and Open the app. **The footer's first row** is
  Help, Feed finder, Pricing, About and Contact. "New to feeds?" is linked
  from Help and the app, no longer from every page.
- **Old addresses lead to their new places,** so no saved link breaks: the
  tour to Help, Questions to Questions people ask, the hidden blog and its
  posts to About. They're one list, `website/src/_data/redirects.json`,
  which also holds `/docs` (decision 0157); the website's check makes sure
  each leads to a page that exists. The blog's feed address can't be sent
  on (GitHub Pages can't redirect a feed), so it stops while the blog is
  hidden.
- The tour's three pictures (Settings and two phone screens) go with it:
  they showed screens that have since changed.

## Why

Every page has to be true, and fewer pages are easier to keep true. The
tour repeated Help and had fallen behind the app; Questions repeated
Pricing and Help. About is where a stranger decides whether a person is
behind this, and Rohit's own story says that better than a list of rules.
