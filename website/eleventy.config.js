// Builds the nine turtles website (nineturtles.app) from the pages in src/
// into _site/, plain files any web host can serve (decision 0066).
// The fonts and icons are the app's own, copied from web/public, so the
// website and the app always match and there's only one copy in the repository.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// nine turtles' own addresses: links to them aren't links to another site.
const OWN_HOSTS = new Set(["nineturtles.app", "www.nineturtles.app", "app.nineturtles.app"]);
const NEW_TAB = '<span class="sr-only"> (opens in a new tab)</span>';

export default function (eleventyConfig) {
  // A short fingerprint of the styles, added to their address on every
  // page (style.css?v=…), so a browser that kept yesterday's styles fetches
  // the new ones as soon as they change, instead of showing new pages with
  // old styles for up to ten minutes (GitHub Pages lets browsers keep files
  // that long).
  const styles = readFileSync(new URL("./src/style.css", import.meta.url));
  eleventyConfig.addGlobalData("stylesVersion", createHash("sha256").update(styles).digest("hex").slice(0, 10));

  // The same for the feed finder's and the blog checkup's scripts.
  const finder = readFileSync(new URL("./src/feed-finder.js", import.meta.url));
  eleventyConfig.addGlobalData("finderVersion", createHash("sha256").update(finder).digest("hex").slice(0, 10));
  const checkup = readFileSync(new URL("./src/blog-checkup.js", import.meta.url));
  eleventyConfig.addGlobalData("checkupVersion", createHash("sha256").update(checkup).digest("hex").slice(0, 10));

  // The blog is hidden until Rohit writes in it at least once a month (the
  // owner's review, 3 November 2026). Its posts stay here, ready to return:
  // remove this line, the blog's links in base.njk, and the /blog/ lines in
  // _data/redirects.json (they'd claim the blog's addresses), to bring it back.
  eleventyConfig.ignores.add("src/blog/**");

  eleventyConfig.addPassthroughCopy({ "src/style.css": "style.css" });
  eleventyConfig.addPassthroughCopy({ "src/feed-finder.js": "feed-finder.js" });
  eleventyConfig.addPassthroughCopy({ "src/blog-checkup.js": "blog-checkup.js" });
  eleventyConfig.addPassthroughCopy({ "src/images": "images" });
  eleventyConfig.addPassthroughCopy({
    "../web/public/fonts/literata-400-latin.woff2": "fonts/literata-400-latin.woff2",
    "../web/public/fonts/literata-600-latin.woff2": "fonts/literata-600-latin.woff2",
    "../web/public/fonts/atkinson-hyperlegible-next-400-latin.woff2": "fonts/atkinson-hyperlegible-next-400-latin.woff2",
    "../web/public/fonts/atkinson-hyperlegible-next-600-latin.woff2": "fonts/atkinson-hyperlegible-next-600-latin.woff2",
    "../web/public/fonts/OFL-Literata.txt": "fonts/OFL-Literata.txt",
    "../web/public/fonts/OFL-Atkinson-Hyperlegible-Next.txt": "fonts/OFL-Atkinson-Hyperlegible-Next.txt",
    "../web/public/icons/icon.svg": "icons/icon.svg",
    "../web/public/icons/icon-32.png": "icons/icon-32.png",
    "../web/public/icons/apple-touch-icon.png": "icons/apple-touch-icon.png",
  });

  // Dates as people say them ("25 October 2026"), and as feeds and
  // <time> want them (2026-10-25T00:00:00Z). Always in UTC, so a post's
  // date never shifts with the computer that builds the site.
  eleventyConfig.addFilter("readableDate", (date) =>
    new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
  );
  eleventyConfig.addFilter("isoDate", (date) => new Date(date).toISOString());
  // The newest date in a list of posts, for the blog feed's <updated>.
  eleventyConfig.addFilter("newestDate", (posts) =>
    new Date(Math.max(...posts.map((post) => new Date(post.date)))).toISOString(),
  );
  // Turns a post's links and images into full addresses, as a feed reader
  // needs them (it reads the post away from nineturtles.app).
  eleventyConfig.addFilter("absoluteLinks", (html, base) =>
    html.replace(/(href|src)="\/(?!\/)/g, `$1="${base}/`),
  );

  // The items in a list whose field (a dotted path, like "data.groupId")
  // equals a value: how the Help pages find their group, their related
  // pages and each group's pages (decision 0157).
  eleventyConfig.addFilter("where", (list, path, value) =>
    list.filter((item) => path.split(".").reduce((field, key) => field?.[key], item) === value),
  );

  // A link to another site opens in a new tab, and tells a screen reader so
  // (the owner, 6 November 2026). Links within the website, and to the app
  // (Open the app, Start reading: the way in), stay in the same tab.
  eleventyConfig.addTransform("outsideLinks", function (html) {
    if (!this.page.outputPath?.endsWith(".html")) return html;
    return html.replace(/<a\s([^>]*?)href="(https?:\/\/[^"]+)"([^>]*)>([\s\S]*?)<\/a>/g, (link, before, href, after, words) => {
      if (OWN_HOSTS.has(new URL(href).hostname) || /\starget=/.test(before + after)) return link;
      const rest = (before + after).replace(/\s*rel="[^"]*"/, "").trim();
      return `<a href="${href}" target="_blank" rel="noopener"${rest ? " " + rest : ""}>${words}${NEW_TAB}</a>`;
    });
  });

  return {
    dir: { input: "src", output: "_site" },
    markdownTemplateEngine: "njk",
  };
}
