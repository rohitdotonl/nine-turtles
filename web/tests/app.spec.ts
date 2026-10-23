import { expect, test, type Page } from "@playwright/test";
import { appReady, chooseTheme, signIn, tabTo } from "./screens";

// SPEC sections 4, 5, 18 and 19, "How to check it", done by a browser.

async function openApp(page: Page, path = "/unread") {
  await page.goto(path);
  await appReady(page);
  await signIn(page);
}

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });
const list = (page: Page) => page.getByRole("region", { name: /^(Unread|Starred|All)$/ });
const article = (page: Page) => page.getByRole("region", { name: "Article" });
const toggle = (page: Page) => page.getByRole("button", { name: "Sidebar" });

test("a wide window shows three areas, a medium one two, a phone-narrow one one", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  await expect(sidebar(page)).toBeVisible();
  await expect(list(page)).toBeVisible();
  await expect(article(page)).toBeVisible();

  await page.setViewportSize({ width: 1000, height: 800 });
  await expect(sidebar(page)).toBeHidden();
  await expect(list(page)).toBeVisible();
  await expect(article(page)).toBeVisible();

  await page.setViewportSize({ width: 400, height: 800 });
  await expect(sidebar(page)).toBeVisible();
  await expect(list(page)).toBeHidden();
  await expect(article(page)).toBeHidden();
});

test("[ hides and shows the sidebar, and the toggle never moves", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  const before = await toggle(page).boundingBox();

  await page.keyboard.press("[");
  await expect(sidebar(page)).toBeHidden();
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  expect(await toggle(page).boundingBox()).toEqual(before);

  await page.keyboard.press("[");
  await expect(sidebar(page)).toBeVisible();
  expect(await toggle(page).boundingBox()).toEqual(before);

  // The button does the same with a click.
  await toggle(page).click();
  await expect(sidebar(page)).toBeHidden();
  expect(await toggle(page).boundingBox()).toEqual(before);
});

test("the sidebar lists Unread, Starred and All, with ink blue marking where you are", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  const links = sidebar(page).getByRole("list").getByRole("link");
  await expect(links).toHaveText(["Unread", "Starred", "All"]);

  const unread = sidebar(page).getByRole("link", { name: "Unread" });
  await expect(unread).toHaveAttribute("aria-current", "page");
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  expect(accent).toBe("#2f4a7a");
  await expect(unread).toHaveCSS("border-left-color", "rgb(47, 74, 122)");

  await sidebar(page).getByRole("link", { name: "Starred" }).click();
  await expect(page).toHaveURL(/\/starred$/);
  await expect(sidebar(page).getByRole("link", { name: "Starred" })).toHaveAttribute("aria-current", "page");
  await expect(unread).not.toHaveAttribute("aria-current", "page");
  await expect(page.getByText("No starred articles yet.")).toBeVisible();
});

test("g then u, s or a goes to Unread, Starred or All; reload and Back keep your place", async ({ page }) => {
  await openApp(page);
  await page.keyboard.press("g");
  await page.keyboard.press("s");
  await expect(page).toHaveURL(/\/starred$/);
  await expect(page.getByRole("heading", { level: 2, name: "Starred" })).toBeFocused();
  await expect(page).toHaveTitle("Starred · slowfeed");

  await page.keyboard.press("g");
  await page.keyboard.press("a");
  await expect(page).toHaveURL(/\/all$/);

  await page.reload();
  await appReady(page);
  await expect(page).toHaveTitle("All · slowfeed");
  await expect(page.getByRole("heading", { level: 2, name: "All" })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/starred$/);
  await expect(page.getByRole("heading", { level: 2, name: "Starred" })).toBeVisible();

  await page.keyboard.press("g");
  await page.keyboard.press("u");
  await expect(page).toHaveURL(/\/unread$/);
});

test("? opens the shortcut list, Escape closes it and returns the keyboard's place", async ({ page }) => {
  await openApp(page);
  const before = await page.evaluate(() => document.activeElement?.textContent?.trim());
  const sidebarShown = await sidebar(page).isVisible();
  await page.keyboard.press("?");
  const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Go to Unread / Starred / All")).toBeVisible();
  await expect(dialog.getByText("is:unread")).toBeVisible();

  // Shortcuts don't fire behind the open list.
  await page.keyboard.press("[");
  if (sidebarShown) await expect(sidebar(page)).toBeVisible();
  else await expect(sidebar(page)).toBeHidden();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe(before);
});

test("shortcuts don't fire while typing in a field", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  // No text fields exist yet, so add one the way later milestones will.
  await page.evaluate(() => {
    const field = document.createElement("input");
    field.setAttribute("aria-label", "Test field");
    document.querySelector("section")?.append(field);
  });
  await page.getByLabel("Test field").focus();
  await page.keyboard.type("[?gs");
  await expect(sidebar(page)).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page).toHaveURL(/\/unread$/);
});

test("Settings: theme, font, size and width apply at once and are remembered on this device", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  await tabTo(page, sidebar(page).getByRole("link", { name: "Settings" }));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { level: 2, name: "Settings" })).toBeFocused();

  await page.getByLabel("Sepia").check();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(243, 233, 210)");
  // The phone's bar above the page follows the chosen theme too, and
  // "Match this device" gives back index.html's light and dark colors.
  const bars = page.locator('meta[name="theme-color"]');
  await expect(bars).toHaveCount(2);
  await expect(bars.nth(0)).toHaveAttribute("content", "#F3E9D2");
  await expect(bars.nth(1)).toHaveAttribute("content", "#F3E9D2");
  await page.getByLabel("Match this device").check();
  await expect(bars.nth(0)).toHaveAttribute("content", "#F8F6F1");
  await expect(bars.nth(1)).toHaveAttribute("content", "#1C1B19");
  await page.getByLabel("Sepia").check();
  await expect(bars.nth(0)).toHaveAttribute("content", "#F3E9D2");
  // The chosen tile is filled and its word semibold, so it shows without color.
  await expect(page.locator("label.choice").filter({ hasText: "Sepia" })).toHaveCSS("font-weight", "600");
  await expect(page.locator("label.choice").filter({ hasText: "Dark" })).toHaveCSS("font-weight", "400");
  // Arrow keys move between choices, as with any radio buttons.
  await page.getByLabel("Sepia").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("Dark")).toBeChecked();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByLabel("Sepia")).toBeChecked();
  // In high-contrast mode the chosen tile takes the system's highlight, so it still stands out.
  await page.emulateMedia({ forcedColors: "active" });
  const tileColor = (name: string) =>
    page.locator("label.choice").filter({ hasText: name }).evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(await tileColor("Sepia")).not.toBe(await tileColor("Dark"));
  await page.emulateMedia({ forcedColors: "none" });

  const sample = page.locator(".reading-sample");
  await expect(sample).toHaveCSS("font-family", /^Literata/);
  await page.getByLabel("Atkinson Hyperlegible").check();
  await expect(sample).toHaveCSS("font-family", /^"Atkinson Hyperlegible"/);
  await page.getByLabel("Largest").check();
  await expect(sample).toHaveCSS("font-size", "28px");
  await page.getByLabel("Narrow").check();

  await page.reload();
  await appReady(page);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(243, 233, 210)");
  await expect(page.getByLabel("Sepia")).toBeChecked();
  await expect(page.getByLabel("Atkinson Hyperlegible")).toBeChecked();
  await expect(page.getByLabel("Largest")).toBeChecked();
  await expect(page.getByLabel("Narrow")).toBeChecked();

  // Escape closes Settings and returns to where you were.
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/unread$/);
});

test("a chosen theme stays, whatever the device's light or dark setting", async ({ page }) => {
  await chooseTheme(page, "sepia");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await appReady(page);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(243, 233, 210)");
});

test("at 200% zoom nothing overlaps and everything still works", async ({ page }) => {
  // 200% zoom on a 1280px-wide window leaves 640px of room.
  await page.setViewportSize({ width: 640, height: 400 });
  await openApp(page);
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(await overflow()).toBe(false);

  await page.keyboard.press("g");
  await page.keyboard.press("s");
  await expect(page.getByRole("heading", { level: 2, name: "Starred" })).toBeVisible();
  expect(await overflow()).toBe(false);

  // Escape goes back to the sidebar, the phone-narrow home screen.
  await page.keyboard.press("Escape");
  await expect(sidebar(page)).toBeVisible();
  await sidebar(page).getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Settings" })).toBeVisible();
  expect(await overflow()).toBe(false);
});

test("every font comes from slowfeed itself", async ({ page }) => {
  const fontOrigins: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "font") fontOrigins.push(new URL(request.url()).origin);
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page, "/settings");
  await page.getByLabel("Atkinson Hyperlegible").check();
  await page.evaluate(() => document.fonts.ready);
  const families = await page.evaluate(() =>
    [...document.fonts].filter((face) => face.status === "loaded").map((face) => face.family.replaceAll('"', "")),
  );
  expect(new Set(families)).toEqual(new Set(["Literata", "Inter", "Atkinson Hyperlegible"]));
  expect(new Set(fontOrigins)).toEqual(new Set([new URL(page.url()).origin]));
});

test("nothing scrolls underneath the Sidebar button or the shortcut hint", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 400 });
  await openApp(page, "/settings");
  // Settings is longer than this window, so it scrolls, but only inside its
  // own box, which starts below the band where the two buttons sit.
  const scroller = page.getByRole("region", { name: "Settings" }).locator("> div");
  expect(await scroller.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  const scrollingTop = (await scroller.boundingBox())!.y;
  for (const button of [toggle(page), page.getByRole("button", { name: "Press ? for shortcuts" })]) {
    if (!(await button.isVisible())) continue; // The hint is hidden on touch-only screens.
    const box = (await button.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(scrollingTop);
  }
});

test("'Press ? for shortcuts' stays on screen when the sidebar is hidden", async ({ page, isMobile }) => {
  test.skip(isMobile, "The hint is only for screens with a keyboard.");
  await page.setViewportSize({ width: 1000, height: 800 });
  await openApp(page);
  await expect(sidebar(page)).toBeHidden();
  const hint = page.getByRole("button", { name: "Press ? for shortcuts" });
  await expect(hint).toBeVisible();
  await hint.click();
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
});
