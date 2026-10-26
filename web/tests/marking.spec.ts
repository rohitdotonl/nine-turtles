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
    const dot = row(page, blog, MIDDLE).locator(".unread-dot");
    await expect(dot).toBeVisible();
    // A drawn 8px dot in the theme's accent, in the gutter left of the title.
    await expect(dot).toHaveCSS("width", "8px");
    const [dotColor, accent] = await dot.evaluate((element) => {
      const probe = document.createElement("div");
      probe.style.backgroundColor = "var(--accent)";
      document.body.append(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return [getComputedStyle(element).backgroundColor, color];
    });
    expect(dotColor).toBe(accent);
    const [dotBox, titleBox] = [(await dot.boundingBox())!, (await row(page, blog, MIDDLE).locator(".title").boundingBox())!];
    // Its own gutter, not a bullet: 8px clear of the title, and the title
    // starts where a read row's does (decision 0041).
    expect(titleBox.x - (dotBox.x + dotBox.width)).toBeGreaterThanOrEqual(7.5);
    expect(Math.abs((await row(page, blog, NEWEST).locator(".title").boundingBox())!.x - titleBox.x)).toBeLessThan(1);
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

    // Mark unread in the article's More menu does the same as m.
    await article(page).getByRole("button", { name: "More actions" }).click();
    const savedUnread = page.waitForResponse((response) => response.url().endsWith("/api/articles/read") && response.ok());
    await page.getByRole("menuitem", { name: "Mark unread" }).click();
    await expect(row(page, blog, NEWEST)).toHaveAccessibleName(/, unread/);

    // It's saved: once the server has it, a reload shows the same.
    await savedUnread;
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
    // Then Refresh (its key shown beside it), the sort order, and Edit feed last (decision 0038).
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: "Refresh" })).toBeFocused();
    await expect(menu.getByRole("menuitem", { name: "Refresh" })).toHaveAttribute("aria-keyshortcuts", "r");
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitemradio", { name: "Newest first" })).toBeFocused();
    await page.keyboard.press("End");
    await expect(menu.getByRole("menuitem", { name: "Edit feed" })).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(menu.getByRole("menuitemradio", { name: "Oldest first" })).toBeFocused();
    await page.keyboard.press("End");
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
    // Opening the article can take a moment on a busy computer; the failed save comes after it.
    const refused = page.waitForResponse((response) => response.url().endsWith("/api/articles/read"));
    await page.keyboard.press("j");
    await refused;
    await expect(line(page)).toHaveText("An article couldn't be marked as read. It's still unread.");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(row(page, blog, NEWEST)).toHaveAccessibleName(/, unread/);
    await expect(feedLink(page, blog)).toHaveAccessibleName(`Blog ${blog} 3 unread`);

    // Shown again with saving back: read, and the message has gone, its job done. Then m, and that save fails: back to read, as the server has it.
    let saved = 0;
    page.on("response", (response) => {
      if (response.url().endsWith("/api/articles/read") && response.ok()) saved++;
    });
    failing = false;
    await page.keyboard.press("j");
    await page.keyboard.press("k");
    await expect(row(page, blog, NEWEST)).not.toHaveAccessibleName(/, unread/);
    await expect(feedLink(page, blog)).toHaveAccessibleName(`Blog ${blog} 1 unread`);
    await expect(page.getByText("An article couldn't be marked as read. It's still unread.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
    // Both saves (j and k) must reach the server before saving fails again.
    await expect.poll(() => saved).toBe(2);
    failing = true;
    await page.keyboard.press("m");
    await expect(line(page)).toHaveText("That couldn't be saved, so it was taken back.");
    await expect(row(page, blog, NEWEST)).not.toHaveAccessibleName(/, unread/);
    await expect(feedLink(page, blog)).toHaveAccessibleName(`Blog ${blog} 1 unread`);

    // Try again, with saving back: unread after all, and the line is quiet.
    failing = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(row(page, blog, NEWEST)).toHaveAccessibleName(/, unread/);
    await expect(feedLink(page, blog)).toHaveAccessibleName(`Blog ${blog} 2 unread`);
    await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
    await expect(page.getByText("That couldn't be saved, so it was taken back.")).toHaveCount(0);
  });

  test("with only the keyboard: Try again saves a star that couldn't be saved", async ({ page }) => {
    const blog = await openBlog(page);
    let failing = true;
    await page.route("**/api/articles/starred", (route) => (failing ? route.fulfill({ status: 500 }) : route.fallback()));
    await page.keyboard.press("j");
    await page.keyboard.press("s");
    await expect(line(page)).toHaveText("The star couldn't be saved.");
    failing = false;
    const again = page.getByRole("button", { name: "Try again" });
    await tabTo(page, again);
    await page.keyboard.press("Enter");
    await expect(row(page, blog, NEWEST)).toHaveAccessibleName(/, Starred/);
    await expect(again).toHaveCount(0);
    // The button is gone; the keyboard's place stays nearby, on an article, not lost.
    await expect(page.locator(".item-row:focus")).toHaveCount(1);
  });

  test("a failure that arrives after a newer action keeps that action's Undo", async ({ page }) => {
    const blog = await openBlog(page);
    // The first two saves wait until released: the first then fails, the second goes through.
    const releases: (() => void)[] = [];
    const held = [0, 1].map(() => new Promise<void>((resolve) => releases.push(resolve)));
    let saves = 0;
    await page.route("**/api/articles/read", async (route) => {
      const which = saves++;
      if (which > 1) return route.fallback();
      await held[which];
      return which === 0 ? route.fulfill({ status: 500 }) : route.fallback();
    });
    await page.keyboard.press("j");
    await page.keyboard.press("Shift+A");
    await expect(line(page)).toHaveText("Marked 2 items as read");

    // The first fails: taken back and said, with Try again, and Mark all as read's Undo stays.
    releases[0]?.();
    await expect(line(page)).toHaveText("An article couldn't be marked as read. It's still unread.");
    await expect(row(page, blog, NEWEST)).toHaveAccessibleName(/, unread/);
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();

    // Mark all as read is saved: the connection is back, so the line returns to it, Undo included.
    releases[1]?.();
    await expect(line(page)).toHaveText("Marked 2 items as read");
    await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  });

  test("a mark made while nine turtles restarts is saved once it's back, with nothing said", async ({ page }) => {
    const blog = await openBlog(page);
    // A new version going live: the host answers "unavailable" for a moment.
    let refusals = 2;
    await page.route("**/api/articles/read", (route) => (refusals-- > 0 ? route.fulfill({ status: 503 }) : route.fallback()));
    const saved = page.waitForResponse((response) => response.url().endsWith("/api/articles/read") && response.ok());
    await page.keyboard.press("j");
    await saved;
    await expect(row(page, blog, NEWEST)).not.toHaveAccessibleName(/, unread/);
    await expect(feedLink(page, blog)).toHaveAccessibleName(`Blog ${blog} 2 unread`);
    await expect(page.getByText("couldn't be marked as read")).toHaveCount(0);
  });
});

test("a newer version waits until a mark is saved before switching", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same on every width");
  const blog = await openBlog(page);
  // The save is held, as if nine turtles were slow to answer.
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/articles/read", async (route) => {
    await held;
    return route.fallback();
  });
  await page.keyboard.press("j");
  // A newer version goes live and the tab notices.
  await page.route("**/api/session", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), "x-nine-turtles-version": "a-newer-one" } });
  });
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.waitForResponse((response) => response.url().endsWith("/api/session"));
  await page.evaluate(() => Object.assign(window, { stillHere: true }));

  // The mark is still on its way: going somewhere stays in this page, so it isn't lost.
  await sidebar(page).getByRole("link", { name: /^Starred/ }).click();
  await expect(page).toHaveURL(/\/starred$/);
  expect(await page.evaluate(() => "stillHere" in window)).toBe(true);

  // Once it's saved, the next move switches.
  const saved = page.waitForResponse((response) => response.url().endsWith("/api/articles/read") && response.ok());
  release();
  await saved;
  await feedLink(page, blog).click();
  await expect.poll(() => page.evaluate(() => "stillHere" in window)).toBe(false);
  await expect(row(page, blog, NEWEST)).not.toHaveAccessibleName(/, unread/);
});

test("on a phone, the article's Star button and More's Mark unread work", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the phone layout only");
  const blog = await openBlog(page, 412);
  await row(page, blog, NEWEST).click();
  await article(page).getByRole("button", { name: "Star" }).click();
  await article(page).getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Mark unread" }).click();
  await article(page).getByRole("button", { name: `Back to Blog ${blog}` }).click();
  await expect(row(page, blog, NEWEST)).toHaveAccessibleName(/, unread/);
  await expect(row(page, blog, NEWEST)).toHaveAccessibleName(/, Starred/);
});

test("Settings: the sort order is saved for every device", async ({ page, isMobile }) => {
  test.skip(isMobile, "one browser at a time changes this shared setting");
  // The nine turtles with no feeds, so changing its sort order affects no other test's list.
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

test("river mode: no Unread view, no counts, no read styling, and it opens on All", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same on every width");
  // The setting is shared by every test using this nine turtles, so this
  // page alone is told it's in river mode, and its changes aren't saved.
  let mode = "river";
  await page.route("**/api/settings", (route) =>
    route.request().method() === "POST"
      ? ((mode = JSON.parse(route.request().postData() ?? "{}").mode ?? mode),
        route.fulfill({ json: { sort: "newest", mode } }))
      : route.fulfill({ json: { sort: "newest", mode } }),
  );
  const name = await openBlog(page);

  await expect(sidebar(page).getByRole("link", { name: "All", exact: true })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Unread", exact: true })).toHaveCount(0);
  await expect(feedLink(page, name)).not.toContainText("unread");
  await expect(row(page, name, NEWEST)).not.toContainText("unread");
  await expect(row(page, name, NEWEST).locator(".unread-dot")).toHaveCount(0);

  const more = page.getByRole("button", { name: "More", exact: true });
  await more.click();
  await expect(page.getByRole("menuitem", { name: "Refresh" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Mark all as read" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Opening an article still records it as read, quietly.
  await row(page, name, NEWEST).click();
  await expect(article(page).getByRole("heading", { name: NEWEST })).toBeVisible();

  // Shift+A marks nothing; g u does nothing; "/" and the Unread address open All.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Shift+A");
  await expect(page.getByText(/Marked \d+ items? as read/)).toHaveCount(0);
  await page.keyboard.press("g");
  await page.keyboard.press("u");
  await expect(page).toHaveURL(/\/feeds\/\d+$/);
  await page.goto(new URL("/", FEEDS_APP).href);
  await appReady(page);
  await expect(page).toHaveURL(/\/all$/);
  await page.goto(new URL("/unread", FEEDS_APP).href);
  await appReady(page);
  await expect(page).toHaveURL(/\/all$/);
  await expect(page.getByRole("heading", { name: "All", level: 2 })).toBeVisible();

  // Back to inbox in Settings: Unread and the counts return, and what was read shows as read.
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  const reading = page.getByRole("region", { name: "Reading" });
  await expect(reading.getByRole("radio", { name: "River" })).toBeChecked();
  // With only the keyboard: Tab to the choice, an arrow key changes it.
  await tabTo(page, reading.getByRole("radio", { name: "River" }));
  await page.keyboard.press("ArrowLeft");
  await expect(reading.getByRole("radio", { name: "Inbox" })).toBeChecked();
  await expect(sidebar(page).getByRole("link", { name: "Unread", exact: true })).toBeVisible();
  await feedLink(page, name).click();
  await expect(row(page, name, MIDDLE)).toContainText("unread");
  await expect(row(page, name, NEWEST)).not.toContainText("unread");
});

test("the server's reading mode decides where the app opens", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same on every width");
  await page.setViewportSize({ width: 1280, height: 800 });
  // This device last saw inbox mode; the server says river (changed on another device).
  let mode = "river";
  await page.route("**/api/settings", (route) => route.fulfill({ json: { sort: "newest", mode } }));
  await page.goto(new URL("/unread", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await expect(page).toHaveURL(/\/all$/);
  await page.reload();
  await appReady(page);
  await expect(page).toHaveURL(/\/all$/);

  // Now it remembers river; the server says inbox again: "/" opens Unread after all.
  mode = "inbox";
  await page.goto(new URL("/", FEEDS_APP).href);
  await appReady(page);
  await expect(page).toHaveURL(/\/unread$/);
  await expect(sidebar(page).getByRole("link", { name: "Unread", exact: true })).toBeVisible();
});

test("Settings: unread counts can hide, and unread can let go after a while", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same on every width");
  // Shared by every test using this nine turtles, so this page alone is
  // told about its settings, and its changes aren't saved.
  let settings: Record<string, string> = { sort: "newest", mode: "inbox", counts: "shown", let_go: "never" };
  const changes: unknown[] = [];
  await page.route("**/api/settings", (route) => {
    if (route.request().method() === "POST") {
      const change = JSON.parse(route.request().postData() ?? "{}");
      changes.push(change);
      settings = { ...settings, ...change };
    }
    return route.fulfill({ json: settings });
  });
  const name = await openBlog(page);
  await expect(feedLink(page, name)).toHaveAccessibleName(`Blog ${name} 3 unread`);

  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  const reading = page.getByRole("region", { name: "Reading" });
  await expect(reading.getByRole("radio", { name: "Show" })).toBeChecked();
  await expect(reading.getByRole("radio", { name: "Never" })).toBeChecked();
  // With only the keyboard: Tab to the choice, an arrow key changes it.
  await tabTo(page, reading.getByRole("radio", { name: "Show" }));
  await page.keyboard.press("ArrowRight");
  await expect(reading.getByRole("radio", { name: "Hide" })).toBeChecked();
  // The count goes; Unread stays.
  await expect(feedLink(page, name)).toHaveAccessibleName(`Blog ${name}`);
  await expect(sidebar(page).getByRole("link", { name: "Unread", exact: true })).toBeVisible();

  await reading.getByRole("radio", { name: "2 weeks" }).check();
  await expect(reading.getByRole("radio", { name: "2 weeks" })).toBeChecked();
  expect(changes).toEqual([{ counts: "hidden" }, { let_go: "two-weeks" }]);
  await expect(reading).toContainText("it counts as read and stays in its feed, All and search");
  // Nothing has let go yet: a choice must stand a minute first.
  await expect(feedLink(page, name)).toHaveAccessibleName(`Blog ${name}`);

  // Remembered: after a reload the counts stay hidden.
  await page.reload();
  await appReady(page);
  await expect(reading.getByRole("radio", { name: "Hide" })).toBeChecked();
  await expect(reading.getByRole("radio", { name: "2 weeks" })).toBeChecked();
  await expect(feedLink(page, name)).toHaveAccessibleName(`Blog ${name}`);

  // River mode has no Unread to let go of, so the two rows step aside.
  await reading.getByRole("radio", { name: "River" }).check();
  await expect(reading.getByRole("radio", { name: "Hide" })).toHaveCount(0);
  await expect(reading.getByRole("radio", { name: "2 weeks" })).toHaveCount(0);
});

test("Catch me up: everything in Unread from before today is read, and Undo brings back the same", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same on every width");
  const name = await openBlog(page);
  const blogId = Number(new URL(page.url()).pathname.split("/").pop());
  const listed = await (await page.request.get(new URL(`/api/articles?feed=${blogId}`, FEEDS_APP).href)).json();
  const ids: number[] = listed.articles.map((each: { id: number }) => each.id);
  // Every other test's articles are unread before today too: this page's
  // catching up answers with this blog's alone and marks nothing.
  let sentBefore = 0;
  await page.route("**/api/articles/catch-up", (route) => {
    sentBefore = JSON.parse(route.request().postData() ?? "{}").before;
    return route.fulfill({ json: { ids } });
  });
  const undone: unknown[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/articles/read")) undone.push(request.postDataJSON());
  });

  // Only Unread's More menu has it.
  const more = page.getByRole("button", { name: "More", exact: true });
  await more.click();
  await expect(page.getByRole("menuitem", { name: "Mark all as read" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Catch me up" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await sidebar(page).getByRole("link", { name: "Unread", exact: true }).click();
  // With only the keyboard: Enter opens More on its first item, the down arrow reaches Catch me up.
  await more.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Mark all as read" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "Catch me up" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Marked 3 items from before today as read")).toBeVisible();
  // The start of today on this device's clock.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expect(sentBefore).toBe(today.getTime() / 1000);

  await page.keyboard.press("u");
  await expect(line(page)).toContainText("Undone.");
  // Each mark also says when it was made (decision 0101).
  await expect.poll(() => undone).toContainEqual({ ids, read: false, at: expect.any(Number) });
  await expect(feedLink(page, name)).toHaveAccessibleName(`Blog ${name} 3 unread`);
});
