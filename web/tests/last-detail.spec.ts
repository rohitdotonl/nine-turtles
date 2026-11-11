import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// Decision 0258, "to the last detail", done by a browser: a blog that sends
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
    await page.goto(new URL(`/people/${id}`, FEEDS_APP).href);
    await appReady(page);

    // "Blog – Messy NAME » Latest Posts" is shown as the blog's own name.
    await expect(page.locator("#list-heading")).toContainText(`Messy ${name}`);
    await expect(page.locator("#list-heading")).not.toContainText("Latest Posts");
    // "Tom &amp;amp; Jerry&amp;#8217;s guide", coded twice, reads as itself.
    await page.locator(".item-row").first().click();
    await expect(pane(page).getByRole("heading", { level: 2, name: "Tom & Jerry’s guide" })).toBeVisible();

    // The writer's name in the byline is a link to their page.
    await expect(pane(page).locator(".article-byline").getByRole("link", { name: `Messy ${name}` })).toHaveAttribute(
      "href",
      `/people/${id}/about`,
    );

    const text = pane(page).locator(".article-text");
    // A frame: a note naming its site, with a link to it, never the frame.
    await expect(text.locator("iframe")).toHaveCount(0);
    await expect(text).toContainText("Something from maps.example is embedded here.");
    await expect(text.getByRole("link", { name: "Open it ↗" })).toHaveAttribute("href", "https://www.maps.example/embed?town=1");

    // A picture that won't load: what it showed, and where it may still be.
    await expect(text).toContainText("A picture didn’t load: The harbour at low tide.");
    await expect(text.locator("img")).toHaveCount(0);
    await expect(text.getByRole("link", { name: "See it on the original ↗" })).toHaveAttribute(
      "href",
      `https://messy-${name}.example/guide`,
    );

    // A table wider than the column says so, and the keyboard can reach it to scroll.
    await expect(text).toContainText("Scroll the table sideways to see all 12 columns.");
    await expect(text.getByRole("table")).toHaveAttribute("tabindex", "0");

    // Write back says who it's to, under the button.
    // The button says "Write back"; who it's to is said aloud with it, and shown under it.
    const button = pane(page).getByRole("button", { name: `Write back to Messy ${name}` });
    expect(await button.evaluate((element) => {
      const shown = element.cloneNode(true) as HTMLElement;
      shown.querySelectorAll(".sr-only").forEach((hidden) => hidden.remove());
      return shown.textContent?.trim();
    })).toBe("Write back");
    await expect(pane(page).locator(".write-back .to")).toHaveText(`to Messy ${name}`);
  });
});
