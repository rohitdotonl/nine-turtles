import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, openReadingRoom, signIn } from "./screens";

// The shortcuts of decision 0103 (SPEC sections 8 and 19), done by a
// browser: Space through an article, n to the next unread one, Shift+O
// with Undo, and c to copy the link. Each blog here is a made-up one of
// the test's own (tests/feed-server.mjs), so tests never mark each other's.

const article = (page: Page) => page.getByRole("region", { name: "Article" });
const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });
const scroller = (page: Page) => article(page).locator(".reading-scroller");
const scrolled = (page: Page) => scroller(page).evaluate((element) => element.scrollTop);

/** Signs in on a wide window that's short, so an article is several screens long. */
async function signedIn(page: Page, height = 800) {
  await page.setViewportSize({ width: 1280, height });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
}

/**
 * Follows a new blog of this test's own and opens its list: three articles,
 * or, `many`, 55 (all dated in the past, so they never crowd the top of All
 * for the other tests).
 */
async function openBlog(page: Page, many = false): Promise<string> {
  const name = `${many ? "many" : "keys"}-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const id = await follow(page, `${FEED_SITE}/blog/${name}/`);
  await page.goto(new URL(`/feeds/${id}`, FEEDS_APP).href);
  await appReady(page);
  await expect(page.getByRole("button", { name: new RegExp(`Blog ${name}`) }).first()).toBeVisible();
  return name;
}

function row(page: Page, number: number) {
  return page.getByRole("button", { name: new RegExp(`\\(${number}\\)`) });
}

test.describe("on a wide window", () => {
  test.skip(({ isMobile }) => isMobile, "Space, n, Shift+O and c are for a keyboard");

  test("Space scrolls the open article a screen at a time and stops at its end; Shift+Space goes back; a button keeps its Space", async ({ page }) => {
    await signedIn(page, 420);
    await openReadingRoom(page);
    await page.getByRole("button", { name: /The pleasure of a slow letter/ }).click();
    await page.keyboard.press("Enter");
    const heading = article(page).getByRole("heading", { level: 2, name: "The pleasure of a slow letter" });
    await expect(heading).toBeFocused();
    // Larger text, so the article is surely several screens long.
    for (let step = 0; step < 3; step++) await page.keyboard.press("+");
    await expect(article(page).getByRole("heading", { name: "A small table of habits" })).toBeAttached();
    const screen = await scroller(page).evaluate((element) => element.clientHeight);

    await page.keyboard.press(" ");
    await expect.poll(() => scrolled(page)).toBeGreaterThan(screen / 2);
    const once = await scrolled(page);
    // Not more than a screen: a few lines of the last one stay in view.
    expect(once).toBeLessThanOrEqual(screen);

    // At the end it stops: the same article stays open, never the next.
    for (let press = 0; press < 20; press++) await page.keyboard.press(" ");
    const end = await scroller(page).evaluate((element) => element.scrollHeight - element.clientHeight);
    await expect.poll(() => scrolled(page)).toBeGreaterThanOrEqual(end - 1);
    await expect(article(page).locator(".article-title")).toHaveText("The pleasure of a slow letter");

    await page.keyboard.press("Shift+Space");
    await expect.poll(() => scrolled(page)).toBeLessThan(end - screen / 2);

    // With the keyboard on the article's row in the list, Space still reads on.
    const before = await scrolled(page);
    await page.getByRole("button", { name: /The pleasure of a slow letter/ }).focus();
    await page.keyboard.press("Shift+Space");
    await expect.poll(() => scrolled(page)).toBeLessThan(before);

    // A button takes Space as its own press: Aa opens its panel, and the article stays put.
    const still = await scrolled(page);
    const aa = article(page).getByRole("button", { name: "Reading appearance" });
    await aa.focus();
    await page.keyboard.press(" ");
    await expect(aa).toHaveAttribute("aria-expanded", "true");
    expect(await scrolled(page)).toBe(still);
  });

  test("c copies the open article's link and says so, as Copy link does; the menu shows its key", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: FEEDS_APP });
    await signedIn(page);
    await openReadingRoom(page);
    await page.keyboard.press("j");
    await page.keyboard.press("c");
    await expect(article(page).getByRole("status")).toHaveText("Link copied.");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("https://reading-room.example/slow-letter");
    await article(page).getByRole("button", { name: "More actions" }).click();
    await expect(page.getByRole("menuitem", { name: "Copy link" })).toHaveAttribute("aria-keyshortcuts", "c");
    await page.keyboard.press("Escape");
  });

  test("n moves to the next unread article, passing read ones; Shift+N to the previous unread one", async ({ page }) => {
    await signedIn(page);
    await openBlog(page);
    // j shows the newest and then the middle one: both read now.
    await page.keyboard.press("j");
    await page.keyboard.press("j");
    await page.keyboard.press("k");
    await expect(row(page, 3)).toHaveAttribute("aria-current", "true");
    await expect(row(page, 2)).not.toHaveAccessibleName(/, unread/);

    await page.keyboard.press("n");
    await expect(row(page, 1)).toHaveAttribute("aria-current", "true");
    await expect(article(page).locator(".article-title")).toHaveText(/\(1\)/);
    // Nothing unread above any more: Shift+N stays where it is.
    await page.keyboard.press("Shift+N");
    await expect(row(page, 1)).toHaveAttribute("aria-current", "true");
  });

  test("Shift+O marks everything older as read, the rows not loaded yet too, and u undoes it; More offers above and below", async ({ page }) => {
    await signedIn(page);
    // 55 articles: the list loads 50, so the five oldest aren't listed yet.
    const blog = await openBlog(page, true);
    const count = sidebar(page).getByRole("link", { name: new RegExp(`^Blog ${blog}`) });
    await expect(count).toHaveAccessibleName(`Blog ${blog} 55 unread`);
    const rows = page.locator("#list-pane li button[data-space-reads]");
    await expect(rows).toHaveCount(50);

    // The tenth row, chosen with a click: read. Shift+O marks the 45 below it, listed or not.
    await rows.nth(9).click();
    await expect(rows.nth(9)).toHaveAttribute("aria-current", "true");
    await expect(count).toHaveAccessibleName(`Blog ${blog} 54 unread`);
    await page.keyboard.press("Shift+O");
    await expect(page.getByRole("status").filter({ hasText: "Marked 45 items as read" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
    await expect(count).toHaveAccessibleName(`Blog ${blog} 9 unread`);
    // Nothing moved: the rows below turned grey where they are; those above stay unread.
    await expect(rows).toHaveCount(50);
    await expect(rows.nth(10)).not.toHaveAccessibleName(/, unread/);
    await expect(rows.nth(49)).not.toHaveAccessibleName(/, unread/);
    await expect(rows.nth(8)).toHaveAccessibleName(/, unread/);

    await page.keyboard.press("u");
    await expect(page.getByRole("status").filter({ hasText: "Undone." })).toBeVisible();
    await expect(count).toHaveAccessibleName(`Blog ${blog} 54 unread`);
    await expect(rows.nth(10)).toHaveAccessibleName(/, unread/);

    // The list's More menu: above and below the chosen article, Shift+O beside the older side.
    await page.getByRole("button", { name: "More", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Mark all below as read" })).toHaveAttribute("aria-keyshortcuts", "Shift+O");
    await expect(page.getByRole("menuitem", { name: "Mark all above as read" })).not.toHaveAttribute("aria-keyshortcuts");
    await page.getByRole("menuitem", { name: "Mark all above as read" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Marked 9 items as read" })).toBeVisible();
    await expect(count).toHaveAccessibleName(`Blog ${blog} 45 unread`);
    await expect(rows.nth(0)).not.toHaveAccessibleName(/, unread/);
    await expect(rows.nth(10)).toHaveAccessibleName(/, unread/);
  });
  test("Shift+O in search results marks the older results as read, those not loaded yet too", async ({ page }) => {
    await signedIn(page);
    const blog = await openBlog(page, true);
    const count = sidebar(page).getByRole("link", { name: new RegExp(`^Blog ${blog}`) });
    await expect(count).toHaveAccessibleName(`Blog ${blog} 55 unread`);
    // A search in this blog only: all 55 match, and 50 are listed at first.
    await page.locator("#list-heading").focus();
    await page.keyboard.press("/");
    await expect(page.getByRole("button", { name: `Remove in: Blog ${blog}` })).toBeVisible();
    await page.keyboard.type("summary");
    const results = page.getByRole("region", { name: "Search results" }).locator("li button[data-space-reads]");
    await expect(results).toHaveCount(50);

    // Older goes by date: articles numbered below the chosen one, one of them perhaps not listed yet.
    await results.nth(9).click();
    await expect(results.nth(9)).toHaveAttribute("aria-current", "true");
    const chosen = Number((await results.nth(9).innerText()).match(/\((\d+)\)/)![1]);
    await expect(count).toHaveAccessibleName(`Blog ${blog} 54 unread`);
    await page.keyboard.press("Shift+O");
    await expect(page.getByRole("status").filter({ hasText: `Marked ${chosen - 1} ${chosen === 2 ? "item" : "items"} as read` })).toBeVisible();
    await expect(count).toHaveAccessibleName(`Blog ${blog} ${55 - chosen} unread`);
    await page.keyboard.press("u");
    await expect(page.getByRole("status").filter({ hasText: "Undone." })).toBeVisible();
    await expect(count).toHaveAccessibleName(`Blog ${blog} 54 unread`);
  });

  test("without a connection, Shift+O says marking articles not yet listed needs one, and marks nothing", async ({ page, context }) => {
    await signedIn(page);
    const blog = await openBlog(page, true);
    const count = sidebar(page).getByRole("link", { name: new RegExp(`^Blog ${blog}`) });
    const rows = page.locator("#list-pane li button[data-space-reads]");
    await expect(rows).toHaveCount(50);
    await rows.nth(9).click();
    await expect(count).toHaveAccessibleName(`Blog ${blog} 54 unread`);

    await context.setOffline(true);
    await page.keyboard.press("Shift+O");
    await expect(page.getByText("Marking articles not yet listed needs a connection. Try again once you're back online.")).toBeVisible();
    await expect(rows.nth(10)).toHaveAccessibleName(/, unread/);
    await expect(rows.nth(49)).toHaveAccessibleName(/, unread/);
    await expect(count).toHaveAccessibleName(`Blog ${blog} 54 unread`);
    await context.setOffline(false);
    await page.evaluate(() => dispatchEvent(new Event("online")));
    // On the server too, only the chosen one is read.
    const unread = async () => (await (await page.request.get(new URL("/api/feeds", FEEDS_APP).href)).json()).feeds.find((each: { title: string }) => each.title === `Blog ${blog}`).unread;
    await expect.poll(unread).toBe(54);
  });

  test("e folds and unfolds the folder you're in, or your feed's; Shift+E edits the feed or folder", async ({ page }) => {
    await signedIn(page);
    const blog = await openBlog(page);
    const folder = `Keys-${test.info().workerIndex}-${Date.now()}`;
    const library = await (await page.request.get(new URL("/api/feeds", FEEDS_APP).href)).json();
    const feed = library.feeds.find((each: { title: string }) => each.title === `Blog ${blog}`).id;
    await page.request.post(new URL(`/api/feeds/${feed}`, FEEDS_APP).href, { data: { title: `Blog ${blog}`, folders: [], new_folder: folder } });
    await page.reload();
    await appReady(page);
    const toggle = sidebar(page).getByRole("button", { name: `Feeds in ${folder}` });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    // In the feed: e unfolds its folder, and folds it again.
    await page.locator("#list-heading").focus();
    await page.keyboard.press("e");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("e");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    // Shift+E edits the feed; Escape goes back.
    await page.keyboard.press("Shift+E");
    await expect(page.getByRole("heading", { level: 2, name: "Edit feed" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { level: 2, name: `Blog ${blog}` })).toBeVisible();

    // In the folder: e folds and unfolds it; Shift+E edits it.
    await sidebar(page).getByRole("link", { name: new RegExp(`^${folder}`) }).click();
    await expect(page.getByRole("heading", { level: 2, name: folder })).toBeFocused();
    await page.keyboard.press("e");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("e");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("Shift+E");
    await expect(page.getByRole("heading", { level: 2, name: "Edit folder" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { level: 2, name: folder })).toBeVisible();
  });
});
