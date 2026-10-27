import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn, tabTo } from "./screens";

// SPEC section 34 (decision 0108), "How to check it", done by a browser with
// the keyboard only: an article goes on a new collection with l, another
// through the article's More menu; the collection opens from the sidebar with
// both, newest first; then it's deleted from its own More menu, its articles
// stay, and Undo brings it back. On a wide window only: collections are the
// reader's, shared by every test signed in as them.

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });
const line = (page: Page) => page.getByRole("status").filter({ hasText: /\S/ }).first();
const article = (page: Page) => page.getByRole("region", { name: "Article" });
const NEWEST = "On keeping a commonplace book (3)";
const MIDDLE = "Walking the long way home (2)";

test("articles go on a collection by l and by the menu; it opens, and deleting it can be undone", async ({ page, isMobile }) => {
  test.skip(isMobile, "collections are the reader's own, so one window checks them");
  const blog = `shelf-${test.info().workerIndex}-${Date.now()}`;
  const name = `Zz shelf ${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${blog}/`);
  await page.goto(new URL(`/feeds/${id}`, FEEDS_APP).href);
  await appReady(page);
  await expect(page.getByRole("button", { name: new RegExp(`Blog ${blog}`) }).first()).toBeVisible();

  // j opens the newest; l opens the sheet for it.
  await page.keyboard.press("j");
  await expect(article(page).getByRole("heading", { name: NEWEST })).toBeVisible();
  await page.keyboard.press("l");
  const sheet = page.getByRole("dialog", { name: "Add to collection" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("heading", { name: "Add to collection" })).toBeFocused();
  // A new collection, named in the list's last row; Enter saves.
  const newRow = sheet.getByRole("textbox", { name: "New collection" });
  await tabTo(page, newRow);
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await expect(sheet).toHaveCount(0);
  const link = sidebar(page).getByRole("link", { name: new RegExp(`^${name}`) });
  await expect(link).toBeVisible();

  // The next article, through the article's More menu, with the keyboard.
  await page.keyboard.press("j");
  await expect(article(page).getByRole("heading", { name: MIDDLE })).toBeVisible();
  const more = article(page).getByRole("button", { name: "More actions" });
  await tabTo(page, more);
  await page.keyboard.press("Enter");
  const item = page.getByRole("menuitem", { name: /Add to collection/ });
  await expect(item).toBeVisible();
  while (!(await item.evaluate((element) => element === document.activeElement))) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(sheet).toBeVisible();
  const box = sheet.getByRole("checkbox", { name });
  await expect(box).toBeEnabled();
  await expect(box).not.toBeChecked();
  await tabTo(page, box);
  await page.keyboard.press("Space");
  await expect(box).toBeChecked();
  await tabTo(page, sheet.getByRole("button", { name: "Save" }));
  await page.keyboard.press("Enter");
  await expect(sheet).toHaveCount(0);
  // The keyboard is back on More, where the sheet was opened from.
  await expect(more).toBeFocused();

  // The collection opens from the sidebar: both articles, newest first.
  await tabTo(page, link);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/collections\/\d+$/);
  await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  await expect(link).toHaveAttribute("aria-current", "page");
  const rows = page.getByRole("button", { name: new RegExp(`Blog ${blog}`) });
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveAccessibleName(new RegExp(NEWEST.replace(/[()]/g, "\\$&")));
  await expect(rows.nth(1)).toHaveAccessibleName(new RegExp(MIDDLE.replace(/[()]/g, "\\$&")));

  // Delete, from its own More menu: only the collection goes, and Undo brings it back.
  const listMore = page.getByRole("button", { name: "More", exact: true });
  await tabTo(page, listMore);
  await page.keyboard.press("Enter");
  const remove = page.getByRole("menuitem", { name: "Delete" });
  while (!(await remove.evaluate((element) => element === document.activeElement))) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/unread$/);
  await expect(line(page)).toHaveText(`Deleted the collection ${name}`);
  await expect(link).toHaveCount(0);
  await page.keyboard.press("u");
  await expect(line(page)).toHaveText("Undone.");
  await expect(link).toBeVisible();
  await link.click();
  await expect(rows).toHaveCount(2);

  // Its articles are still in their feed.
  await page.goto(new URL(`/feeds/${id}`, FEEDS_APP).href);
  await appReady(page);
  await expect(rows).toHaveCount(3);
});
