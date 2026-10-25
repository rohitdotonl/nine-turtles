// Builds the nine turtles website (nineturtles.app) from the pages in src/
// into _site/, plain files any web host can serve (decision 0066).
// The fonts and icons are the app's own, copied from web/public, so the
// website and the app always match and there's only one copy in the repository.

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/style.css": "style.css" });
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

  return {
    dir: { input: "src", output: "_site" },
    markdownTemplateEngine: "njk",
  };
}
