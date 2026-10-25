# 0066: A website at nineturtles.app, the app at app.nineturtles.app, one repository

*25 October 2026. Asked for by the owner.*

**Decision.** nine turtles gets a website and its own domain:

- **nineturtles.app** is the website. Its pages are in `website/`, in this
  same repository (a "monorepo": one repository holding several parts),
  next to `server/` and `web/`. **Eleventy** (`@11ty/eleventy`, approved by
  the owner) turns them into plain HTML files. GitHub Pages hosts them,
  published by `.github/workflows/website.yml` when a merge into main
  changes the website.
- **app.nineturtles.app** is the app, still the one Render service. The
  owner adds the address in Render; slowfeed.onrender.com keeps working.
- The website wears the app's Original theme and its fonts, copied from
  `web/public` when it's built, so there's one copy of each. DESIGN.md's
  floors apply to it: contrast, keyboard, no motion.

**Checks and deploys.** `.github/code-changed.sh` now says two things: is
anything besides documents changed (`code`), and is anything besides
documents and the website changed (`app`). A change to only the website
runs the website's checks (`scripts/check.sh website`: build, then axe in
a real browser, by day and night, on a computer and a phone) and skips the
app's checks and image. The same rule now applies to merges into main
(comparing with the commit before the push), so a merge that changes only
the website or documents doesn't rebuild or redeploy the app. The library
check and the no-motion check read the website too.

**Why.** One repository keeps one set of documents, rules and checks, and
agents see the whole project at once. The site is separate from the app at
run time, so it stays up when the app is down or deploying, and it never
needs the owner's password or data. Eleventy is small, mature and produces
plain files, so the site can move to any host (Render's static sites,
Cloudflare Pages, Netlify) by pointing the domain elsewhere: no lock-in.
GitHub Pages is free for a public repository and needs no new account.

**Rejected.** A separate repository for the website (two sets of rules and
checks to keep true); hosting the website inside the app on Render (one
outage takes both down, and every website change would redeploy the app);
Render's free static site (another service to set up in Render, which agents
can't reach).

**Revisit if** the website needs anything a static site can't do, or the
repository's checks get slow because of it.
