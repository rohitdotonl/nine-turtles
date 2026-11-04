import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, openReadingRoom, signIn } from "./screens";

// The shortcuts of decision 0103 (SPEC sections 8 and 19), done by a
// browser: Space through an article, n to the next unread one, and c to
// copy the link. Each blog here is a made-up one of
// the test's own (tests/feed-server.mjs), so tests never mark each other's.

const article = (page: Page) => page.getByRole("region", { name: "Article", exact: true });
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
  await page.goto(new URL(`/people/${id}`, FEEDS_APP).href);
  await appReady(page);
  await expect(page.getByRole("listitem").getByRole("button", { name: new RegExp(`Blog ${name}`) }).first()).toBeVisible();
  return name;
}

test.describe("on a wide window", () => {
  test.skip(({ isMobile }) => isMobile, "Space and c are for a keyboard");

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

  test("Shift+O does nothing, and More marks only all as read (decision 0171)", async ({ page }) => {
    await signedIn(page);
    const blog = await openBlog(page, true);
    const count = sidebar(page).getByRole("link", { name: new RegExp(`^Blog ${blog}`) });
    const rows = page.locator("#list-pane li button[data-space-reads]");
    await expect(rows).toHaveCount(50);
    await rows.nth(9).click();
    await expect(count).toHaveAttribute("data-unread", `54`);
    await page.keyboard.press("Shift+O");
    await expect(rows.nth(10)).toHaveAccessibleName(/, unread/);
    await expect(count).toHaveAttribute("data-unread", `54`);

    await page.getByRole("button", { name: "More", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Mark all as read" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /above as read|below as read|Catch me up/ })).toHaveCount(0);
  });


  test("e expands and folds the folder you're in, or your feed's", async ({ page }) => {
    await signedIn(page);
    const blog = await openBlog(page);
    const folder = `Keys-${test.info().workerIndex}-${Date.now()}`;
    const library = await (await page.request.get(new URL("/api/feeds", FEEDS_APP).href)).json();
    const feed = library.feeds.find((each: { title: string }) => each.title === `Blog ${blog}`).id;
    await page.request.post(new URL(`/api/feeds/${feed}`, FEEDS_APP).href, { data: { title: `Blog ${blog}`, folders: [], new_folder: folder } });
    await page.reload();
    await appReady(page);
    const toggle = sidebar(page).getByRole("button", { name: `What's in ${folder}` });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    // In the feed: e expands its folder, and folds it again.
    await page.locator("#list-heading").focus();
    await page.keyboard.press("e");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("e");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    // In the folder: the same. Choosing a closed folder opens it (decision 0123).
    await sidebar(page).getByRole("link", { name: new RegExp(`^${folder}`) }).click();
    await expect(page.getByRole("heading", { level: 2, name: folder })).toBeFocused();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("e");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("e");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    // Shift+J from an expanded folder goes to the first person in it; from a collapsed one, past them.
    const inFolder = new RegExp(`/(people|publications)/${feed}$`);
    await page.keyboard.press("Shift+J");
    await expect(page).toHaveURL(inFolder);
    await page.keyboard.press("Shift+K");
    await expect(page.getByRole("heading", { level: 2, name: folder })).toBeFocused();
    await page.keyboard.press("e");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("Shift+J");
    await expect(page.getByRole("heading", { level: 2, name: folder })).toHaveCount(0);
    await expect(page).not.toHaveURL(inFolder);
  });
});
