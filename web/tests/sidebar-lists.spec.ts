import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// SPEC sections 5 and 18 (decisions 0174 and 0187), "How to check it", done
// by a browser: the sidebar's lists, the same for everyone. On a wide window
// only: the sidebar is the computer's.

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });

test("Recently read is gone", async ({ page, isMobile }) => {
  test.skip(isMobile, "the sidebar is the computer's");
  const blog = `often-${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await follow(page, `${FEED_SITE}/blog/${blog}/`);

  // Unread, Starred and All articles are the sidebar's lists; Recently read is gone (decision 0174).
  await expect(sidebar(page).getByRole("link", { name: "All articles", exact: true })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Recently read", exact: true })).toHaveCount(0);

  // Its old address leads nowhere now.
  await page.goto(new URL("/recent", FEEDS_APP).href);
  await expect(page.getByRole("heading", { level: 1, name: "Wrong turn?" })).toBeVisible();
});

// Every list shows for everyone (decision 0187): the page that hid them is gone, and its address opens Settings.
test("the sidebar shows every list, Notes always (decision 0221), and Show in the sidebar is gone", async ({ page, isMobile }) => {
  test.skip(isMobile, "the sidebar is the computer's");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await expect(page.getByRole("link", { name: /^Show in the sidebar/ })).toHaveCount(0);
  await page.goto(new URL("/settings/sidebar", FEEDS_APP).href);
  await appReady(page);
  await expect(page).toHaveURL(/\/settings$/);
  const nav = sidebar(page);
  for (const name of ["Unread", "Starred", "Notes", "All articles"]) await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
});
