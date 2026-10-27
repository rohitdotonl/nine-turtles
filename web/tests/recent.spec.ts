import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// SPEC sections 5, 15 and 18 (decision 0105), "How to check it", done by a
// browser: Recently read, hiding it from the sidebar in Settings, and how
// often a feed posts in Edit feed. One test, on a wide window only: which
// lists the sidebar shows is the reader's own setting, shared by every test
// signed in as them, so hiding one must not overlap another test's look at it.

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });
const NEWEST = "On keeping a commonplace book (3)";
const MIDDLE = "Walking the long way home (2)";

test("Recently read lists what was opened, newest first, and can be hidden from the sidebar", async ({ page, isMobile }) => {
  test.skip(isMobile, "the sidebar setting is shared, so one window checks it");
  const blog = `recent-${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${blog}/`);
  await page.goto(new URL(`/feeds/${id}`, FEEDS_APP).href);
  await appReady(page);
  const rows = page.getByRole("button", { name: new RegExp(`Blog ${blog}`) });
  await expect(rows.first()).toBeVisible();

  // Open the newest, then the next one.
  await page.keyboard.press("j");
  await expect(page.getByRole("region", { name: "Article" }).getByRole("heading", { name: NEWEST })).toBeVisible();
  await page.keyboard.press("j");
  await expect(page.getByRole("region", { name: "Article" }).getByRole("heading", { name: MIDDLE })).toBeVisible();

  // Recently read, after All in the sidebar, with no count: the last one opened comes first.
  const link = sidebar(page).getByRole("link", { name: "Recently read", exact: true });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/recent$/);
  await expect(page.getByRole("heading", { level: 2, name: "Recently read" })).toBeVisible();
  await expect(link).toHaveAttribute("aria-current", "page");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveAccessibleName(new RegExp(MIDDLE.replace(/[()]/g, "\\$&")));
  await expect(rows.nth(1)).toHaveAccessibleName(new RegExp(NEWEST.replace(/[()]/g, "\\$&")));

  // Edit feed says how often the feed posts, in words, under its name.
  await page.goto(new URL(`/feeds/${id}/edit`, FEEDS_APP).href);
  await appReady(page);
  await expect(page.locator("#feed-frequency")).toHaveText(/^(Posts about|Posts less|Hasn't posted in|Too new to tell)/);
  await page.keyboard.press("Escape");

  // Settings › Show in the sidebar: untick Recently read, and it leaves the sidebar.
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  const group = page.getByRole("group", { name: "Show in the sidebar" });
  const box = group.getByRole("checkbox", { name: "Recently read" });
  await expect(box).toBeChecked();
  await expect(group.getByRole("checkbox", { name: "Starred" })).toBeChecked();
  try {
    await box.uncheck();
    await expect(link).toHaveCount(0);
    // Unread can't be hidden; Starred and All are still there.
    await expect(sidebar(page).getByRole("link", { name: "Unread", exact: true })).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: "All", exact: true })).toBeVisible();

    // It follows the reader: after a reload it's still hidden, and still opens by its address.
    await page.goto(new URL("/recent", FEEDS_APP).href);
    await appReady(page);
    await expect(page.getByRole("heading", { level: 2, name: "Recently read" })).toBeVisible();
    await expect(link).toHaveCount(0);
    await expect(rows.first()).toBeVisible();
  } finally {
    // Shown again, as every other test expects.
    await page.goto(new URL("/settings", FEEDS_APP).href);
    await appReady(page);
    await box.check();
    await expect(link).toBeVisible();
  }
});
