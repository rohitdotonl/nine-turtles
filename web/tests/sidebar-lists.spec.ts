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

  // Unread, Saved and All articles are the sidebar's lists; Recently read is gone (decision 0174).
  await expect(sidebar(page).getByRole("link", { name: "All articles", exact: true })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Recently read", exact: true })).toHaveCount(0);

  // Its old address leads nowhere now.
  await page.goto(new URL("/recent", FEEDS_APP).href);
  await expect(page.getByRole("heading", { level: 1, name: "Wrong turn?" })).toBeVisible();
});

// Every list shows for everyone (decision 0187): the page that hid them is gone, and its address opens Settings.
test("the sidebar shows every list, Notes always (decision 0222), and Show in the sidebar is gone", async ({ page, isMobile }) => {
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
  for (const name of ["Unread", "Saved", "Notes", "All articles", "Everyone you follow"]) await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();

  // Everyone you follow, under the lists (decision 0266): pressed, it opens at its own address with the keyboard on its
  // title, its row marked as your place and Settings' button no longer; no way back to press, as the sidebar is beside it.
  const everyone = nav.getByRole("link", { name: "Everyone you follow", exact: true });
  const settings = nav.getByRole("link", { name: "Settings", exact: true });
  await expect(settings).toHaveAttribute("aria-current", "page");
  await expect(everyone).not.toHaveAttribute("aria-current", "page");
  await everyone.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/following$/);
  await expect(page).toHaveTitle("Everyone you follow · nine turtles");
  await expect(page.getByRole("heading", { level: 2, name: "Everyone you follow" })).toBeFocused();
  await expect(everyone).toHaveAttribute("aria-current", "page");
  await expect(settings).not.toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: /^(Back to |Close)/ })).toHaveCount(0);
  // The row is built as the lists' rows are: the same height, the same left edge.
  const [row, list] = await Promise.all([everyone.boundingBox(), nav.getByRole("link", { name: "All articles", exact: true }).boundingBox()]);
  expect(row!.height).toBe(list!.height);
  expect(row!.x).toBe(list!.x);
  expect(row!.y).toBeGreaterThan(list!.y);
});

// Home (decision 0310): it opens on Saved; the first card reads Saved, Notes, All articles, Unread, Everyone you follow;
// Pinned always shows, and the pin beside the cog on someone's page puts them there and takes them off again.
test("Home opens on Saved, and the pin on someone's page pins them to Home and back", async ({ page, isMobile }) => {
  test.skip(isMobile, "the sidebar is the computer's");
  const blog = `pinned-${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${blog}/`);
  await page.goto(new URL("/", FEEDS_APP).href);
  await appReady(page);
  await expect(page).toHaveURL(/\/saved$/);
  const nav = sidebar(page);
  await expect(nav.getByRole("link", { name: "Saved", exact: true })).toHaveAttribute("aria-current", "page");
  const first = nav.locator("ul.home-card").first().getByRole("link");
  await expect(first).toHaveText(["Saved", "Notes", "All articles", "Unread", "Everyone you follow"]);
  await expect(nav.getByRole("heading", { level: 2, name: "Pinned" })).toBeVisible();
  const pinnedCard = nav.locator("h2:has-text('Pinned') + ul");
  // Other tests share this reader, so look only for this one.
  await expect(pinnedCard.locator(`a[href$="-${id}"]`)).toHaveCount(0);

  // Their page has the window to itself (decision 0275); the pin beside their cog pins them, kept on the server.
  const pinFromTheirPage = async (pressed: "true" | "false") => {
    await page.goto(new URL(`/x-${id}/about`, FEEDS_APP).href);
    await appReady(page);
    const pin = page.getByRole("button", { name: /^Pin .* to Home$/ });
    await expect(pin).toHaveAttribute("aria-pressed", pressed === "true" ? "false" : "true");
    // With the keyboard alone: a plain button, pressed with Enter.
    await pin.focus();
    await page.keyboard.press("Enter");
    await expect(pin).toHaveAttribute("aria-pressed", pressed);
    await page.goto(new URL("/", FEEDS_APP).href);
    await appReady(page);
  };
  // Nine pinned already: refused under their name, in words, and nothing changes.
  await page.goto(new URL(`/x-${id}/about`, FEEDS_APP).href);
  await appReady(page);
  await page.route("**/api/feeds/*/pin", (route) => route.fulfill({ status: 409, json: { error: "full" } }));
  const pin = page.getByRole("button", { name: /^Pin .* to Home$/ });
  await pin.focus();
  await page.keyboard.press(" ");
  await expect(page.getByRole("status").filter({ hasText: "9 are pinned already. Unpin someone first." })).toBeVisible();
  await expect(pin).toHaveAttribute("aria-pressed", "false");
  await page.unroute("**/api/feeds/*/pin");

  await pinFromTheirPage("true");
  await expect(pinnedCard.locator(`a[href$="-${id}"]`)).toBeVisible();
  await expect(nav.locator(`[data-drop-loose='person'] a[href$="-${id}"]`)).toHaveCount(0);
  // Pressed again, they're back among People.
  await pinFromTheirPage("false");
  await expect(pinnedCard.locator(`a[href$="-${id}"]`)).toHaveCount(0);
  await expect(nav.locator(`[data-drop-loose='person'] a[href$="-${id}"]`)).toBeVisible();
});
