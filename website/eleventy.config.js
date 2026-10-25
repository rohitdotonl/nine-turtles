// Builds the nine turtles website (nineturtles.app) from the pages in src/
// into _site/, plain files any web host can serve (decision 0066).
// The fonts and icons are the app's own, copied from web/public, so the
// website and the app always match and there's only one copy in the repository.

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/style.css": "style.css" });
  eleventyConfig.addPassthroughCopy({
    "../web/public/fonts/literata-400-latin.woff2": "fonts/literata-400-latin.woff2",
    "../web/public/fonts/literata-600-latin.woff2": "fonts/literata-600-latin.woff2",
    "../web/public/fonts/inter-400-latin.woff2": "fonts/inter-400-latin.woff2",
    "../web/public/fonts/inter-600-latin.woff2": "fonts/inter-600-latin.woff2",
    "../web/public/fonts/OFL-Literata.txt": "fonts/OFL-Literata.txt",
    "../web/public/fonts/OFL-Inter.txt": "fonts/OFL-Inter.txt",
    "../web/public/icons/icon-192.png": "icons/icon-192.png",
    "../web/public/icons/apple-touch-icon.png": "icons/apple-touch-icon.png",
  });

  return {
    dir: { input: "src", output: "_site" },
    markdownTemplateEngine: "njk",
  };
}
