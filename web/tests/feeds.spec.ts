import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn, tabTo } from "./screens";

// SPEC sections 2, 3 and 6, "How to check it", done by a browser. Tests that
// add feeds use the slowfeed that may read the made-up publisher
// (playwright.config.ts), each with a blog of its own.

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });
const field = (page: Page) => page.getByLabel("Paste a website or feed URL");

async function openApp(page: Page, path: string, base = FEEDS_APP) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL(path, base).href);
  await appReady(page);
  await signIn(page);
}

/** A blog name no other test uses. */
function newBlog(prefix = "blog"): string {
  return `${prefix}-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
}

test("a fresh slowfeed shows the welcome in the reading area: the paste field, and importing OPML", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/unread");
  await appReady(page);
  await signIn(page);
  // The welcome is in the reading area, centred, and owns the screen (decision 0041): the list
  // beside it says nothing, and the sidebar has no find field while there's nothing to find.
  const reading = page.getByRole("region", { name: "A quiet place to read." });
  await expect(reading.getByRole("heading", { level: 2, name: "A quiet place to read." })).toBeVisible();
  await expect(reading.getByLabel("Paste a website or feed URL")).toBeVisible();
  await expect(reading.getByRole("button", { name: "Add feed" })).toBeVisible();
  await expect(page.getByText("Nothing here yet.")).toHaveCount(0);
  await expect(sidebar(page).getByRole("searchbox", { name: "Find a feed or folder" })).toHaveCount(0);
  await expect(page.getByText("No article open.")).toHaveCount(0);
  const [welcome, pane] = await Promise.all([reading.locator("#welcome-heading").boundingBox(), reading.boundingBox()]);
  expect(Math.abs(welcome!.x + welcome!.width / 2 - (pane!.x + pane!.width / 2))).toBeLessThan(4);
  // The field is wide enough for a real address.
  expect((await field(page).boundingBox())!.width).toBeGreaterThan(280);
  // "Import an OPML file…", a quiet button under the field, leads to Settings, at Your data.
  await page.getByRole("link", { name: "import an OPML file" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { level: 3, name: "Your data" })).toBeFocused();
  await expect(sidebar(page).getByRole("link", { name: "Add feed" })).toBeVisible();
});

test("on a phone-narrow window, a fresh slowfeed shows the welcome in the list's place", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/unread");
  await appReady(page);
  await signIn(page);
  const list = page.getByRole("region", { name: "Unread" });
  await expect(list.getByRole("heading", { level: 2, name: "A quiet place to read." })).toBeVisible();
  await expect(list.getByLabel("Paste a website or feed URL")).toBeVisible();
  await expect(list.getByRole("link", { name: "import an OPML file" })).toBeVisible();
  await expect(page.getByText("Nothing here yet.")).toHaveCount(0);
});

test("a, a website's address and Enter add its feed, and its articles appear", async ({ page }) => {
  await openApp(page, "/all");
  const name = newBlog();
  await page.keyboard.press("a");
  await expect(page).toHaveURL(/\/add-feed$/);
  await expect(field(page)).toBeFocused();

  await page.keyboard.type(`${FEED_SITE}/blog/${name}/`);
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/feeds\/[0-9]+$/);
  await expect(page.getByRole("heading", { level: 2, name: `Blog ${name}` })).toBeFocused();
  await expect(page).toHaveTitle(`Blog ${name} · slowfeed`);
  const link = sidebar(page).getByRole("link", { name: `Blog ${name}` });
  await expect(link).toHaveAttribute("aria-current", "page");

  const rows = page.getByRole("region", { name: `Blog ${name}` }).getByRole("listitem");
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText("On keeping a commonplace book (3)");
  await expect(rows.first()).toContainText(`Blog ${name} · 20 Oct`);

  // Reloading keeps the place.
  await page.reload();
  await appReady(page);
  await expect(page.getByRole("heading", { level: 2, name: `Blog ${name}` })).toBeVisible();
});

test("a feed's own address works, and adding it twice says it's already there", async ({ page }) => {
  await openApp(page, "/add-feed");
  const name = newBlog();
  await field(page).fill(`${FEED_SITE}/blog/${name}/feed.xml`);
  await page.getByRole("button", { name: "Add feed" }).click();
  await expect(page.getByRole("heading", { level: 2, name: `Blog ${name}` })).toBeVisible();

  await sidebar(page).getByRole("link", { name: "Add feed" }).click();
  await field(page).fill(`${FEED_SITE}/blog/${name}/`);
  await page.keyboard.press("Enter");
  await expect(page.locator("#feed-address-status")).toHaveText("You already follow this feed.");
  await expect(sidebar(page).getByRole("link", { name: `Blog ${name}` })).toHaveCount(1);

  await page.getByRole("link", { name: `Go to Blog ${name}` }).click();
  await expect(page.getByRole("heading", { level: 2, name: `Blog ${name}` })).toBeVisible();
});

test("a site with several feeds offers a choice", async ({ page }) => {
  await openApp(page, "/add-feed");
  const name = newBlog("two");
  await field(page).fill(`${FEED_SITE}/blog/${name}/`);
  await page.keyboard.press("Enter");
  await expect(page.locator("#feed-address-status")).toHaveText("This site offers more than one feed. Choose one:");
  await page.getByRole("button", { name: /^Comments/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: `Blog ${name}: comments` })).toBeVisible();
});

test("a page without a feed gets a calm, plain message", async ({ page }) => {
  await openApp(page, "/add-feed");
  await field(page).fill(`${FEED_SITE}/plain/`);
  await page.keyboard.press("Enter");
  await expect(page.locator("#feed-address-status")).toHaveText("This site doesn't seem to offer a feed. Try the feed's own address, or the site's home page.");
  // The field is marked as refused, for screen readers and by its firmer edge.
  await expect(field(page)).toHaveAttribute("aria-invalid", "true");

  await field(page).fill("not an address");
  await page.keyboard.press("Enter");
  await expect(page.locator("#feed-address-status")).toHaveText("That doesn't look like a web address.");
});

test("Escape leaves Add a feed for the list you were on", async ({ page }) => {
  await openApp(page, "/all");
  await page.keyboard.press("a");
  await expect(field(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/all$/);
});

test("the list shows 50 articles, then Show older items adds more below", async ({ page }) => {
  await openApp(page, "/all");
  await follow(page, `${FEED_SITE}/`);
  await page.reload();
  await appReady(page);
  await sidebar(page).getByRole("link", { name: /^Quiet Notes( \d+ unread)?$/ }).click();

  const list = page.getByRole("region", { name: "Quiet Notes" });
  const rows = list.getByRole("listitem");
  await expect(rows).toHaveCount(50);
  // Where the first row sits inside the list, whatever the scrolling.
  const firstTop = () => rows.first().evaluate((row) => (row as HTMLElement).offsetTop);
  const firstBefore = await firstTop();
  await list.getByRole("button", { name: "Show older items" }).click();
  await expect(rows).toHaveCount(60);
  expect(await firstTop()).toBe(firstBefore);
  await expect(rows.last()).toContainText("(1)");
  // The list has an end.
  await expect(list.getByRole("button", { name: "Show older items" })).toHaveCount(0);
});

// The keyboard floor: everything above also works with the keyboard alone.

test("with only the keyboard: choose one of several feeds, then go back to it from the sidebar", async ({ page }) => {
  await openApp(page, "/all");
  const name = newBlog("two");
  await page.keyboard.press("a");
  await page.keyboard.type(`${FEED_SITE}/blog/${name}/`);
  await page.keyboard.press("Enter");
  await expect(page.locator("#feed-address-status")).toHaveText("This site offers more than one feed. Choose one:");

  const comments = page.getByRole("button", { name: /^Comments/ });
  await tabTo(page, comments);
  await page.keyboard.press("Enter");
  const heading = page.getByRole("heading", { level: 2, name: `Blog ${name}: comments` });
  await expect(heading).toBeFocused();

  // Into the sidebar and back to the same feed after visiting All.
  await page.keyboard.press("g");
  await page.keyboard.press("a");
  await expect(page).toHaveURL(/\/all$/);
  const link = sidebar(page).getByRole("link", { name: `Blog ${name}: comments` });
  await tabTo(page, link, 400);
  await page.keyboard.press("Enter");
  await expect(heading).toBeFocused();
});

test("with only the keyboard: 'Go to' a feed you already follow", async ({ page }) => {
  await openApp(page, "/all");
  const name = newBlog();
  await follow(page, `${FEED_SITE}/blog/${name}/`);
  await page.keyboard.press("a");
  await page.keyboard.type(`${FEED_SITE}/blog/${name}/feed.xml`);
  await page.keyboard.press("Enter");
  await expect(page.locator("#feed-address-status")).toHaveText("You already follow this feed.");
  await tabTo(page, page.getByRole("link", { name: /^Go to / }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 2, name: `Blog ${name}` })).toBeFocused();
});

test("with only the keyboard: Show older items, and the keyboard's place stays in the list at the end", async ({ page }) => {
  await openApp(page, "/all");
  await follow(page, `${FEED_SITE}/`);
  await page.reload();
  await appReady(page);
  const feed = sidebar(page).getByRole("link", { name: /^Quiet Notes( \d+ unread)?$/ });
  await tabTo(page, feed, 400);
  await page.keyboard.press("Enter");

  const list = page.getByRole("region", { name: "Quiet Notes" });
  const rows = list.getByRole("listitem");
  await expect(rows).toHaveCount(50);
  await tabTo(page, list.getByRole("button", { name: "Show older items" }), 400);
  await page.keyboard.press("Enter");
  await expect(rows).toHaveCount(60);
  // The button is gone (the list has ended); the keyboard's place moved to
  // the first article that just arrived, not to the top of the page.
  await expect(rows.nth(50).getByRole("button")).toBeFocused();
});

test("an address for a feed you don't follow says so", async ({ page }) => {
  await openApp(page, "/feeds/999999");
  await expect(page.getByRole("heading", { level: 2, name: "Feed not found" })).toBeVisible();
  await expect(page.getByText("You don't follow this feed.")).toBeVisible();
});
