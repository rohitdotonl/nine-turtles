import { expect, test } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn, tabTo } from "./screens";

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
  // A word on its own: the title carries a timestamp, which may end in 404.
  await expect(feed).not.toContainText(/\b404\b/);

  // The site names one feed: one plain question, rather than a list of one (decision 0106).
  await feed.getByRole("button", { name: `Find new address for ${title}` }).click();
  await expect(feed.getByText(new RegExp(`^Use ${FEED_SITE}/blog/${name}/new\\.xml instead\\?$`))).toBeVisible();
  await expect(feed).toContainText("Its name, folders, articles and stars stay.");
  await expect(feed.getByRole("radio")).toHaveCount(0);
  await feed.getByRole("button", { name: "Use it" }).click();
  await expect(feed.getByText(/It now reads from its new address and works again/)).toBeVisible();
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

test("a failing feed says so above its list, and Find its new address moves it with one question", async ({ page }) => {
  // Decision 0106: where the reader already is, not only on the health page.
  const name = `moving-line-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/`);
  expect((await page.request.get(`${FEED_SITE}/move/${name}`)).ok()).toBe(true);
  const failingSince = async () => {
    const library = await (await page.request.get(new URL("/api/feeds", FEEDS_APP).href)).json();
    return library.feeds.find((feed: { id: number }) => feed.id === id)?.failing_since ?? null;
  };
  // Two failed checks, as the health page needs before it lists a feed.
  await expect.poll(failingSince, { timeout: 30_000 }).not.toBeNull();

  // Edit feed offers it too, only while the feed is failing.
  await page.goto(new URL(`/feeds/${id}/edit`, FEEDS_APP).href);
  await appReady(page);
  await expect(page.getByRole("button", { name: "Find new address", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(new RegExp(`/feeds/${id}$`));

  const list = page.locator("#list-pane");
  await expect(list.getByText(/^This feed hasn't worked since (earlier today|\d+ \w+)\. Find its new address$/)).toBeVisible();
  const find = list.getByRole("button", { name: "Find its new address" });
  await tabTo(page, find);
  await page.keyboard.press("Enter");

  // One feed on the site: a plain question in place, and the keyboard on Use it.
  const question = list.getByRole("status").filter({ hasText: /instead\?$/ });
  await expect(question).toHaveText(`Use ${FEED_SITE}/blog/${name}/new.xml instead?`);
  await expect(list).toContainText("Its name, folders, articles and stars stay.");
  await expect(list.getByRole("radio")).toHaveCount(0);
  const useIt = list.getByRole("button", { name: "Use it" });
  await expect(useIt).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(list.getByRole("status").filter({ hasText: "It now reads from its new address and works again." })).toBeVisible();
  await expect(list.getByText(/This feed hasn't worked since/)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: title, level: 2 })).toBeFocused();
  expect(await failingSince()).toBeNull();
});

test("with the keyboard alone: Retry, Unsubscribe and Undo, Find new address and back, Escape", async ({ page }) => {
  const name = `moving-keys-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  await page.goto(new URL("/settings/feed-health", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await follow(page, `${FEED_SITE}/blog/${name}/`);
  expect((await page.request.get(`${FEED_SITE}/move/${name}`)).ok()).toBe(true);
  const feed = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(async () => {
    await page.reload();
    await appReady(page);
    await expect(feed).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  // The feed's own status line (Find new address has one of its own, after it).
  const status = feed.getByRole("status").first();

  // Retry: checked again at once, and still broken.
  await tabTo(page, feed.getByRole("button", { name: `Retry ${title}` }));
  await page.keyboard.press("Enter");
  await expect(status).toHaveText("Tried again just now: it still isn't working.");

  // Unsubscribe: the keyboard moves to Undo, and Undo brings it back.
  await tabTo(page, feed.getByRole("button", { name: `Unsubscribe from ${title}` }));
  await page.keyboard.press("Enter");
  await expect(status).toHaveText(`Unsubscribed from ${title}.`);
  const undo = feed.getByRole("button", { name: `Undo unsubscribing from ${title}` });
  await expect(undo).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(feed.getByRole("button", { name: `Unsubscribe from ${title}` })).toBeFocused();
  const library = await (await page.request.get(new URL("/api/feeds", FEEDS_APP).href)).json();
  expect(library.feeds.map((followed: { title: string }) => followed.title)).toContain(title);

  // Find new address: the keyboard lands on Use it, which says what it asks; Cancel goes back to the button.
  await tabTo(page, feed.getByRole("button", { name: `Find new address for ${title}` }));
  await page.keyboard.press("Enter");
  const useIt = feed.getByRole("button", { name: "Use it" });
  await expect(useIt).toBeFocused();
  await expect(useIt).toHaveAccessibleDescription(/^Use .*new\.xml instead\? Its name, folders, articles and stars stay\.$/);
  await page.keyboard.press("Shift+Tab");
  await expect(feed.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(feed.getByRole("button", { name: `Find new address for ${title}` })).toBeFocused();

  // Escape goes back to Settings.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Settings", level: 2 })).toBeVisible();
  await expect(page).toHaveURL(/\/settings$/);
});
