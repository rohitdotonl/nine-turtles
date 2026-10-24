import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn, tabTo } from "./screens";

// SPEC section 20 (phones and installing the app), and the "slowfeed was
// updated" line of section 18, "How to check it", done by a browser.

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });
const list = (page: Page) => page.getByRole("region", { name: "Reading Room" });
const article = (page: Page) => page.getByRole("region", { name: "Article" });
const title = (page: Page, name: string) => article(page).getByRole("heading", { level: 2, name });
const row = (page: Page, name: string) => list(page).getByRole("button", { name: new RegExp(name) });
const toolbar = (page: Page) => article(page).getByRole("group", { name: "Article actions" });

/** Signs in on a phone, follows Reading Room and opens the app's front page: the feeds screen. */
async function openHome(page: Page) {
  await page.goto(new URL("/", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await follow(page, `${FEED_SITE}/reading/`);
  await page.goto(new URL("/", FEEDS_APP).href);
  await appReady(page);
  await expect(sidebar(page)).toBeVisible();
}

test.describe("on a phone", () => {
  test.skip(({ isMobile }) => !isMobile, "the phone layout only");

  test("Feeds → Items → Article, each with a back arrow saying where it goes", async ({ page }) => {
    await openHome(page);
    // The feeds screen is home: Refresh at the top, Settings at the bottom, no sidebar toggle.
    await expect(sidebar(page).getByRole("link", { name: "Settings" })).toBeVisible();
    await expect(sidebar(page).getByRole("button", { name: "Refresh" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sidebar" })).toHaveCount(0);
    await expect(page.getByText("Press ? for shortcuts")).toBeHidden();

    await sidebar(page).getByRole("link", { name: /^Reading Room/ }).click();
    await expect(sidebar(page)).toBeHidden();
    await expect(list(page).getByRole("heading", { level: 2, name: "Reading Room" })).toBeVisible();
    await expect(list(page).getByRole("button", { name: "Back to Feeds" })).toBeVisible();
    // Refresh and More are quiet icons beside the list's title, and there's only ever one Refresh.
    await expect(page.getByRole("button", { name: "Refresh", exact: true })).toHaveCount(1);
    await expect(list(page).getByRole("button", { name: "More", exact: true })).toBeVisible();
    for (const control of [list(page).getByRole("button", { name: "Refresh", exact: true }), list(page).getByRole("button", { name: "More", exact: true })]) {
      const box = (await control.boundingBox())!;
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
    }

    await row(page, "The pleasure of a slow letter").click();
    await expect(title(page, "The pleasure of a slow letter")).toBeFocused();
    await expect(list(page)).toBeHidden();
    await expect(article(page).getByRole("button", { name: "Back to Reading Room" })).toBeVisible();

    // The back arrows go back one step each time.
    await article(page).getByRole("button", { name: "Back to Reading Room" }).click();
    await expect(row(page, "The pleasure of a slow letter")).toBeFocused();
    await list(page).getByRole("button", { name: "Back to Feeds" }).click();
    await expect(sidebar(page)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "slowfeed" })).toBeFocused();
  });

  test("the system back gesture goes back one step, and forward again", async ({ page }) => {
    await openHome(page);
    await sidebar(page).getByRole("link", { name: /^Reading Room/ }).click();
    await row(page, "The pleasure of a slow letter").click();
    await expect(title(page, "The pleasure of a slow letter")).toBeVisible();

    await page.goBack();
    await expect(article(page)).toBeHidden();
    await expect(row(page, "The pleasure of a slow letter")).toBeFocused();
    await page.goBack();
    await expect(sidebar(page)).toBeVisible();
    await expect(list(page)).toBeHidden();

    await page.goForward();
    await expect(list(page)).toBeVisible();
  });

  test("arriving straight at a list, its back arrow still leads to the feeds", async ({ page }) => {
    await openHome(page);
    const link = sidebar(page).getByRole("link", { name: /^Reading Room/ });
    await page.goto(new URL((await link.getAttribute("href")) ?? "/", FEEDS_APP).href);
    await appReady(page);
    await list(page).getByRole("button", { name: "Back to Feeds" }).click();
    await expect(sidebar(page)).toBeVisible();
  });

  test("the article's toolbar sits at the bottom as quiet icons; back and open original sit at the top", async ({ page }) => {
    await openHome(page);
    await sidebar(page).getByRole("link", { name: /^Reading Room/ }).click();
    await row(page, "The pleasure of a slow letter").click();

    // Icons only, each with its name for screen readers.
    const names = await toolbar(page).locator(":scope > *").evaluateAll((controls) => controls.map((control) => control.getAttribute("aria-label")));
    expect(names).toEqual(["Previous", "Next", "Reading appearance", "Star", "Mark unread", expect.stringMatching(/^(Share|Copy link)$/)]);
    expect((await toolbar(page).innerText()).trim()).toBe("");
    // Within thumb reach: at the bottom of the screen.
    const box = await toolbar(page).boundingBox();
    const height = page.viewportSize()?.height ?? 0;
    expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(height);
    // The icons sit in one line, and each place is a full 44px tap.
    const tops = await toolbar(page).locator(":scope > * svg").evaluateAll((icons) =>
      icons.filter((icon) => getComputedStyle(icon).visibility !== "hidden").map((icon) => Math.round(icon.getBoundingClientRect().top + icon.getBoundingClientRect().height / 2)),
    );
    expect(tops.length).toBeGreaterThanOrEqual(5);
    expect(new Set(tops).size).toBe(1);
    for (const control of await toolbar(page).locator(":scope > *").all()) {
      const place = (await control.boundingBox())!;
      expect(Math.min(place.width, place.height)).toBeGreaterThanOrEqual(44);
    }
    // The way to the publisher is at the top, beside the back arrow.
    await expect(article(page).getByRole("link", { name: "Open original" })).toHaveAttribute(
      "href",
      "https://reading-room.example/slow-letter",
    );

    // The first article has nothing before it.
    await expect(toolbar(page).getByRole("button", { name: "Previous" })).toHaveAttribute("aria-disabled", "true");
    await toolbar(page).getByRole("button", { name: "Next" }).click();
    await expect(title(page, "Only the first page")).toBeFocused();
    await toolbar(page).getByRole("button", { name: "Previous" }).click();
    await expect(title(page, "The pleasure of a slow letter")).toBeFocused();

    await toolbar(page).getByRole("button", { name: "Star" }).click();
    await expect(toolbar(page).getByRole("button", { name: "Star" })).toHaveAttribute("aria-pressed", "true");
    await toolbar(page).getByRole("button", { name: "Star" }).click();
    await expect(toolbar(page).getByRole("button", { name: "Star" })).toHaveAttribute("aria-pressed", "false");
  });

  test("Aa opens the reading panel as a sheet along the bottom; Close gives the place back to Aa", async ({ page }) => {
    await openHome(page);
    await sidebar(page).getByRole("link", { name: /^Reading Room/ }).click();
    await row(page, "The pleasure of a slow letter").click();

    const aa = toolbar(page).getByRole("button", { name: "Reading appearance" });
    await aa.click();
    const panel = page.getByRole("dialog", { name: "Reading appearance" });
    await expect(panel).toBeVisible();
    // The width of the screen, along its bottom.
    const box = (await panel.boundingBox())!;
    const size = page.viewportSize()!;
    expect(Math.round(box.x)).toBe(0);
    expect(Math.round(box.width)).toBe(size.width);
    expect(Math.round(box.y + box.height)).toBe(size.height);
    // Every control is a full 44px tap.
    for (const control of [panel.getByRole("button", { name: "Smaller text" }), panel.getByRole("button", { name: "Larger text" }), panel.getByRole("button", { name: "Close" })]) {
      const place = (await control.boundingBox())!;
      expect(Math.min(place.width, place.height)).toBeGreaterThanOrEqual(44);
    }
    for (const choice of await panel.locator("label").all()) {
      expect((await choice.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }

    await panel.getByRole("radio", { name: "Night" }).check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
    await panel.getByRole("button", { name: "Close" }).click();
    await expect(panel).toHaveCount(0);
    await expect(aa).toBeFocused();
    await expect(title(page, "The pleasure of a slow letter")).toBeVisible();
  });

  test("with only a keyboard: Tab and Enter move on, Escape goes back one step", async ({ page }) => {
    await openHome(page);
    // Other tests add feeds and folders here, so find it by name first.
    await tabTo(page, sidebar(page).getByRole("searchbox"));
    await page.keyboard.type("Reading Room");
    await tabTo(page, sidebar(page).getByRole("link", { name: /^Reading Room/ }));
    await page.keyboard.press("Enter");
    await expect(list(page).getByRole("heading", { level: 2, name: "Reading Room" })).toBeFocused();

    await tabTo(page, row(page, "The pleasure of a slow letter"));
    await page.keyboard.press("Enter");
    await expect(title(page, "The pleasure of a slow letter")).toBeFocused();
    await tabTo(page, toolbar(page).getByRole("button", { name: "Next" }));
    await page.keyboard.press("Enter");
    await expect(title(page, "Only the first page")).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(row(page, "Only the first page")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { level: 1, name: "slowfeed" })).toBeFocused();

    // Settings is one step on from the feeds; Escape and Close settings go back to them.
    await tabTo(page, sidebar(page).getByRole("link", { name: "Settings" }));
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 2, name: "Settings" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(sidebar(page)).toBeVisible();
    await sidebar(page).getByRole("link", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Close settings" }).click();
    await expect(sidebar(page)).toBeVisible();
    // Back from the feeds leaves Settings behind: it doesn't reopen.
    await page.goBack();
    await expect(page.getByRole("heading", { level: 2, name: "Settings" })).toBeHidden();
  });

  test("Cancel on Edit feed goes back to the list, and back again doesn't reopen it", async ({ page }) => {
    await openHome(page);
    await sidebar(page).getByRole("link", { name: /^Reading Room/ }).click();
    await list(page).getByRole("link", { name: "Edit feed" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(list(page).getByRole("heading", { level: 2, name: "Reading Room" })).toBeVisible();
    await page.goBack();
    await expect(sidebar(page)).toBeVisible();
  });

  test("a long feed name stays on one line in the list's title and wraps in the back arrow, never running off the screen", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await openHome(page);
    const name = `averyveryverylongfeednamewithoutanyspaces-${Date.now()}`;
    const id = await follow(page, `${FEED_SITE}/blog/${name}/`);
    // On the feeds screen the long name is cut short; nothing runs off the side, and Settings stays reachable.
    await page.goto(new URL("/", FEEDS_APP).href);
    await appReady(page);
    await expect(sidebar(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    const settings = (await sidebar(page).getByRole("link", { name: "Settings" }).boundingBox())!;
    expect(settings.x + settings.width).toBeLessThanOrEqual(320);
    await page.goto(new URL(`/feeds/${id}`, FEEDS_APP).href);
    await appReady(page);
    // The list's title stays on one line and ends in "…", with the whole name as its tooltip.
    const title = page.locator("#list-heading");
    await expect(title).toHaveAttribute("title", `Blog ${name}`);
    const lines = await title.evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      line: parseFloat(getComputedStyle(element).lineHeight),
      cut: element.scrollWidth > element.clientWidth,
      ellipsis: getComputedStyle(element).textOverflow,
    }));
    expect(lines.height).toBeLessThan(lines.line * 1.5);
    expect(lines.cut).toBe(true);
    expect(lines.ellipsis).toBe("ellipsis");
    expect((await title.boundingBox())!.width).toBeLessThanOrEqual(320);
    await page.getByRole("button", { name: /A year of reading slowly/ }).click();
    const back = article(page).getByRole("button", { name: `Back to Blog ${name}` });
    await expect(back).toBeVisible();
    const box = (await back.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });

  test("every tap target is at least 44 pixels tall", async ({ page }) => {
    await openHome(page);
    const tooSmall = () =>
      page.evaluate(() =>
        [...document.querySelectorAll("button, a, input")]
          .filter((element) => !element.closest(".article-text") && !element.closest("article p"))
          .map((element) => ({ element, box: element.getBoundingClientRect() }))
          .filter(({ box }) => box.width > 0 && box.height > 0 && box.height < 44)
          .map(({ element }) => element.textContent?.trim() || element.outerHTML.slice(0, 60)),
      );
    expect(await tooSmall()).toEqual([]);
    await sidebar(page).getByRole("link", { name: /^Reading Room/ }).click();
    await expect(row(page, "The pleasure of a slow letter")).toBeVisible();
    expect(await tooSmall()).toEqual([]);
    await row(page, "The pleasure of a slow letter").click();
    await expect(toolbar(page)).toBeVisible();
    expect(await tooSmall()).toEqual([]);
  });
});

test.describe("adding slowfeed to the home screen", () => {
  test.use({ serviceWorkers: "allow" });

  test("the app describes itself for the home screen, with its own icon, and opens full-screen", async ({ page }) => {
    const response = await page.request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest).toMatchObject({ name: "slowfeed", start_url: "/", display: "standalone" });
    for (const icon of manifest.icons as { src: string }[]) {
      const image = await page.request.get(icon.src);
      expect(image.headers()["content-type"]).toBe("image/png");
    }
    expect((await page.request.get("/icons/apple-touch-icon.png")).ok()).toBe(true);

    await page.goto("/");
    await appReady(page);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
    // The service worker that lets it be installed, and open without a connection.
    const registered = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.scriptURL);
    expect(registered).toMatch(/\/sw\.js$/);
  });

  test("without a connection, the kept copy opens and says slowfeed can't be reached", async ({ page, context }) => {
    await page.goto("/");
    await appReady(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    // Open once more under the service worker, so it keeps a copy of the page.
    await page.reload();
    await appReady(page);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText("slowfeed can't be reached right now. Reload the page to try again.")).toBeVisible();
    await context.setOffline(false);
  });
});

test("a tab left open across an update is told to reload, and Settings offers the new version", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same on every width");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await follow(page, `${FEED_SITE}/reading/`);
  await page.reload();
  await appReady(page);

  // A newer slowfeed that doesn't understand this tab's way of starring.
  await page.route("**/api/articles/starred", (route) =>
    route.fulfill({ status: 400, headers: { "x-slowfeed-version": "a-newer-version" }, body: "" }),
  );
  await page.getByRole("button", { name: /The pleasure of a slow letter/ }).click();
  await page.getByRole("region", { name: "Article" }).getByRole("button", { name: "Star" }).click();
  await expect(page.getByText("slowfeed was updated. Reload to continue.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reload", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByText("A new version is ready.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reload", exact: true })).toBeVisible();
});
