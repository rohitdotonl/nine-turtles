// Builds the nine turtles website (nineturtles.app) from the pages in src/
// into _site/, plain files any web host can serve (decision 0066).
// The fonts and icons are the app's own, copied from web/public, so the
// website and the app always match and there's only one copy in the repository.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export default function (eleventyConfig) {
  // A short fingerprint of the styles, added to their address on every
  // page (style.css?v=…), so a browser that kept yesterday's styles fetches
  // the new ones as soon as they change, instead of showing new pages with
  // old styles for up to ten minutes (GitHub Pages lets browsers keep files
  // that long).
  const styles = readFileSync(new URL("./src/style.css", import.meta.url));
  eleventyConfig.addGlobalData("stylesVersion", createHash("sha256").update(styles).digest("hex").slice(0, 10));

  // The same for the feed finder's script.
  const finder = readFileSync(new URL("./src/feed-finder.js", import.meta.url));
  eleventyConfig.addGlobalData("finderVersion", createHash("sha256").update(finder).digest("hex").slice(0, 10));

  eleventyConfig.addPassthroughCopy({ "src/style.css": "style.css" });
  eleventyConfig.addPassthroughCopy({ "src/feed-finder.js": "feed-finder.js" });
  eleventyConfig.addPassthroughCopy({ "src/images": "images" });
  eleventyConfig.addPassthroughCopy({
    "../web/public/fonts/literata-400-latin.woff2": "fonts/literata-400-latin.woff2",
    "../web/public/fonts/literata-600-latin.woff2": "fonts/literata-600-latin.woff2",
    "../web/public/fonts/inter-400-latin.woff2": "fonts/inter-400-latin.woff2",
    "../web/public/fonts/inter-600-latin.woff2": "fonts/inter-600-latin.woff2",
    "../web/public/fonts/OFL-Literata.txt": "fonts/OFL-Literata.txt",
    "../web/public/fonts/OFL-Inter.txt": "fonts/OFL-Inter.txt",
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

  // Starter packs (src/packs/), in the order each pack names.
  eleventyConfig.addCollection("packs", (collections) =>
    collections.getFilteredByGlob("src/packs/*.md").sort((a, b) => a.data.order - b.data.order),
  );
  // Only a pack with blogs gets a download (src/packs-opml.njk).
  eleventyConfig.addCollection("packsWithBlogs", (collections) =>
    collections.getFilteredByGlob("src/packs/*.md").filter((pack) => pack.data.blogs?.length),
  );
  eleventyConfig.ignores.add("src/packs/README.md");

  return {
    dir: { input: "src", output: "_site" },
    markdownTemplateEngine: "njk",
  };
}
