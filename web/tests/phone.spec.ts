import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

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
    // The feeds screen is home: Settings at the top, Refresh beside it, no sidebar toggle.
    await expect(sidebar(page).getByRole("link", { name: "Settings" })).toBeVisible();
    await expect(sidebar(page).getByRole("button", { name: "Refresh" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sidebar" })).toHaveCount(0);
    await expect(page.getByText("Press ? for shortcuts")).toBeHidden();

    await sidebar(page).getByRole("link", { name: /^Reading Room/ }).click();
    await expect(sidebar(page)).toBeHidden();
    await expect(list(page).getByRole("heading", { level: 2, name: "Reading Room" })).toBeVisible();
    await expect(list(page).getByRole("button", { name: "‹ Feeds" })).toBeVisible();
    // Refresh is in the top bar, so there's only ever one.
    await expect(page.getByRole("button", { name: "Refresh", exact: true })).toHaveCount(1);

    await row(page, "The pleasure of a slow letter").click();
    await expect(title(page, "The pleasure of a slow letter")).toBeFocused();
    await expect(list(page)).toBeHidden();
    await expect(article(page).getByRole("button", { name: "‹ Reading Room" })).toBeVisible();

    // The back arrows go back one step each time.
    await article(page).getByRole("button", { name: "‹ Reading Room" }).click();
    await expect(row(page, "The pleasure of a slow letter")).toBeFocused();
    await list(page).getByRole("button", { name: "‹ Feeds" }).click();
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
    await list(page).getByRole("button", { name: "‹ Feeds" }).click();
    await expect(sidebar(page)).toBeVisible();
  });

  test("the article's toolbar sits at the bottom: previous, next, star, share, open original", async ({ page }) => {
    await openHome(page);
    await sidebar(page).getByRole("link", { name: /^Reading Room/ }).click();
    await row(page, "The pleasure of a slow letter").click();

    const words = (await toolbar(page).locator(":scope > *").allInnerTexts()).map((text) => text.trim());
    expect(words).toEqual(["Previous", "Next", "Star", expect.stringMatching(/^(Share|Copy link)$/), "Open original"]);
    // Within thumb reach: at the bottom of the screen.
    const box = await toolbar(page).boundingBox();
    const height = page.viewportSize()?.height ?? 0;
    expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(height);
    await expect(toolbar(page).getByRole("link", { name: "Open original" })).toHaveAttribute(
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
