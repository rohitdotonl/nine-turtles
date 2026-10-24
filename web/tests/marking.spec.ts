import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, markAllFromMenu, signIn, tabTo } from "./screens";

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
    // A screen reader hears it, though the line above the list stays quiet.
    await expect(page.locator('[aria-live="polite"]', { hasText: "Marked as read" })).toBeAttached();
    const title = row(page, blog, NEWEST).locator("span:not([aria-hidden])").first();
    await expect(title).toHaveCSS("font-weight", "400");
    await expect(row(page, blog, MIDDLE).locator("span:not([aria-hidden])").first()).toHaveCSS("font-weight", "600");

    // Unread titles also carry a small dot; read ones don't.
    await expect(row(page, blog, NEWEST).locator(".unread-dot")).toHaveCount(0);
    await expect(row(page, blog, MIDDLE).locator(".unread-dot")).toBeVisible();
    // In one feed's own list, rows don't repeat the feed's name on screen.
    await expect(row(page, blog, MIDDLE).getByText(`Blog ${blog} ·`, { exact: true })).toHaveClass(/sr-only/);

    // m: unread again, and a note floating at the bottom of the list offers Undo; the list doesn't move.
    const before = (await row(page, blog, NEWEST).boundingBox())!.y;
    await page.keyboard.press("m");
    await expect(row(page, blog, NEWEST)).toHaveAccessibleName(/, unread/);
    await expect(feedLink(page, blog)).toHaveAccessibleName(`Blog ${blog} 3 unread`);
    await expect(line(page)).toHaveText("Marked as unread");
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
    expect((await row(page, blog, NEWEST).boundingBox())!.y).toBe(before);
    const undo = (await page.getByRole("button", { name: "Undo" }).boundingBox())!;
    expect(undo.y).toBeGreaterThan((await row(page, blog, NEWEST).boundingBox())!.y);

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

  test("with only the keyboard: the More menu's Mark all as read, and Undo, work too", async ({ page }) => {
    const blog = await openBlog(page);
    // More (…) beside the list's title says it opens a menu; Enter opens it on its first item.
    const more = page.getByRole("button", { name: "More", exact: true });
    await expect(more).toHaveAttribute("aria-haspopup", "menu");
    await tabTo(page, more);
    await page.keyboard.press("Enter");
    await expect(more).toHaveAttribute("aria-expanded", "true");
    const markAll = page.getByRole("menuitem", { name: "Mark all as read" });
    await expect(markAll).toBeFocused();
    await expect(markAll).toHaveAttribute("aria-keyshortcuts", "Shift+A");
    await page.keyboard.press("Enter");
    await expect(line(page)).toHaveText("Marked 3 items as read");
    // The menu closes, and the keyboard goes back to its button.
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(more).toBeFocused();

    const undo = page.getByRole("button", { name: "Undo" });
    await tabTo(page, undo);
    await page.keyboard.press("Enter");
    await expect(feedLink(page, blog)).toHaveAccessibleName(`Blog ${blog} 3 unread`);
    // The Undo button is gone; the keyboard's place stays nearby, on an article, not lost.
    await expect(page.locator(".item-row:focus")).toHaveCount(1);
  });

  test("the More menu: arrow keys move through it, Escape closes it and goes back to its button", async ({ page }) => {
    await openBlog(page);
    const more = page.getByRole("button", { name: "More", exact: true });
    await more.focus();
    await page.keyboard.press("ArrowDown");
    const menu = page.getByRole("menu", { name: "More" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Mark all as read" })).toBeFocused();
    // The sort order is a one-of-two choice, ticked where it is now.
    await expect(menu.getByRole("menuitemradio", { name: "Newest first" })).toHaveAttribute("aria-checked", "true");
    await expect(menu.getByRole("menuitemradio", { name: "Oldest first" })).toHaveAttribute("aria-checked", "false");
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitemradio", { name: "Newest first" })).toBeFocused();
    await page.keyboard.press("End");
    await expect(menu.getByRole("menuitemradio", { name: "Oldest first" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: "Mark all as read" })).toBeFocused();

    // Escape closes only the menu: the list stays, and the keyboard is back on More.
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(more).toBeFocused();
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".item-row")).toHaveCount(3);

    // A press outside closes it too.
    await more.click();
    await expect(menu).toBeVisible();
    await page.getByRole("heading", { level: 2 }).first().click();
    await expect(menu).toHaveCount(0);
  });

  test("on a phone, Undo is a full 44px tap that never reaches into the first article", async ({ page, isMobile }) => {
    test.skip(!isMobile, "The 44px floor is for touch screens.");
    await openBlog(page);
    await markAllFromMenu(page);
    const undo = page.getByRole("button", { name: "Undo" });
    await expect(undo).toBeVisible();
    const tap = (await undo.boundingBox())!;
    const first = (await page.locator(".item-row").first().boundingBox())!;
    expect(Math.min(tap.width, tap.height)).toBeGreaterThanOrEqual(44);
    expect(tap.y + tap.height).toBeLessThanOrEqual(first.y);
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
    await expect(row(page, blog, MIDDLE)).toHaveAccessibleName(/, Starred/);
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
    // The star changes at once; reload only once the server has it saved.
    const saved = page.waitForResponse((response) => response.url().endsWith("/api/articles/starred") && response.ok());
    await star.click();
    await expect(star).toHaveAttribute("aria-pressed", "false");
    await expect(row(page, blog, MIDDLE)).not.toHaveAccessibleName(/, Starred/);
    await saved;
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
    await expect(row(page, blog, NEWEST)).not.toHaveAccessibleName(/, Starred/);
    await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);
  });
});

test.describe("when saving fails", () => {
  test.skip(({ isMobile }) => isMobile, "the same on every width");

  test("an article that couldn't be marked read stays unread, and a later m isn't taken back", async ({ page }) => {
    const blog = await openBlog(page);
    let failing = true;
    await page.route("**/api/articles/read", (route) => (failing ? route.fulfill({ status: 500 }) : route.fallback()));
    await page.keyboard.press("j");
    await expect(line(page)).toHaveText("An article couldn't be marked as read. It's still unread.");
    await expect(row(page, blog, NEWEST)).toHaveAccessibleName(/, unread/);
    await expect(feedLink(page, blog)).toHaveAccessibleName(`Blog ${blog} 3 unread`);

    // Shown again with saving back: read. Then m, and that save fails: back to read, as the server has it.
    let saved = 0;
    page.on("response", (response) => {
      if (response.url().endsWith("/api/articles/read") && response.ok()) saved++;
    });
    failing = false;
    await page.keyboard.press("j");
    await page.keyboard.press("k");
    await expect(row(page, blog, NEWEST)).not.toHaveAccessibleName(/, unread/);
    await expect(feedLink(page, blog)).toHaveAccessibleName(`Blog ${blog} 1 unread`);
    // Both saves (j and k) must reach the server before saving fails again.
    await expect.poll(() => saved).toBe(2);
    failing = true;
    await page.keyboard.press("m");
    await expect(line(page)).toHaveText("That couldn't be saved, so it was taken back.");
    await expect(row(page, blog, NEWEST)).not.toHaveAccessibleName(/, unread/);
    await expect(feedLink(page, blog)).toHaveAccessibleName(`Blog ${blog} 1 unread`);
  });
});

test("on a phone, the article's Star and Mark unread buttons work", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the phone layout only");
  const blog = await openBlog(page, 412);
  await row(page, blog, NEWEST).click();
  await article(page).getByRole("button", { name: "Star" }).click();
  await article(page).getByRole("button", { name: "Mark unread" }).click();
  await article(page).getByRole("button", { name: `Back to Blog ${blog}` }).click();
  await expect(row(page, blog, NEWEST)).toHaveAccessibleName(/, unread/);
  await expect(row(page, blog, NEWEST)).toHaveAccessibleName(/, Starred/);
});

test("Settings: the sort order is saved for every device", async ({ page, isMobile }) => {
  test.skip(isMobile, "one browser at a time changes this shared setting");
  // The slowfeed with no feeds, so changing its sort order affects no other test's list.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/settings");
  await appReady(page);
  await signIn(page);
  const reading = page.getByRole("region", { name: "Reading" });
  const newest = reading.getByRole("radio", { name: "Newest first" });
  await expect(newest).toBeChecked();
  // With only the keyboard: Tab to the choice, an arrow key changes it.
  await tabTo(page, newest);
  await page.keyboard.press("ArrowDown");
  await expect(reading.getByRole("radio", { name: "Oldest first" })).toBeChecked();
  await expect(reading.getByRole("radio", { name: "Oldest first" })).toBeFocused();
  await page.reload();
  await appReady(page);
  await expect(reading.getByRole("radio", { name: "Oldest first" })).toBeChecked();
  await reading.getByRole("radio", { name: "Newest first" }).check();
  await expect(reading.getByRole("radio", { name: "Newest first" })).toBeChecked();

  // The list's More menu sets the same sort order (Starred has a list even with no feeds).
  await page.goto("/starred");
  await appReady(page);
  const more = page.getByRole("button", { name: "More", exact: true });
  await more.click();
  await expect(page.getByRole("menuitemradio", { name: "Newest first" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("menuitemradio", { name: "Oldest first" }).click();
  await more.click();
  await expect(page.getByRole("menuitemradio", { name: "Oldest first" })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  await page.goto("/settings");
  await appReady(page);
  await expect(reading.getByRole("radio", { name: "Oldest first" })).toBeChecked();
  await reading.getByRole("radio", { name: "Newest first" }).check();
  await expect(reading.getByRole("radio", { name: "Newest first" })).toBeChecked();
});
