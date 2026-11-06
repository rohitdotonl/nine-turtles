import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, nothingToPickUp, signIn } from "./screens";

// SPEC section 7, "Start reading" (decision 0206): with nothing open and an
// unread article first in the list, the reading area (on a phone, the list's
// first place) has already begun it, and Start reading opens it. Uses a blog
// of its own, whose newest articles arrive unread, since every test shares
// the one nine turtles that has feeds.

const pane = (page: Page) => page.getByRole("region", { name: "Article", exact: true });

async function followBlog(page: Page): Promise<number> {
  await nothingToPickUp(page);
  const name = `start-${test.info().workerIndex}-${Date.now()}`;
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);
  await page.goto(new URL(`/people/${id}`, FEEDS_APP).href);
  await appReady(page);
  return id;
}

test("the empty reading area begins the newest unread article, and Start reading opens it", async ({ page, isMobile }) => {
  test.skip(isMobile, "a phone has no reading area beside the list: the next test");
  await page.setViewportSize({ width: 1280, height: 800 });
  await followBlog(page);
  const first = page.locator(".item-row").first();
  const title = (await first.locator(".title").innerText()).replace(/, unread$/, "").trim();
  await expect(pane(page)).toContainText("Newest unread");
  await expect(pane(page).getByRole("heading", { level: 2, name: title })).toBeVisible();
  await expect(pane(page).locator(".reading-empty")).toHaveCount(0);
  // Its first paragraph, as plain text.
  await expect(pane(page).getByText(/^A short made-up summary for article \d+\.$/)).toBeVisible();
  const start = pane(page).getByRole("button", { name: "Start reading" });
  await expect(start).toHaveClass(/btn-primary/);
  // Showing it marks nothing read.
  await expect(first).toContainText(", unread");
  await start.click();
  await expect(pane(page).getByRole("button", { name: "Start reading" })).toHaveCount(0);
  await expect(pane(page).getByRole("heading", { level: 2, name: title })).toBeVisible();
});

test("on a phone, the first unread row of the list is begun, still one row", async ({ page, isMobile }) => {
  test.skip(!isMobile, "on a computer it's in the reading area: the test above");
  await followBlog(page);
  await expect(page.locator(".item-list li").first()).toContainText("Newest unread");
  const first = page.locator(".item-row").first();
  await expect(first).toContainText(/A short made-up summary for article \d+\./);
  const start = first.getByText("Start reading");
  await expect(start).toBeVisible();
  // The row is still the one button: Start reading only shows that pressing it opens the article.
  await expect(first.getByRole("button")).toHaveCount(0);
  await expect(page.locator(".item-row").nth(1)).not.toContainText("Newest unread");
  await start.click();
  await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
});
