import { expect, test } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// SPEC section 17: a feed that stops working is listed on the feed health
// page in plain words, and Find new address moves it to where the site now
// keeps it. The test nine turtles checks every feed every two seconds, so a
// moved feed fails twice within moments. Each run follows a blog of its own.

test("a moved feed is listed in plain words, and Find new address moves it", async ({ page }) => {
  const name = `moving-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await follow(page, `${FEED_SITE}/blog/${name}/`);
  expect((await page.request.get(`${FEED_SITE}/move/${name}`)).ok()).toBe(true);

  // Settings › Feeds › Feed health.
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("link", { name: "Feed health" }).click();
  await expect(page.getByRole("heading", { name: "Feed health", level: 2 })).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/feed-health$/);

  const feed = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(async () => {
    await page.reload();
    await appReady(page);
    await expect(feed).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  // Grouped under words, never by color alone, and explained without codes.
  await expect(page.getByRole("heading", { name: "Having trouble" })).toBeVisible();
  await expect(feed).toContainText("Not found for less than a day.");
  await expect(feed).toContainText("The site says the feed isn't there any more.");
  await expect(feed).not.toContainText("404");

  await feed.getByRole("button", { name: `Find new address for ${title}` }).click();
  const choice = feed.getByRole("radio", { name: new RegExp(`${title}.*new\\.xml`) });
  await expect(choice).toBeChecked();
  await feed.getByRole("button", { name: "Use this address" }).click();
  await expect(feed.getByRole("status")).toHaveText(/It now reads from its new address and works again/);
  await expect(feed).toContainText("Working again.");
  // It stays where it was until the page is opened again; then it's gone.
  await page.reload();
  await appReady(page);
  await expect(page.getByRole("heading", { name: "Feed health", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: title })).toHaveCount(0);

  // Closing goes back to Settings.
  await page.getByRole("button", { name: "Close feed health" }).click();
  await expect(page.getByRole("heading", { name: "Settings", level: 2 })).toBeVisible();
});
