import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// Fewer steps for what readers do most (decision 0214), done by a browser: a
// row's own menu (SPEC section 6), Mark all as read at the end of a list, and
// the writer's name under an article's title opening the page about them
// (SPEC section 7). Each test follows a blog of its own, since every test
// shares one reader.

const pane = (page: Page) => page.getByRole("region", { name: "Article", exact: true });
const rows = (page: Page) => page.locator(".item-row");
const rowMenu = (page: Page) => page.getByRole("menu", { name: /^Actions for / });
const aboutPage = (page: Page, name: string) => page.getByRole("region", { name: `About ${name}` });

/** Follows a fresh blog of three unread articles and opens its list. */
async function openBlog(page: Page, width = 1280): Promise<string> {
  const name = `rm-${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);
  await page.goto(new URL(`/people/${id}`, FEEDS_APP).href);
  await appReady(page);
  await expect(rows(page)).toHaveCount(3);
  return `Blog ${name}`;
}

test.describe("on a wide window", () => {
  test.skip(({ isMobile }) => isMobile, "the phone's long press has its own test below");

  test("a row's menu stars, marks read, and goes to the writer's page, by mouse or keyboard", async ({ page }) => {
    const name = await openBlog(page);
    const first = rows(page).nth(0);
    await first.click({ button: "right" });
    const menu = rowMenu(page);
    await expect(menu.getByRole("menuitem")).toHaveText([/^\s*Star\s*$/, /Mark as read/, /Write back/, new RegExp(`Info about ${name}`), /Open in a new tab/, /Copy link/]);
    // No keys printed: the same actions have theirs elsewhere.
    await expect(menu.locator("kbd")).toHaveCount(0);
    await expect(menu.getByRole("menuitem").first()).toBeFocused();
    await menu.getByRole("menuitem", { name: "Star" }).click();
    await expect(menu).toHaveCount(0);
    await expect(first.locator(".row-star")).toBeVisible();
    await expect(first).toBeFocused();
    // Nothing opened: no row is chosen.
    await expect(page.locator(".item-row[aria-current]")).toHaveCount(0);

    // The keyboard: Shift+F10 opens it on the row that has the keyboard; Escape gives the keyboard back.
    const second = rows(page).nth(1);
    await second.focus();
    await page.keyboard.press("Shift+F10");
    await expect(rowMenu(page).getByRole("menuitem").first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(rowMenu(page)).toHaveCount(0);
    await expect(second).toBeFocused();
    // The Menu key does the same.
    await page.keyboard.press("ContextMenu");
    await expect(rowMenu(page).getByRole("menuitem").first()).toBeFocused();
    // Tab leaves it for the row, not past the list.
    await page.keyboard.press("Tab");
    await expect(rowMenu(page)).toHaveCount(0);
    await second.focus();
    await page.keyboard.press("Shift+F10");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(second.locator(".unread-dot")).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Marked as read." })).toBeVisible();
    // Undo puts it back, as for every mark.
    await page.keyboard.press("u");
    await expect(second.locator(".unread-dot")).toHaveCount(1);

    // Info about them goes to their page.
    await rows(page).nth(2).click({ button: "right" });
    await rowMenu(page).getByRole("menuitem", { name: `Info about ${name}` }).click();
    await expect(aboutPage(page, name).getByRole("heading", { level: 2, name })).toBeVisible();
  });

  test("Write back from a row's menu opens the article and starts writing back", async ({ page }) => {
    await openBlog(page);
    await rows(page).nth(0).click({ button: "right" });
    await rowMenu(page).getByRole("menuitem", { name: "Write back" }).click();
    await expect(pane(page).getByRole("heading", { level: 2 })).toBeVisible();
    // Their address isn't known yet: the box asking for it opens, with the keyboard in it.
    await expect(pane(page).getByRole("textbox", { name: "Their email address" })).toBeFocused();
  });

  test("the writer's name under the title opens their page, and I does from any list", async ({ page }) => {
    const name = await openBlog(page);
    await rows(page).nth(0).click();
    const writer = pane(page).locator(".article-byline").getByRole("button", { name });
    await writer.click();
    await expect(aboutPage(page, name).getByRole("heading", { level: 2, name })).toBeVisible();

    // From All, where the list isn't theirs, I goes to the chosen article's writer.
    await page.goto(new URL("/all", FEEDS_APP).href);
    await appReady(page);
    const theirs = page.locator(".item-row").filter({ hasText: name }).first();
    await theirs.click();
    await expect(pane(page).getByRole("heading", { level: 2 })).toBeVisible();
    await theirs.focus();
    await page.keyboard.press("i");
    await expect(aboutPage(page, name).getByRole("heading", { level: 2, name })).toBeVisible();
  });

  test("Mark all as read waits at the end of a list with unread articles, with Undo", async ({ page }) => {
    await openBlog(page);
    const end = page.getByRole("button", { name: "Mark all as read", exact: true });
    await expect(page.locator(".list-end")).toBeVisible();
    // Right under the closing caption.
    const caption = (await page.locator(".list-end").boundingBox())!;
    const button = (await end.boundingBox())!;
    expect(button.y).toBeGreaterThan(caption.y + caption.height);
    expect(button.height).toBeGreaterThanOrEqual(44);
    // By the keyboard: the button goes once pressed, and the keyboard's place stays in the list.
    await end.focus();
    await page.keyboard.press("Enter");
    await expect(rows(page).locator(".unread-dot")).toHaveCount(0);
    await expect(end).toHaveCount(0);
    await expect(rows(page).first()).toBeFocused();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(rows(page).locator(".unread-dot")).toHaveCount(3);
    await expect(end).toBeVisible();

    // Not under search results, which end "No more results."
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("textbox", { name: "Search articles", exact: true }).fill("summary");
    await expect(page.locator(".list-end")).toHaveText("No more results.");
    await expect(end).toHaveCount(0);
  });
});

test("on a phone, a long press on a row opens its menu, and the tap doesn't open the article", async ({ page, isMobile }) => {
  test.skip(!isMobile, "a touch screen's long press");
  await openBlog(page, 412);
  const first = rows(page).nth(0);
  const box = (await first.boundingBox())!;
  const at = { pointerType: "touch", isPrimary: true, clientX: box.x + 40, clientY: box.y + 20 };
  await first.dispatchEvent("pointerdown", at);
  await expect(rowMenu(page)).toBeVisible();
  // The pressed row keeps the pointer's faint tone (never the selection pill), so it's clear which article the menu acts on.
  await expect(first).toHaveAttribute("data-held", "");
  await expect(rows(page).nth(1)).not.toHaveAttribute("data-held");
  const pill = await page.locator(".item-row[data-held]").evaluate((row) => getComputedStyle(row).backgroundColor);
  expect(pill).not.toBe("rgba(0, 0, 0, 0)");
  await first.dispatchEvent("pointerup", at);
  await first.dispatchEvent("click", at);
  await expect(pane(page)).toHaveCount(0);
  // Inside the screen, whatever the press's place.
  const menu = (await rowMenu(page).boundingBox())!;
  expect(menu.x + menu.width).toBeLessThanOrEqual(412);
  await rowMenu(page).getByRole("menuitem", { name: "Star" }).click();
  await expect(first.locator(".row-star")).toBeVisible();
  // Closed, the row lets go.
  await expect(first).not.toHaveAttribute("data-held");
});
