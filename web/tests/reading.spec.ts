import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, openReadingRoom, signIn, tabTo } from "./screens";

// SPEC section 7 (and 19 and 21), "How to check it", done by a browser, on
// the made-up Reading Room blog (tests/feed-server.mjs).

const article = (page: Page) => page.getByRole("region", { name: "Article" });
const title = (page: Page, name: string) => article(page).getByRole("heading", { level: 2, name });
const row = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(name) });

async function openRoom(page: Page, width = 1280) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await openReadingRoom(page);
}

async function visits(page: Page, path: string): Promise<number> {
  const response = await page.request.get(`${FEED_SITE}/visits`);
  const counts = (await response.json()) as Record<string, number>;
  return counts[path] ?? 0;
}

test.describe("on a wide window", () => {
  test.skip(({ isMobile }) => isMobile, "the phone layout has its own test below");

  test("j shows an article cleaned and restyled, and j and k move through the list", async ({ page }) => {
    await openRoom(page);
    await expect(article(page).getByText("No article open.")).toBeVisible();

    await page.keyboard.press("j");
    await expect(row(page, "The pleasure of a slow letter")).toHaveAttribute("aria-current", "true");
    await expect(row(page, "The pleasure of a slow letter")).toBeFocused();
    await expect(title(page, "The pleasure of a slow letter")).toBeVisible();

    // Headings, quotes, tables, code and the publisher's image, in place.
    const text = article(page).locator(".article-text");
    await expect(text.getByRole("heading", { name: "What a slow reader keeps" })).toBeVisible();
    await expect(text.locator("blockquote")).toContainText("Reading is a conversation");
    await expect(text.getByRole("table")).toBeVisible();
    await expect(text.locator("pre")).toContainText("read(book, slowly=True)");
    const image = article(page).getByRole("img", { name: "A river drawn as three blue lines" });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

    // Credit: the source links to the publisher, with the author and time.
    await expect(article(page).getByRole("link", { name: "Reading Room" })).toHaveAttribute("href", "https://reading-room.example/");
    await expect(article(page).getByText("Asha Rao")).toBeVisible();
    // Marked with its language, for screen readers.
    await expect(article(page).locator("article")).toHaveAttribute("lang", "en-gb");

    // Links in the text are underlined in the text color, never blue.
    const link = text.getByRole("link", { name: "letter" });
    await expect(link).toHaveAttribute("href", "https://reading-room.example/letters");
    const [linkColor, bodyColor, underline] = await link.evaluate((element) => [
      getComputedStyle(element).color,
      getComputedStyle(document.body).color,
      getComputedStyle(element).textDecorationLine,
    ]);
    expect(linkColor).toBe(bodyColor);
    expect(underline).toBe("underline");

    // The invisible tracking image never reached the screen, so it was never loaded.
    expect(await visits(page, "/reading/pixel.gif")).toBe(0);

    // j: the next one, a summary-only article. It was fetched in advance, so it shows at once.
    await page.keyboard.press("j");
    await expect(title(page, "Only the first page")).toBeVisible({ timeout: 100 });
    await expect(article(page).getByText("This feed shares just the opening paragraph")).toBeVisible({ timeout: 100 });
    await expect(article(page).getByText("This feed shares only a summary.")).toBeVisible();

    await page.keyboard.press("k");
    await expect(title(page, "The pleasure of a slow letter")).toBeVisible({ timeout: 100 });
  });

  test("Enter opens the article to read; Escape goes back to the list", async ({ page }) => {
    await openRoom(page);
    // Keyboard only: Tab reaches the first article; Enter opens it.
    await tabTo(page, row(page, "The pleasure of a slow letter"));
    await page.keyboard.press("Enter");
    await expect(title(page, "The pleasure of a slow letter")).toBeFocused();

    // While reading, j moves to the next article and keeps you reading.
    await page.keyboard.press("j");
    await expect(title(page, "Only the first page")).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(row(page, "Only the first page")).toBeFocused();

    // The arrow keys work like j and k in the list.
    await page.keyboard.press("ArrowDown");
    await expect(row(page, "A third, shorter note")).toBeFocused();
    await expect(title(page, "A third, shorter note")).toBeVisible();
  });

  test("a click shows an article, and Open original and v open the publisher's page in a new tab", async ({ page, context }) => {
    await context.route("https://reading-room.example/**", (route) =>
      route.fulfill({ contentType: "text/html", body: "<title>The original</title>" }),
    );
    await openRoom(page);
    await row(page, "Only the first page").click();
    await expect(title(page, "Only the first page")).toBeVisible();

    const original = article(page).getByRole("link", { name: "Open original" }).first();
    await expect(original).toHaveAttribute("href", "https://reading-room.example/first-page");
    await expect(original).toHaveAttribute("target", "_blank");

    const [tab] = await Promise.all([context.waitForEvent("page"), page.keyboard.press("v")]);
    await tab.waitForLoadState();
    expect(tab.url()).toBe("https://reading-room.example/first-page");
    await tab.close();
  });

  test("Copy link copies the publisher's address, not slowfeed's", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: FEEDS_APP });
    await openRoom(page);
    await page.keyboard.press("j");
    await article(page).getByRole("button", { name: "Copy link" }).click();
    await expect(article(page).getByRole("status")).toHaveText("Link copied.");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("https://reading-room.example/slow-letter");
  });

  test("a footnote link stays inside the article", async ({ page }) => {
    await openRoom(page);
    await page.keyboard.press("j");
    const text = article(page).locator(".article-text");
    await text.locator("sup").getByRole("link", { name: "1" }).click();
    await expect(text.getByText("1. Written in Python, a long time ago.")).toBeFocused();
    await expect(page).toHaveURL(/\/feeds\/[0-9]+$/);
    expect(page.context().pages()).toHaveLength(1);
  });

  test("in high-contrast mode, only the selected article is marked", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await openRoom(page);
    await page.keyboard.press("j");
    await page.keyboard.press("Enter");
    const style = (name: string) =>
      row(page, name).evaluate((element) => {
        const css = getComputedStyle(element);
        return { outline: css.outlineStyle, bar: css.borderLeftColor, page: getComputedStyle(document.body).backgroundColor };
      });
    const selected = await style("The pleasure of a slow letter");
    expect(selected.outline).toBe("solid");
    expect(selected.bar).not.toBe(selected.page);
    const other = await style("Only the first page");
    expect(other.outline).toBe("none");
    expect(other.bar).toBe(other.page);
  });

  test("+ and - change the text size while reading, and Settings remembers it", async ({ page }) => {
    await openRoom(page);
    await page.keyboard.press("j");
    const text = article(page).locator("article");
    const size = () => text.evaluate((element) => getComputedStyle(element).fontSize);
    await expect.poll(size).toBe("20px");

    await page.keyboard.press("+");
    await expect.poll(size).toBe("22px");
    await page.keyboard.press("-");
    await page.keyboard.press("-");
    await expect.poll(size).toBe("18px");

    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("radio", { name: "Small", exact: true })).toBeChecked();
  });
});

test("on a phone, an article fills the screen and the back button returns to the list", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the phone layout only");
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await openReadingRoom(page);

  await row(page, "The pleasure of a slow letter").click();
  await expect(title(page, "The pleasure of a slow letter")).toBeFocused();
  await expect(page.getByRole("region", { name: "Reading Room" })).toBeHidden();

  await article(page).getByRole("button", { name: "‹ Reading Room" }).click();
  await expect(row(page, "The pleasure of a slow letter")).toBeFocused();
  await expect(article(page)).toBeHidden();
});
