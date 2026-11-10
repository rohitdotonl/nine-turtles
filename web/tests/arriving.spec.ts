import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// Decision 0249 (SPEC section 13): while feeds brought from a file wait for
// their first check, Unread says how many are left, the sidebar says
// "checking…" beside each, and the list fills in by itself until an article
// is opened. The server's part (which feeds wait) is checked in
// server/tests/background_checks.rs; here the server's answers are changed
// so the browser sees an import part of the way through, whatever else the
// shared test nine turtles holds.

/** The feeds answer, with every feed (or none) still waiting for its first check. */
async function waitingFeeds(page: Page, waiting: () => boolean) {
  await page.route("**/api/feeds", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const body = await response.json();
    for (const feed of body.feeds) feed.waiting = waiting();
    await route.fulfill({ response, json: body });
  });
}

/** Unread, empty until `arrived` says the first articles have come. */
async function unreadArriving(page: Page, arrived: () => boolean) {
  await page.route(/\/api\/articles\?/, async (route) => {
    if (arrived()) return route.continue();
    await route.fulfill({ json: { articles: [], next: null, latest: 0 } });
  });
  await page.route(/\/api\/articles\/new\?/, (route) => route.fulfill({ json: { new: arrived() } }));
}

test("a list brought from a file fills in Unread as it's checked, and says how much is left", async ({ page, isMobile }) => {
  test.skip(isMobile, "the phone shows the same list; the sidebar is its own screen there");
  await page.clock.install();
  await page.goto(new URL("/unread", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  // Something unread to arrive.
  const name = `arriving-${test.info().workerIndex}-${Date.now()}`;
  await follow(page, `${FEED_SITE}/blog/${name}/`);
  let [checking, arrived] = [true, false];
  await waitingFeeds(page, () => checking);
  await unreadArriving(page, () => arrived);
  await page.reload();
  await appReady(page);

  // Nothing yet: not "Nothing unread.", but what's happening, in words.
  const list = page.getByRole("region", { name: "Unread" });
  await expect(list.getByText(/^Bringing in your list: \d+ feeds? still to check\.$/)).toBeVisible();
  await expect(list.getByText("Their articles show here as each one is checked.")).toBeVisible();
  await expect(list.getByText("Nothing unread.")).toHaveCount(0);
  const sidebar = page.getByRole("navigation", { name: "Sidebar" });
  await expect(sidebar.getByText("checking…").first()).toBeVisible();

  // The first articles come: the list fills in by itself, with no r, and the line stays above them.
  arrived = true;
  await expect(async () => {
    await page.clock.fastForward(5_000);
    await expect(list.getByRole("listitem").first()).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
  await expect(list.getByText(/^Bringing in your list:/)).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "New articles" })).toHaveCount(0);
  // Screen readers hear it, as they'd hear the note.
  await expect(page.locator('[aria-live="polite"]').filter({ hasText: "New articles are in the list." })).toBeAttached();

  // Every feed checked: the line and "checking…" go, and Unread waits for r again.
  checking = false;
  await expect(async () => {
    await page.clock.fastForward(5_000);
    await expect(sidebar.getByText("checking…")).toHaveCount(0, { timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
  await expect(list.getByText(/^Bringing in your list:/)).toHaveCount(0);
});

test("once an article is opened, new ones wait for r as usual, even while a list is being checked", async ({ page, isMobile }) => {
  test.skip(isMobile, "the desktop test above covers the list; this is about opening one");
  await page.clock.install();
  await page.goto(new URL("/unread", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const name = `arriving-open-${test.info().workerIndex}-${Date.now()}`;
  await follow(page, `${FEED_SITE}/blog/${name}/`);
  await waitingFeeds(page, () => true);
  await page.route(/\/api\/articles\/new\?/, (route) => route.fulfill({ json: { new: true } }));
  await page.reload();
  await appReady(page);
  const list = page.getByRole("region", { name: "Unread" });
  await list.getByRole("listitem").first().getByRole("button").first().click();
  // The sidebar stays still while you read: its feeds aren't loaded again.
  let sidebarLoads = 0;
  page.on("request", (request) => {
    if (request.method() === "GET" && new URL(request.url()).pathname === "/api/feeds") sidebarLoads++;
  });
  await expect(async () => {
    await page.clock.fastForward(5_000);
    await expect(page.getByRole("status").filter({ hasText: "New articles · press r" })).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
  await page.clock.fastForward(15_000);
  expect(sidebarLoads).toBe(0);
});
