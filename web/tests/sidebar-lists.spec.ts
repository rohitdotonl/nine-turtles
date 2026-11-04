import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn, tabTo } from "./screens";

// SPEC sections 5, 15 and 18 (decisions 0105 and 0174), "How to check it",
// done by a browser: hiding lists from the sidebar in Settings, and how often
// a feed posts in Edit. On a wide window only: which lists the sidebar shows
// is the reader's own setting, shared by every test signed in as them.

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });

test("Recently read is gone, and Edit says how often a feed posts", async ({ page, isMobile }) => {
  test.skip(isMobile, "the sidebar is the computer's");
  const blog = `often-${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${blog}/`);

  // Unread, Starred and All are the sidebar's lists; Recently read is gone (decision 0174).
  await expect(sidebar(page).getByRole("link", { name: "All", exact: true })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Recently read", exact: true })).toHaveCount(0);

  // Edit says how often the feed posts, in words, under its kind of source.
  await page.goto(new URL(`/people/${id}/edit`, FEEDS_APP).href);
  await appReady(page);
  await expect(page.getByText(/^(Posts about|Posts less|Hasn't posted in|Too new to tell)/)).toBeVisible();

  // Its old address leads nowhere now.
  await page.goto(new URL("/recent", FEEDS_APP).href);
  await expect(page.getByRole("heading", { level: 1, name: "Wrong turn?" })).toBeVisible();
});

// The other lists, by keyboard alone. This page's settings are answered here
// rather than saved, so hiding Starred and All never reaches another test
// signed in as the same reader.
test("Starred and All can be hidden by keyboard, and their keys still work", async ({ page, isMobile }) => {
  test.skip(isMobile, "the tick boxes are worked by keyboard, and g s / g a are a keyboard's");
  let hidden: string[] = [];
  let unread = true;
  await page.route("**/api/settings", async (route) => {
    if (route.request().method() === "POST") {
      const sent = route.request().postDataJSON() as { hidden?: string[] };
      if (sent.hidden) hidden = sent.hidden;
    }
    const real = await (await page.request.get(route.request().url())).json();
    await route.fulfill({ json: { ...real, hidden, unread } });
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await page.goto(new URL("/settings/sidebar", FEEDS_APP).href);
  await appReady(page);

  const nav = sidebar(page);
  const group = page.getByRole("group", { name: "Show in the sidebar" });
  // Tab reaches each tick box, Space unticks it, and the list leaves the sidebar.
  for (const [name, gone] of [
    ["Starred", nav.getByRole("link", { name: "Starred", exact: true })],
    ["All", nav.getByRole("link", { name: "All", exact: true })],
  ] as const) {
    const box = group.getByRole("checkbox", { name, exact: true });
    await expect(gone).toBeVisible();
    await tabTo(page, box);
    await page.keyboard.press("Space");
    await expect(box).not.toBeChecked();
    await expect(gone).toHaveCount(0);
  }
  expect([...hidden].sort()).toEqual(["all", "starred"]);
  // Unread is still there.
  await expect(nav.getByRole("link", { name: "Unread", exact: true })).toBeVisible();

  // Their keys still go to them.
  // Escape goes back to Settings, and again closes it.
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/settings$/);
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/\/settings$/);
  await page.keyboard.press("g");
  await page.keyboard.press("s");
  await expect(page).toHaveURL(/\/starred$/);
  await expect(page.getByRole("heading", { level: 2, name: "Starred" })).toBeVisible();
  await page.keyboard.press("g");
  await page.keyboard.press("a");
  await expect(page).toHaveURL(/\/all$/);
  await expect(page.getByRole("heading", { level: 2, name: "All" })).toBeVisible();

  // With Unread off All is home, so it shows even though it's hidden.
  unread = false;
  await page.reload();
  await appReady(page);
  await expect(nav.getByRole("link", { name: "All", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Starred", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Unread", exact: true })).toHaveCount(0);
});
