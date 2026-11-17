import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// Decision 0260, "to the last detail", done by a browser: a blog that sends
// things messily (feed-server.mjs, /messy/NAME/) shows its own name, a plain
// title, and says what didn't arrive; and the page opens in the reader's own
// Paper or Night from the first moment.

const pane = (page: Page) => page.getByRole("region", { name: "Article", exact: true });

test("the page opens in the reader's chosen page from the first moment, and says so if it takes a while", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("nine-turtles.preferences", JSON.stringify({ page: "night" })));
  // nine turtles itself never arrives, so only index.html's own script has run.
  await page.route(/\/assets\/.*\.js$/, (route) => route.abort());
  await page.goto(new URL("/all", FEEDS_APP).href);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute("content", "#121212");
  await expect(page.getByText("Opening your reading…")).toBeVisible();
});

test.describe("a messy feed", () => {
  test.skip(({ isMobile }) => isMobile, "the article stands in the wide window's reading pane");

  test("shows its own name, a plain title, and says what didn't arrive", async ({ page }) => {
    const name = `md-${test.info().workerIndex}-${Date.now()}`;
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(new URL("/all", FEEDS_APP).href);
    await appReady(page);
    await signIn(page);
    const id = await follow(page, `${FEED_SITE}/messy/${name}/feed.xml`);
    await page.goto(new URL(`/${id}`, FEEDS_APP).href);
    await appReady(page);

    // "Blog – Messy NAME » Latest Posts" is shown as the blog's own name.
    await expect(page.locator("#list-heading")).toContainText(`Messy ${name}`);
    await expect(page.locator("#list-heading")).not.toContainText("Latest Posts");
    // "Tom &amp;amp; Jerry&amp;#8217;s guide", coded twice, reads as itself.
    await page.locator(".item-row").first().click();
    await expect(pane(page).getByRole("heading", { level: 2, name: "Tom & Jerry’s guide" })).toBeVisible();

    // The writer's name in the byline is a link to their list (decision 0289).
    await expect(pane(page).locator(".article-byline").getByRole("link", { name: `Messy ${name}` })).toHaveAttribute(
      "href",
      new RegExp(`^/(?:[a-z0-9-]+-)?${id}$`),
    );

    const text = pane(page).locator(".article-text");
    // A frame: a note naming its site, with a link to it, never the frame.
    await expect(text.locator("iframe")).toHaveCount(0);
    await expect(text).toContainText("Something from maps.example is embedded here.");
    const open = text.getByRole("link", { name: "Open it", exact: true });
    await expect(open).toHaveAttribute("href", "https://www.maps.example/embed?town=1");
    // Like every link out of nine turtles: the open arrow, "Opens in a new tab" aloud, and 44px to press.
    await expect(open).toHaveAccessibleDescription("Opens in a new tab");
    await expect(open.locator("svg")).toBeVisible();
    expect((await open.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(text.locator(".offline-image").first()).toHaveAttribute("lang", "en");

    // A picture that won't load: what it showed, and where it may still be.
    await expect(text).toContainText("A picture didn’t load: The harbour at low tide.");
    await expect(text.locator("img")).toHaveCount(0);
    await expect(text.getByRole("link", { name: "See it on the original", exact: true })).toHaveAttribute(
      "href",
      `https://messy-${name}.example/guide`,
    );

    // A table wider than the column says so, and the keyboard can reach it to scroll.
    await expect(text).toContainText("Scroll the table sideways to see all 12 columns.");
    await expect(text.getByRole("table")).toHaveAttribute("tabindex", "0");

    // The button says "Write back"; who it's to is said aloud with it, and nothing under it names them or their address (decision 0298).
    const button = pane(page).getByRole("button", { name: `Write back to Messy ${name}` });
    expect(await button.evaluate((element) => {
      const shown = element.cloneNode(true) as HTMLElement;
      shown.querySelectorAll(".sr-only").forEach((hidden) => hidden.remove());
      return shown.textContent?.trim();
    })).toBe("Write back");
    await expect(pane(page).locator(".write-back .to")).toHaveCount(0);
  });
});

test("an article's pauses: a typed break drawn as the short rule and hidden from screen readers, code that keeps its line, a last picture with the ◆ after it (decision 0298)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same marks on a phone");
  const name = `pauses-${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/pauses/${name}/feed.xml`);
  await page.goto(new URL(`/${id}`, FEEDS_APP).href);
  await appReady(page);
  await page.locator(".item-row").first().click();
  const text = pane(page).locator(".article-text");
  // "* * *" stays in the text as the writer typed it, drawn as the break and not read out.
  const typed = text.locator("p", { hasText: "* * *" });
  await expect(typed).toHaveClass(/section-break/);
  await expect(typed).toHaveAttribute("aria-hidden", "true");
  // The code keeps its one long line and scrolls sideways instead.
  const code = text.locator("pre");
  await expect(code).toHaveCSS("white-space", "pre");
  expect(await code.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  // The article ends on a picture alone: it's given a picture's room, and the ◆ follows it on a line of its own.
  const last = text.locator("p").last();
  await expect(last).toHaveClass(/\bpicture\b/);
  await expect(text).toHaveClass(/\bends\b/);
  expect(await text.evaluate((element) => getComputedStyle(element, "::after").content)).toContain("◆");
  // On a line of its own, centred on the column (decision 0302).
  expect(await text.evaluate((element) => getComputedStyle(element, "::after").display)).toBe("block");
});

test("bare words from a feed: a short subtitle is only the beginning, a whole plain note ends on the ◆ (decision 0306)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same on a phone");
  const name = `teasers-${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/teasers/${name}/feed.xml`);
  await page.goto(new URL(`/${id}`, FEEDS_APP).href);
  await appReady(page);
  // "Going slowly" stands for the post: it says so and points to the rest, with no ◆.
  await page.locator(".item-row", { hasText: "On keeping a slower pace" }).click();
  await expect(pane(page).getByText("Only the beginning is shared here.")).toBeVisible();
  await expect(pane(page).getByRole("link", { name: /Read the rest on/ })).toBeVisible();
  await expect(pane(page).locator(".article-text")).not.toHaveClass(/\bends\b/);
  // A note too long to be a subtitle is the whole piece: no paragraph around it, and still the ◆.
  await pane(page).getByRole("button", { name: /^Back to/ }).click();
  await page.locator(".item-row", { hasText: "A morning by the river" }).click();
  const text = pane(page).locator(".article-text");
  await expect(text).toContainText("which was the point.");
  await expect(text).toHaveClass(/\bends\b/);
  await expect(pane(page).getByText("Only the beginning is shared here.")).toHaveCount(0);
});
