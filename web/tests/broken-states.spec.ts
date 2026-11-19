import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, feedsShown, follow, signIn } from "./screens";

// Broken states say what's true, and nothing spills off the screen (decision
// 0312): nine turtles not answering while the device is online, the page that
// opens then, a post with no title, a sign-in that ended while reading, names
// with no space to break at, and pressing Sign in with an empty field.

const article = (page: Page) => page.getByRole("region", { name: "Article", exact: true });
const LONG = "https://www.a-very-long-site-name-with-no-spaces-anywhere.example/feeds/everything.xml";

async function signedIn(page: Page, path = "/all"): Promise<void> {
  await page.goto(new URL(path, FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
}

/** Nothing wider than the window: no name or title runs off its edge. */
async function fitsTheWindow(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

test.describe("the same on every width", () => {
  test.skip(({ isMobile }) => isMobile, "the same on every width");

  test("online, but nine turtles not answering, never says you're offline", async ({ page }) => {
    await signedIn(page);
    const id = await follow(page, `${FEED_SITE}/blog/away-${test.info().workerIndex}-${Date.now()}/`);
    // The device stays online; only nine turtles' answer for the list never comes.
    await page.route(/\/api\/articles\?/, (route) => route.abort());
    await page.goto(new URL(`/${id}`, FEEDS_APP).href);
    await expect(page.getByText(/^nine turtles can't be reached right now\./).first()).toBeVisible();
    await expect(page.getByText("You're offline.", { exact: false })).toHaveCount(0);
  });

  test("the page that opens while nine turtles can't be reached has Try again, and opens the app once it answers", async ({ page }) => {
    let answering = false;
    await page.route("**/api/session", (route) => (answering ? route.fallback() : route.fulfill({ status: 503 })));
    await page.goto(new URL("/all", FEEDS_APP).href);
    const problem = page.getByRole("status").filter({ hasText: "nine turtles can't be reached right now." });
    await expect(problem).toBeVisible();
    // In oxblood with the alert icon, as every error (BRAND.md → "Messages"), never a dead end.
    await expect(problem).toHaveClass(/text-danger/);
    await expect(problem.locator("svg")).toHaveCount(1);
    answering = true;
    await problem.getByRole("button", { name: "Try again" }).click();
    await appReady(page);
    await expect(problem).toHaveCount(0);
  });

  test("a post with no title opens without a big Untitled; screen readers still hear its opening as its heading", async ({ page }) => {
    await signedIn(page);
    const id = await follow(page, `${FEED_SITE}/untitled/notitle-${test.info().workerIndex}-${Date.now()}/`);
    await page.goto(new URL(`/${id}`, FEEDS_APP).href);
    await appReady(page);
    await page.locator(".item-row", { hasText: "Rain all day." }).click();
    const heading = article(page).getByRole("heading", { level: 2 });
    await expect(heading).toHaveText(/^Rain all day\./);
    await expect(heading).toHaveClass(/sr-only/);
    await expect(article(page).getByText("Untitled", { exact: true })).toHaveCount(0);
  });

  test("an article that couldn't load because the sign-in ended says so, with Sign in", async ({ page }) => {
    await signedIn(page);
    const id = await follow(page, `${FEED_SITE}/blog/ended-${test.info().workerIndex}-${Date.now()}/`);
    await page.goto(new URL(`/${id}`, FEEDS_APP).href);
    await appReady(page);
    await page.route(/\/api\/articles\/[0-9]+$/, (route) => route.fulfill({ status: 401 }));
    await page.route("**/api/session", (route) => route.fulfill({ json: { signed_in: false } }));
    await page.locator(".item-row").first().click();
    const problem = article(page).getByRole("status").filter({ hasText: "You're signed out, so the article couldn't be loaded." });
    await expect(problem).toBeVisible();
    await expect(problem.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(problem.getByRole("button", { name: "Try again" })).toHaveCount(0);
  });

  test("pressing Sign in with an empty field says which, in nine turtles' words", async ({ page }) => {
    await page.goto("/");
    await appReady(page);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("status")).toHaveText("Type your email and password.");
    await page.getByLabel("Email").fill("someone@example.com");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("status")).toHaveText("Type your password too.");
    await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  });
});

test("a name or title with no space to break at stays inside a phone's screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signedIn(page, "/following");
  const id = await follow(page, `${FEED_SITE}/blog/long-${test.info().workerIndex}-${Date.now()}/`);
  const longer = (body: { feeds: Record<string, unknown>[] }) => {
    for (const feed of body.feeds) if (feed.id === id) feed.title = LONG;
  };
  await feedsShown(page, "**/api/feeds", longer);
  await feedsShown(page, "**/api/tidy/feeds", longer);
  await page.route(/\/api\/articles\?/, async (route) => {
    const response = await route.fetch().catch(() => undefined);
    if (!response) return route.abort().catch(() => undefined);
    const body = await response.json().catch(() => undefined);
    if (!body) return route.abort().catch(() => undefined);
    if (body.articles?.[0]) body.articles[0].title = LONG;
    await route.fulfill({ response, json: body }).catch(() => undefined);
  });
  await page.goto(new URL("/following", FEEDS_APP).href);
  await appReady(page);
  await expect(page.getByText(LONG).filter({ visible: true }).first()).toBeVisible();
  await fitsTheWindow(page);
  await page.goto(new URL(`/${id}`, FEEDS_APP).href);
  await appReady(page);
  await expect(page.locator(".item-row", { hasText: LONG })).toBeVisible();
  await fitsTheWindow(page);
});
