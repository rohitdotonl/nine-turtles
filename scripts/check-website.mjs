// Checks the built website (website/_site) in a real browser, as the app's
// browser tests check the app: every page, by day and by night, on a
// computer and a phone, has no accessibility or contrast problems that the
// automatic checker can find (WCAG AA), and works with the keyboard alone:
// a skip link first, and a visible outline on every link and control. The
// feed finder shows what the app answers, without the keyboard getting lost
// or anything failing the checks. Every link and
// picture within the website leads to a real file. Borrows
// Playwright and axe from web/, so the website needs no testing libraries of
// its own (decision 0066).
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
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".js": "text/javascript",
  ".xml": "application/atom+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".opml": "text/x-opml; charset=utf-8",
};

// Every page the website has, and the page shown for an address it doesn't.
const pages = readdirSync(site, { recursive: true })
  .filter((file) => file.endsWith("index.html"))
  .map((file) => "/" + file.replace(/index\.html$/, "").split("\\").join("/"))
  .concat("/404.html");

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
        // Every link and picture within the website leads somewhere real.
        if (colorScheme === "light" && device === "computer") {
          const targets = await page.evaluate(() =>
            [...document.querySelectorAll("a[href^='/'], img[src^='/'], link[href^='/']")].map((el) => el.getAttribute("href") ?? el.getAttribute("src")),
          );
          for (const target of new Set(targets)) {
            const reply = await page.request.get(base + target.split("#")[0]);
            if (!reply.ok()) problems.push(`${path}: the link or picture ${target} leads nowhere (${reply.status()})`);
          }
        }
        // With the keyboard alone: the first Tab shows "Skip to the text" on
        // screen, and every link after it shows a visible focus outline.
        await page.keyboard.press("Tab");
        const first = await page.evaluate(() => {
          const element = document.activeElement;
          const box = element.getBoundingClientRect();
          return { text: element.textContent.trim(), onScreen: box.left >= 0 && box.top >= 0 && box.width > 0 };
        });
        if (first.text !== "Skip to the text" || !first.onScreen) {
          problems.push(`${path} (${colorScheme}, ${device}): the first Tab doesn't show "Skip to the text"`);
        }
        const stops = await page.locator("a, input, button").count();
        for (let index = 1; index < stops; index++) {
          await page.keyboard.press("Tab");
          const ring = await page.evaluate(() => {
            const style = getComputedStyle(document.activeElement);
            return { tag: document.activeElement.tagName, outline: style.outlineStyle, width: parseFloat(style.outlineWidth) };
          });
          if (!["A", "INPUT", "BUTTON"].includes(ring.tag) || ring.outline === "none" || ring.width < 2) {
            problems.push(`${path} (${colorScheme}, ${device}): link or control ${index + 1} has no visible focus outline from the keyboard`);
          }
        }
      }
      await context.close();
    }
  }

  // A starter pack's download (decision 0100), from the made-up test pack
  // scripts/check.sh builds: plain OPML listing each blog's feed and site.
  {
    const page = await browser.newPage();
    const reply = await page.request.get(base + "/packs/test-pack.opml");
    if (!reply.ok()) problems.push(`/packs/test-pack.opml: didn't load (${reply.status()})`);
    else {
      const opml = await page.evaluate((text) => {
        const doc = new DOMParser().parseFromString(text, "application/xml");
        if (doc.querySelector("parsererror")) return null;
        return [...doc.querySelectorAll("outline[xmlUrl]")].map((o) => [o.getAttribute("text"), o.getAttribute("xmlUrl"), o.getAttribute("htmlUrl")]);
      }, await reply.text());
      const expected = [
        ["Quiet & Slow <Notes>", "https://quiet.example/feed.xml", "https://quiet.example/"],
        ["Plain Pages", "https://plain.example/atom.xml", "https://plain.example/"],
      ];
      if (JSON.stringify(opml) !== JSON.stringify(expected)) {
        problems.push(`/packs/test-pack.opml: isn't the pack's feeds as OPML (${JSON.stringify(opml)})`);
      }
    }
    await page.close();
  }

  // The feed finder, with the app's answers made up here: it never asks the
  // real app.
  const answers = {
    "quiet.example": {
      status: 200,
      body: {
        feeds: [
          { title: "All posts", url: "https://quiet.example/feed.xml" },
          { title: "Comments", url: "https://quiet.example/comments.atom" },
        ],
        preview: {
          title: "Quiet Notes",
          site: "https://quiet.example/",
          articles: [
            { title: "A slow morning", link: "https://quiet.example/2", published: 1767258000 },
            { title: "<b>Not bold</b>", link: "javascript:alert(1)", published: null },
          ],
        },
      },
    },
    "plain.example": { status: 422, body: { error: "no-feed" } },
  };
  for (const colorScheme of ["light", "dark"]) {
    const context = await browser.newContext({ colorScheme, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const asked = [];
    await page.route("https://app.nineturtles.app/api/find-feeds**", (route) => {
      const url = new URL(route.request().url());
      asked.push({ address: url.searchParams.get("address"), cookie: route.request().headers().cookie });
      const answer = answers[url.searchParams.get("address")] ?? { status: 502, body: { error: "unreachable" } };
      route.fulfill({
        status: answer.status,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify(answer.body),
      });
    });
    const where = `/feed-finder/ (${colorScheme}, finding feeds)`;
    await page.goto(base + "/feed-finder/");
    await page.getByLabel("A website's address").fill("quiet.example");
    await page.keyboard.press("Enter");
    await page.locator(".feed-url").first().waitFor({ timeout: 5000 }).catch(() => {});
    const shown = await page.evaluate(() => ({
      status: document.querySelector(".finder-status").textContent,
      addresses: [...document.querySelectorAll(".feed-url")].map((code) => code.textContent),
      links: [...document.querySelectorAll(".preview a")].map((a) => a.getAttribute("href")),
      bold: document.querySelectorAll(".preview b").length,
      address: location.search,
    }));
    if (!shown.status.startsWith("Found 2 feeds")) problems.push(`${where}: says "${shown.status}" instead of finding two feeds`);
    if (shown.addresses.join() !== "https://quiet.example/feed.xml,https://quiet.example/comments.atom") {
      problems.push(`${where}: shows the addresses ${shown.addresses.join(", ")}`);
    }
    if (shown.links.join() !== "https://quiet.example/2") problems.push(`${where}: links the titles to ${shown.links.join(", ")}`);
    if (shown.bold !== 0) problems.push(`${where}: shows a title's HTML as HTML`);
    if (shown.address !== "?address=quiet.example") problems.push(`${where}: the page's address is ${shown.address}`);
    if (asked.some((question) => question.cookie)) problems.push(`${where}: sends cookies to the app`);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
    for (const violation of results.violations) problems.push(`${where}: ${violation.help} (${violation.nodes.length} place(s))`);

    // A page with no feed says so, and clears what was shown before.
    await page.getByLabel("A website's address").fill("plain.example");
    await page.getByRole("button", { name: "Find its feed" }).click();
    await page.waitForFunction(() => !document.querySelector(".finder-status").textContent.startsWith("Looking"), null, { timeout: 5000 }).catch(() => {});
    const after = await page.evaluate(() => ({
      status: document.querySelector(".finder-status").textContent,
      left: document.querySelectorAll(".feed-url").length,
    }));
    if (!after.status.startsWith("That page doesn't name a feed") || after.left !== 0) {
      problems.push(`${where}: a page without a feed shows "${after.status}" and ${after.left} address(es)`);
    }

    // The bookmark button, pressed here, says how to keep it rather than
    // looking up the finder's own page.
    await page.locator(".bookmarklet").click();
    const hint = await page.locator(".finder-status").textContent();
    if (!hint.startsWith("Drag Find feed")) problems.push(`${where}: pressing Find feed here says "${hint}"`);

    // Opened with an address (as the bookmark button does), it looks straight away.
    await page.goto(base + "/feed-finder/?address=quiet.example");
    await page.locator(".feed-url").first().waitFor({ timeout: 5000 }).catch(() => problems.push(`${where}: an address in the page's address isn't looked up`));
    await context.close();
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
