# The nine turtles website

The pages of nineturtles.app (decision 0066). Eleventy turns the Markdown
pages in `src/` into plain web pages in `_site/`, using the layout in
`src/_includes/base.njk` and the styles in `src/style.css`. The fonts and
icons are copied from `web/public` when it's built.

- What each page is, and where to change the contact address:
  `docs/operations/website-and-domain.md` → "What the website says, and where"
- Build it: `npm ci && npm run build`
- See it while you edit: `npm start`, then open http://localhost:8080
- Check it: `scripts/check.sh website` from the repository's top folder
- How it's published, and the owner's domain setup:
  `docs/operations/website-and-domain.md`
