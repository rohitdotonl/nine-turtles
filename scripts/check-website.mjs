// Checks the built website (website/_site) in a real browser, as the app's
// browser tests check the app: every page, by day and by night, on a
// computer and a phone, has no accessibility or contrast problems that the
// automatic checker can find (WCAG AA). Borrows Playwright and axe from web/,
// so the website needs no testing libraries of its own (decision 0066).
//
// Needs: `npm ci` and `npx playwright install chromium` in web/, and the
// website built (`npm run build` in website/). scripts/check.sh does both.

import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, normalize, relative } from "node:path";

const root = join(import.meta.dirname, "..");
const site = join(root, "website/_site");
const require = createRequire(join(root, "web/package.json"));
const { chromium } = require("@playwright/test");
const axe = require("@axe-core/playwright");
const AxeBuilder = axe.default ?? axe.AxeBuilder ?? axe;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};

// Every page the website has.
const pages = readdirSync(site, { recursive: true })
  .filter((file) => file.endsWith("index.html"))
  .map((file) => "/" + file.replace(/index\.html$/, "").split("\\").join("/"));

// A tiny web server for the built files, as a host would serve them.
const server = createServer((request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url, "http://x").pathname));
  let file = join(site, path);
  if (relative(site, file).startsWith("..")) file = site;
  try {
    if (statSync(file).isDirectory()) file = join(file, "index.html");
    response.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    response.end(readFileSync(file));
  } catch {
    response.writeHead(404).end("Not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const problems = [];
const browser = await chromium.launch({ executablePath: process.env.NINE_TURTLES_CHROMIUM || undefined });
try {
  for (const colorScheme of ["light", "dark"]) {
    for (const [device, viewport] of [["computer", { width: 1280, height: 800 }], ["phone", { width: 390, height: 844 }]]) {
      const context = await browser.newContext({ colorScheme, viewport });
      const page = await context.newPage();
      for (const path of pages) {
        const answer = await page.goto(base + path);
        if (!answer?.ok()) problems.push(`${path}: didn't load (${answer?.status()})`);
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
        for (const violation of results.violations) {
          problems.push(`${path} (${colorScheme}, ${device}): ${violation.help} (${violation.nodes.length} place(s))`);
        }
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

if (problems.length > 0) {
  console.error("Website check failed:\n" + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log(`Website check passed (${pages.length} page(s), day and night, computer and phone).`);
