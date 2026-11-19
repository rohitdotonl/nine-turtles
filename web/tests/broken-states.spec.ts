import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, feedsShown, follow, signIn, tabTo } from "./screens";

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

  test("the page that opens while nine turtles can't be reached has Try again from the keyboard, and asks again by itself", async ({ page }) => {
    let answering = false;
    await page.route("**/api/session", (route) => (answering ? route.fallback() : route.fulfill({ status: 503 })));
    await page.clock.install();
    await page.goto(new URL("/all", FEEDS_APP).href);
    const problem = page.getByRole("status").filter({ hasText: "nine turtles can't be reached right now." });
    await expect(problem).toBeVisible();
    // In oxblood with the alert icon, as every error (BRAND.md → "Messages"), never a dead end.
    await expect(problem).toHaveClass(/text-danger/);
    await expect(problem.locator("svg")).toHaveCount(1);
    // From the keyboard: Try again, and while it asks the keyboard waits on the name; still failing, the line comes back, heard again.
    const again = problem.getByRole("button", { name: "Try again" });
    await tabTo(page, again);
    await page.keyboard.press("Enter");
    await expect(problem).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "nine turtles" })).toBeFocused();
    // Once nine turtles answers, the app opens by itself within 10 seconds.
    answering = true;
    await page.clock.runFor(10_000);
    await appReady(page);
    await expect(problem).toHaveCount(0);
  });

  test("with the device offline the page says so calmly, and opens once the device is back online", async ({ page, context }) => {
    let answering = false;
    await page.route("**/api/session", (route) => (answering ? route.fallback() : route.fulfill({ status: 503 })));
    await page.goto(new URL("/all", FEEDS_APP).href);
    await expect(page.getByText("nine turtles can't be reached right now.")).toBeVisible();
    // The line follows the device, even while showing.
    await context.setOffline(true);
    const calm = page.getByRole("status").filter({ hasText: "You're offline. nine turtles opens once you're back online." });
    await expect(calm).toBeVisible();
    await expect(calm).not.toHaveClass(/text-danger/);
    await expect(calm.getByRole("button")).toHaveCount(0);
    answering = true;
    await context.setOffline(false);
    await appReady(page);
    await expect(calm).toHaveCount(0);
  });

  test("Everyone you follow without a connection says so in one calm line, and shows them once back", async ({ page, context }) => {
    await signedIn(page);
    const name = `calm-${test.info().workerIndex}-${Date.now()}`;
    await follow(page, `${FEED_SITE}/blog/${name}/`);
    await context.setOffline(true);
    await page.getByRole("navigation", { name: "Sidebar" }).getByRole("link", { name: /Everyone you follow/ }).click();
    const calm = page.getByRole("status").filter({ hasText: "You're offline. Everyone you follow shows once you're back online." });
    await expect(calm).toBeVisible();
    // No errors with Try agains that couldn't work: not for the list, nor for who isn't working.
    await expect(page.getByText(/couldn't be loaded/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
    await context.setOffline(false);
    await expect(calm).toHaveCount(0);
    await expect(page.locator("main, [role=main]").getByText(`Blog ${name}`, { exact: true }).first()).toBeVisible();
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

  test("pressing Sign in with an empty field says which, in nine turtles' words, from the keyboard too", async ({ page }) => {
    await page.goto("/");
    await appReady(page);
    // Enter in the empty email field, as a keyboard sends the form.
    await expect(page.getByLabel("Email")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status")).toHaveText("Type your email and password.");
    await page.getByLabel("Email").fill("someone@example.com");
    await page.getByLabel("Email").press("Enter");
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

// The second round (decision 0318): a busy answer never leaves a page blank or
// says something untrue, a missing connection is said calmly everywhere, and
// signing in without a connection keeps the password.
test.describe("broken states, round 2", () => {
  test("a busy answer for everyone you follow says why the list is empty, and Try again brings it", async ({ page }) => {
    await signedIn(page);
    await follow(page, `${FEED_SITE}/blog/busy-${test.info().workerIndex}-${Date.now()}/`);
    let busy = true;
    await page.route("**/api/feeds", (route) => (busy ? route.fulfill({ status: 503 }) : route.fallback()));
    await page.goto(new URL("/all", FEEDS_APP).href);
    const problem = page.getByRole("status").filter({ hasText: "The articles couldn't be loaded." });
    await expect(problem).toBeVisible();
    await expect(problem).toHaveClass(/text-danger/);
    // From the keyboard: the keyboard waits on the list's name while it asks, and the list comes.
    busy = false;
    await tabTo(page, problem.getByRole("button", { name: "Try again" }));
    await page.keyboard.press("Enter");
    await expect(page.locator("#list-heading")).toBeFocused();
    await expect(problem).toHaveCount(0);
    await expect(page.locator(".item-row").first()).toBeVisible();
  });

  test("the sidebar's Try again keeps the keyboard's place, then puts it on the sidebar", async ({ page, isMobile }) => {
    test.skip(isMobile, "the sidebar sits beside the list on a computer");
    await signedIn(page);
    await follow(page, `${FEED_SITE}/blog/side-${test.info().workerIndex}-${Date.now()}/`);
    let busy = true;
    await page.route("**/api/feeds", (route) => (busy ? route.fulfill({ status: 503 }) : route.fallback()));
    await page.goto(new URL("/all", FEEDS_APP).href);
    const line = page.locator("#sidebar").getByText("Everyone you follow couldn't be loaded.");
    await expect(line).toBeVisible();
    const again = page.locator("#sidebar").getByRole("button", { name: "Try again" });
    await tabTo(page, again);
    // Still failing: the line and its button stay, and so does the keyboard.
    const answered = page.waitForResponse("**/api/feeds");
    await page.keyboard.press("Enter");
    await answered;
    await expect(again).toBeFocused();
    busy = false;
    await page.keyboard.press("Enter");
    await expect(line).toHaveCount(0);
    await expect(page.locator("#sidebar a").first()).toBeFocused();
  });

  test("Everyone you follow says once that it couldn't load, not twice, even while Try again asks", async ({ page }) => {
    await signedIn(page);
    let release: () => void = () => {};
    const held = new Promise<void>((done) => (release = done));
    let tries = 0;
    await page.route(/\/api\/(tidy\/feeds|health)$/, async (route) => {
      // The second time round, the page's answer comes only when the test says.
      if (tries++ >= 2 && route.request().url().endsWith("/api/tidy/feeds")) await held;
      await route.fulfill({ status: 500 });
    });
    await page.goto(new URL("/following", FEEDS_APP).href);
    const main = page.locator("main, [role=main]");
    await expect(main.getByText("Everyone you follow couldn't be loaded.")).toHaveCount(1);
    await expect(page.getByText("Who isn't working couldn't be checked.")).toHaveCount(0);
    await main.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("Who isn't working couldn't be checked.")).toHaveCount(0);
    release();
    await expect(main.getByText("Everyone you follow couldn't be loaded.")).toHaveCount(1);
    await expect(page.getByText("Who isn't working couldn't be checked.")).toHaveCount(0);
  });

  test("Hidden articles without a connection say so calmly, and show by themselves once back", async ({ page, context }) => {
    await signedIn(page, "/settings/hiding");
    await context.setOffline(true);
    await page.evaluate(() => {
      history.pushState({}, "", "/settings/hidden");
      dispatchEvent(new PopStateEvent("popstate"));
    });
    const calm = page.getByRole("status").filter({ hasText: "You're offline. Hidden articles show once you're back online." });
    await expect(calm).toBeVisible();
    await expect(calm).not.toHaveClass(/text-danger/);
    await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
    await context.setOffline(false);
    await expect(calm).toHaveCount(0);
    await expect(page.getByText("Nothing hidden yet.")).toBeVisible();
  });

  test("Connected assistants that couldn't load never says nothing is connected", async ({ page }) => {
    await signedIn(page);
    await page.route("**/api/assistants", (route) => (route.request().method() === "GET" ? route.fulfill({ status: 500 }) : route.fallback()));
    await page.goto(new URL("/settings/assistants", FEEDS_APP).href);
    await expect(page.getByText("The connected assistants couldn't be loaded.")).toBeVisible();
    await expect(page.getByText("Nothing connected yet.")).toHaveCount(0);
  });

  test("All readers with no answer says so calmly, and only a real refusal says who sees Readers", async ({ page }) => {
    await signedIn(page);
    await page.route("**/api/admin", (route) => route.abort());
    await page.goto(new URL("/settings/readers/all", FEEDS_APP).href);
    const calm = page.getByRole("status").filter({ hasText: "nine turtles can't be reached right now. All readers shows once it's back." });
    await expect(calm).toBeVisible();
    await expect(calm).not.toHaveClass(/text-danger/);
    await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
    await expect(page.getByText(/Only whoever runs/)).toHaveCount(0);
    await page.unroute("**/api/admin");
    await page.route("**/api/admin", (route) => route.fulfill({ status: 403, json: { error: "owner-only" } }));
    await page.reload();
    await expect(page.getByText("Only whoever runs this nine turtles sees Readers.")).toBeVisible();
    await expect(page.getByText("The readers couldn't be loaded.")).toHaveCount(0);
  });

  test("signing in without a connection says you're offline and keeps the password", async ({ page, context }) => {
    await page.goto("/");
    await appReady(page);
    await page.getByLabel("Email").fill("someone@example.com");
    await page.getByLabel("Password", { exact: true }).fill("a password typed once");
    await context.setOffline(true);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("You're offline. Sign in once you're back online.");
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue("a password typed once");
    await context.setOffline(false);
  });

  test("signing up without a connection says you're offline, with what to do", async ({ page, context }) => {
    await page.goto(new URL("/sign-up", FEEDS_APP).href);
    await page.getByLabel("Email").fill("someone-new@example.com");
    await page.getByLabel("Password", { exact: true }).fill("a long enough password");
    await context.setOffline(true);
    await page.getByRole("button", { name: "Sign up", exact: true }).click();
    await expect(page.getByText("You're offline. Try again once you're back online.")).toBeVisible();
    await context.setOffline(false);
  });
});
