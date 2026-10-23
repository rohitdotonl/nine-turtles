import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn, tabTo } from "./screens";

// SPEC sections 8, 9, 18 (sort order) and 25 (a failed save), "How to check
// it", done by a browser. Each test follows a made-up blog of its own
// (three articles), so tests never mark each other's articles.

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });
const article = (page: Page) => page.getByRole("region", { name: "Article" });
const line = (page: Page) => page.getByRole("status").filter({ hasNotText: /^$/ }).first();
const NEWEST = "On keeping a commonplace book (3)";
const MIDDLE = "Walking the long way home (2)";
const OLDEST = "A year of reading slowly (1)";

/** Signs in, follows a new blog and opens its list. Returns the blog's name. */
async function openBlog(page: Page, width = 1280): Promise<string> {
  const name = `marks-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/`);
  await page.goto(new URL(`/feeds/${id}`, FEEDS_APP).href);
  await appReady(page);
  await expect(row(page, name, NEWEST)).toBeVisible();
  return name;
}

/** One of the blog's rows, wherever it's listed. */
function row(page: Page, blog: string, title: string) {
  return page.getByRole("button", { name: new RegExp(`${escape(title)}.*Blog ${blog}`) });
}

/** The blog's link in the sidebar, which carries its unread count. */
function feedLink(page: Page, blog: string) {
  return sidebar(page).getByRole("link", { name: new RegExp(`^Blog ${blog}`) });
}

function escape(text: string): string {
  return text.replace(/[()]/g, "\\$&");
}

test.describe("on a wide window", () => {
  test.skip(({ isMobile }) => isMobile, "the phone layout has its own test below");

  test("showing an article marks it read; m marks it unread again, and u undoes that", async ({ page }) => {
    const blog = await openBlog(page);
    await expect(feedLink(page, blog)).toHaveAccessibleName(`Blog ${blog} 3 unread`);
    await expect(row(page, blog, NEWEST)).toHaveAccessibleName(/, unread/);

    // Shown in the reading area: read, greyed, and the count drops by one.
    await page.keyboard.press("j");
    await expect(row(page, blog, NEWEST)).not.toHaveAccessibleName(/, unread/);
    await expect(feedLink(page, blog)).toHaveAccessibleName(`Blog ${blog} 2 unread`);
    const title = row(page, blog, NEWEST).locator("span").first();
    await expect(title).toHaveCSS("font-weight", "400");
    await expect(row(page, blog, MIDDLE).locator("span").first()).toHaveCSS("font-weight", "600");

    // m: unread again, and the line above the list offers Undo.
    await page.keyboard.press("m");
    await expect(row(page, blog, NEWEST)).toHaveAccessibleName(/, unread/);
    await expect(feedLink(page, blog)).toHaveAccessibleName(`Blog ${blog} 3 unread`);
    await expect(line(page)).toHaveText("Marked as unread");
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();

    // u: read again. Undo works once.
    await page.keyboard.press("u");
    await expect(row(page, blog, NEWEST)).not.toHaveAccessibleName(/, unread/);
    await expect(feedLink(page, blog)).toHaveAccessibleName(`Blog ${blog} 2 unread`);
    await expect(line(page)).toHaveText("Undone.");
    await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);

    // The Mark unread button in the article's top bar does the same as m.
    await article(page).getByRole("button", { name: "Mark unread" }).click();
    await expect(row(page, blog, NEWEST)).toHaveAccessibleName(/, unread/);

    // It's saved: a reload shows the same.
    await page.reload();
    await appReady(page);
    await expect(row(page, blog, NEWEST)).toHaveAccessibleName(/, unread/);
    await expect(feedLink(page, blog)).toHaveAccessibleName(`Blog ${blog} 3 unread`);
  });

  test("Shift+A marks everything shown as read at once, and u brings it back", async ({ page }) => {
    const blog = await openBlog(page);
    await page.keyboard.press("Shift+A");
    for (const title of [NEWEST, MIDDLE, OLDEST]) {
      await expect(row(page, blog, title)).not.toHaveAccessibleName(/, unread/);
    }
    await expect(line(page)).toHaveText("Marked 3 items as read");
    // No unread articles: no number at all.
    await expect(feedLink(page, blog)).toHaveAccessibleName(`Blog ${blog}`);

    await page.keyboard.press("u");
    for (const title of [NEWEST, MIDDLE, OLDEST]) {
      await expect(row(page, blog, title)).toHaveAccessibleName(/, unread/);
    }
    await expect(feedLink(page, blog)).toHaveAccessibleName(`Blog ${blog} 3 unread`);
  });

  test("with only the keyboard: Mark all as read and Undo are buttons too", async ({ page }) => {
    const blog = await openBlog(page);
    const markAll = page.getByRole("button", { name: "Mark all as read" });
    await tabTo(page, markAll);
    await page.keyboard.press("Enter");
    await expect(line(page)).toHaveText("Marked 3 items as read");

    const undo = page.getByRole("button", { name: "Undo" });
    await tabTo(page, undo);
    await page.keyboard.press("Enter");
    await expect(feedLink(page, blog)).toHaveAccessibleName(`Blog ${blog} 3 unread`);
    // The Undo button is gone; the keyboard's place stays nearby, not lost.
    await expect(markAll).toBeFocused();
  });

  test("in the Unread view, a read article stays (greyed) until you leave", async ({ page }) => {
    const blog = await openBlog(page);
    await page.keyboard.press("g");
    await page.keyboard.press("u");
    await expect(page).toHaveURL(/\/unread$/);
    await row(page, blog, MIDDLE).click();
    await expect(row(page, blog, MIDDLE)).not.toHaveAccessibleName(/, unread/);
    await expect(row(page, blog, MIDDLE)).toBeVisible();

    await page.keyboard.press("g");
    await page.keyboard.press("a");
    await expect(row(page, blog, MIDDLE)).toBeVisible();
    await page.keyboard.press("g");
    await page.keyboard.press("u");
    await expect(row(page, blog, NEWEST)).toBeVisible();
    await expect(row(page, blog, MIDDLE)).toHaveCount(0);
  });

  test("s stars an article: a star mark, and it's under Starred until unstarred", async ({ page }) => {
    const blog = await openBlog(page);
    await page.keyboard.press("j");
    await page.keyboard.press("j");
    await page.keyboard.press("s");
    await expect(row(page, blog, MIDDLE)).toHaveAccessibleName(/Starred, /);
    await expect(row(page, blog, MIDDLE).locator("svg")).toBeVisible();
    await expect(article(page).getByRole("button", { name: "Star" })).toHaveAttribute("aria-pressed", "true");
    await expect(line(page)).toHaveText("Starred");

    await page.keyboard.press("g");
    await page.keyboard.press("s");
    await expect(page).toHaveURL(/\/starred$/);
    await expect(row(page, blog, MIDDLE)).toBeVisible();
    await expect(row(page, blog, NEWEST)).toHaveCount(0);

    // Unstar it with the Star button: it leaves Starred.
    await row(page, blog, MIDDLE).click();
    const star = article(page).getByRole("button", { name: "Star" });
    await star.click();
    await expect(star).toHaveAttribute("aria-pressed", "false");
    await expect(row(page, blog, MIDDLE)).not.toHaveAccessibleName(/Starred, /);
    await page.reload();
    await appReady(page);
    await expect(page.getByRole("heading", { level: 2, name: "Starred" })).toBeVisible();
    await expect(row(page, blog, MIDDLE)).toHaveCount(0);
  });

  test("if a star can't be saved, it's taken back and the line says so", async ({ page }) => {
    const blog = await openBlog(page);
    await page.route("**/api/articles/starred", (route) => route.fulfill({ status: 500 }));
    await page.keyboard.press("j");
    await page.keyboard.press("s");
    await expect(line(page)).toHaveText("The star couldn't be saved.");
    await expect(row(page, blog, NEWEST)).not.toHaveAccessibleName(/Starred, /);
    await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);
  });
});

test("on a phone, the article's Star and Mark unread buttons work", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the phone layout only");
  const blog = await openBlog(page, 412);
  await row(page, blog, NEWEST).click();
  await article(page).getByRole("button", { name: "Star" }).click();
  await article(page).getByRole("button", { name: "Mark unread" }).click();
  await article(page).getByRole("button", { name: `‹ Blog ${blog}` }).click();
  await expect(row(page, blog, NEWEST)).toHaveAccessibleName(/, unread/);
  await expect(row(page, blog, NEWEST)).toHaveAccessibleName(/Starred, /);
});

test("Settings: the sort order is saved for every device", async ({ page, isMobile }) => {
  test.skip(isMobile, "one browser at a time changes this shared setting");
  // The slowfeed with no feeds, so changing its sort order affects no other test's list.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/settings");
  await appReady(page);
  await signIn(page);
  const reading = page.getByRole("region", { name: "Reading" });
  await expect(reading.getByRole("radio", { name: "Newest first" })).toBeChecked();
  await reading.getByRole("radio", { name: "Oldest first" }).check();
  await page.reload();
  await appReady(page);
  await expect(reading.getByRole("radio", { name: "Oldest first" })).toBeChecked();
  await reading.getByRole("radio", { name: "Newest first" }).check();
  await expect(reading.getByRole("radio", { name: "Newest first" })).toBeChecked();
});
