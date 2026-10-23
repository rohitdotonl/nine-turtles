import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

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

test("a fresh slowfeed shows only the paste field", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/unread");
  await appReady(page);
  await signIn(page);
  await expect(field(page)).toBeVisible();
  await expect(page.getByText("Nothing to read yet. Add a website you like to begin.")).toBeVisible();
  await expect(page.getByText("Import OPML")).toHaveCount(0);
  await expect(sidebar(page).getByRole("link", { name: "+ Add feed" })).toBeVisible();
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

  await sidebar(page).getByRole("link", { name: "+ Add feed" }).click();
  await field(page).fill(`${FEED_SITE}/blog/${name}/`);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText("You already follow this feed.");
  await expect(sidebar(page).getByRole("link", { name: `Blog ${name}` })).toHaveCount(1);

  await page.getByRole("link", { name: `Go to Blog ${name}` }).click();
  await expect(page.getByRole("heading", { level: 2, name: `Blog ${name}` })).toBeVisible();
});

test("a site with several feeds offers a choice", async ({ page }) => {
  await openApp(page, "/add-feed");
  const name = newBlog("two");
  await field(page).fill(`${FEED_SITE}/blog/${name}/`);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText("This site offers more than one feed. Choose one:");
  await page.getByRole("button", { name: /^Comments/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: `Blog ${name}: comments` })).toBeVisible();
});

test("a page without a feed gets a calm, plain message", async ({ page }) => {
  await openApp(page, "/add-feed");
  await field(page).fill(`${FEED_SITE}/plain/`);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText("This site doesn't seem to offer a feed.");

  await field(page).fill("not an address");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText("That doesn't look like a web address.");
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
  await sidebar(page).getByRole("link", { name: "Quiet Notes", exact: true }).click();

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
