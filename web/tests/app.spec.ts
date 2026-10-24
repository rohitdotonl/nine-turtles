import { expect, test, type Locator, type Page } from "@playwright/test";
import { appReady, chooseTheme, signIn, tabTo } from "./screens";

// SPEC sections 4, 5, 18 and 19, "How to check it", done by a browser.

async function openApp(page: Page, path = "/unread") {
  await page.goto(path);
  await appReady(page);
  await signIn(page);
}

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });
const list = (page: Page) => page.getByRole("region", { name: /^(Unread|Starred|All)$/ });
// The reading area: an article, "No article open.", or the welcome on a slowfeed with no feeds.
const readingArea = (page: Page) => page.getByRole("region", { name: /^(Article|A quiet place to read\.)$/ });
const toggle = (page: Page) => page.getByRole("button", { name: "Sidebar" });

test("a wide window shows three areas, a medium one two, a phone-narrow one one", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  await expect(sidebar(page)).toBeVisible();
  await expect(list(page)).toBeVisible();
  await expect(readingArea(page)).toBeVisible();

  await page.setViewportSize({ width: 1000, height: 800 });
  await expect(sidebar(page)).toBeHidden();
  await expect(list(page)).toBeVisible();
  await expect(readingArea(page)).toBeVisible();

  await page.setViewportSize({ width: 400, height: 800 });
  await expect(sidebar(page)).toBeVisible();
  await expect(list(page)).toBeHidden();
  await expect(readingArea(page)).toBeHidden();
});

test("[ hides and shows the sidebar, and the toggle never moves", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  const before = await toggle(page).boundingBox();

  // The keyboard starts in the sidebar (on the wordmark). Hiding the sidebar moves it to the
  // list itself, or with no articles to the sidebar button, never to the list's title (decision 0038).
  await page.locator("#sidebar h1").focus();
  await page.keyboard.press("[");
  await expect(sidebar(page)).toBeHidden();
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  expect(await toggle(page).boundingBox()).toEqual(before);
  await expect(page.locator("#list-heading")).not.toBeFocused();
  expect(
    await page.evaluate(() => {
      const focused = document.activeElement;
      return focused?.getAttribute("aria-label") === "Sidebar" || focused?.closest("li") !== null;
    }),
  ).toBe(true);

  await page.keyboard.press("[");
  await expect(sidebar(page)).toBeVisible();
  expect(await toggle(page).boundingBox()).toEqual(before);

  // The button does the same with a click.
  await toggle(page).click();
  await expect(sidebar(page)).toBeHidden();
  expect(await toggle(page).boundingBox()).toEqual(before);
});

test("the sidebar lists Unread, Starred and All, with the accent marking where you are", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  const links = sidebar(page).getByRole("list").getByRole("link");
  await expect(links).toHaveText(["Unread", "Starred", "All"]);

  const unread = sidebar(page).getByRole("link", { name: "Unread" });
  await expect(unread).toHaveAttribute("aria-current", "page");
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  expect(accent).toBe("#2f4a7a");
  // One pill, as in the list: the accent mixed into the sidebar (off-white's
  // --tint-sidebar), 8px corners, 8px in from the pane's edge, and no bar.
  await expect(unread).toHaveCSS("background-color", "rgb(207, 206, 203)");
  await expect(unread).toHaveCSS("border-top-left-radius", "8px");
  // As in a Mac source list, the place you're in has its icon in the accent, beside the pill and the semibold name (decision 0043).
  await expect(unread.locator("svg")).toHaveCSS("color", "rgb(47, 74, 122)");
  await expect(sidebar(page).getByRole("link", { name: "Starred" }).locator("svg")).not.toHaveCSS("color", "rgb(47, 74, 122)");
  expect(await unread.evaluate((element) => getComputedStyle(element, "::before").content)).toBe("none");
  const inset = await unread.evaluate((element) => element.getBoundingClientRect().left - element.closest("nav")!.getBoundingClientRect().left);
  expect(Math.abs(inset - 8)).toBeLessThan(1);
  // The wordmark is a name, never a Tab stop (decision 0041).
  await expect(sidebar(page).getByRole("heading", { level: 1, name: "slowfeed" })).toHaveAttribute("tabindex", "-1");
  // When the app puts the keyboard there, its outline stands clear of the letters.
  const wordmark = sidebar(page).getByRole("heading", { level: 1, name: "slowfeed" });
  await page.keyboard.press("Shift");
  await page.evaluate(() => (document.documentElement.dataset.keyboard = ""));
  await wordmark.focus();
  await expect(wordmark).toHaveCSS("outline-offset", "3px");

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
  // The keyboard starts on the title, in the same serif as every title, with no ring: it can't be pressed (decision 0042).
  const heading = dialog.getByRole("heading", { level: 2, name: "Keyboard shortcuts" });
  await expect(heading).toBeFocused();
  await expect(heading).toHaveCSS("outline-style", "none");
  expect(await heading.evaluate((element) => getComputedStyle(element).fontFamily)).toContain("Literata");
  await expect(dialog.getByText("Go to Starred")).toBeVisible();
  // A two-press shortcut shows a key cap for each press, with "then" between.
  const goTo = dialog.getByRole("row", { name: /Go to Unread/ });
  await expect(goTo.locator("kbd")).toHaveText(["g", "u"]);
  // Four named groups, each a region a screen reader can jump to.
  for (const group of ["Moving around", "Reading", "Your articles", "Everywhere"]) {
    await expect(dialog.getByRole("region", { name: group })).toBeVisible();
  }
  // The list scrolls from the keyboard too: it's a Tab stop of its own, and a real one rings.
  const list = dialog.getByRole("region", { name: "Shortcuts" });
  await expect(list).toHaveAttribute("tabindex", "0");
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
  await expect(dialog.getByRole("button", { name: "Close" })).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Tab");
  await expect(list).toBeFocused();
  await expect(list).toHaveCSS("outline-style", "solid");
  // Only what works today is listed.
  await expect(dialog.getByText("Next / previous feed")).toHaveCount(0);
  await expect(dialog.getByText("is:unread")).toBeVisible();

  // Shortcuts don't fire behind the open list.
  await page.keyboard.press("[");
  if (sidebarShown) await expect(sidebar(page)).toBeVisible();
  else await expect(sidebar(page)).toBeHidden();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe(before);
});

test("the shortcut list fits a small phone without scrolling sideways", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openApp(page);
  await page.keyboard.press("?");
  const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(dialog).toBeVisible();
  const { scroll, client } = await dialog.evaluate((element) => ({ scroll: element.scrollWidth, client: element.clientWidth }));
  expect(scroll).toBeLessThanOrEqual(client);
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
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(244, 235, 215)");
  // The phone's bar above the page follows the chosen theme too, and
  // "Automatic" gives back index.html's light and dark colors.
  const bars = page.locator('meta[name="theme-color"]');
  await expect(bars).toHaveCount(2);
  await expect(bars.nth(0)).toHaveAttribute("content", "#F4EBD7");
  await expect(bars.nth(1)).toHaveAttribute("content", "#F4EBD7");
  await page.getByLabel("Automatic").check();
  await expect(bars.nth(0)).toHaveAttribute("content", "#F8F6F1");
  await expect(bars.nth(1)).toHaveAttribute("content", "#1A1917");
  await page.getByLabel("Sepia").check();
  await expect(bars.nth(0)).toHaveAttribute("content", "#F4EBD7");
  // Each theme is an "Aa" tile in its own paper and ink; the chosen one has two
  // marks, one ring and its name semibold, so it shows without color (decision 0045:
  // no checkmark badge, and no inner edge on the chosen page).
  const theme = (name: string) => page.locator("label.tile").filter({ hasText: name });
  await expect(theme("Sepia")).toHaveCSS("font-weight", "600");
  await expect(theme("Dark")).toHaveCSS("font-weight", "400");
  await expect(theme("Sepia").locator(".tile-page")).toHaveCSS("outline-style", "solid");
  await expect(page.locator(".tile-check")).toHaveCount(0);
  await expect(theme("Sepia").locator(".tile-page")).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
  await expect(theme("Dark").locator(".tile-page")).toHaveCSS("outline-style", "none");
  await expect(theme("Sepia").locator(".tile-page")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(theme("Sepia").locator(".tile-page > span").first()).toHaveCSS("background-color", "rgb(244, 235, 215)");
  const ring = (name: string) => theme(name).locator(".tile-page").evaluate((element) => getComputedStyle(element).outlineColor);
  expect(await ring("Sepia")).not.toBe(await ring("Dark"));
  // All eleven themes and Automatic, in tidy rows of equal tiles.
  await expect(page.locator("label.tile")).toHaveCount(12);
  const widths = await page.locator("label.tile .tile-page").evaluateAll((pages) => pages.map((each) => Math.round(each.getBoundingClientRect().width)));
  expect(new Set(widths).size).toBe(1);
  // Arrow keys move between choices, as with any radio buttons.
  await page.getByLabel("Sepia").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("Porcelain")).toBeChecked();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByLabel("Sepia")).toBeChecked();
  // In high-contrast mode the chosen picture is ringed in the system's highlight, so it still stands out.
  await page.emulateMedia({ forcedColors: "active" });
  expect(await ring("Sepia")).not.toBe(await ring("Dark"));
  await page.emulateMedia({ forcedColors: "none" });
  // Font and line width are segmented controls: the chosen one is raised (a fill and a small shadow, no edge) and semibold.
  await expect(page.locator("label.choice").filter({ hasText: "Medium" })).toHaveCSS("font-weight", "600");
  await expect(page.locator("label.choice").filter({ hasText: "Medium" })).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
  await expect(page.locator("label.choice").filter({ hasText: "Medium" })).not.toHaveCSS("box-shadow", "none");
  await expect(page.locator("label.choice").filter({ hasText: "Wide" })).toHaveCSS("font-weight", "400");
  // Each row's control sits at its right end, and every control is the same width.
  const look = page.getByRole("region", { name: "Look and feel" });
  const controls = await look.locator(".control").evaluateAll((all) => all.map((each) => Math.round(each.getBoundingClientRect().width)));
  expect(controls).toHaveLength(3);
  expect(new Set(controls).size).toBe(1);

  const sample = page.locator(".reading-sample");
  await expect(sample).toHaveCSS("font-family", /^Literata/);
  await page.getByLabel("Atkinson Hyperlegible").check();
  await expect(sample).toHaveCSS("font-family", /^"Atkinson Hyperlegible"/);
  // Text size is a stepper, as in the Aa panel: a small A and a large A, each its own round-ended
  // button, with the step's name between them as plain words on no track (decision 0045).
  const larger = look.getByRole("button", { name: "Larger text" });
  const [smallerBox, nameBox, largerBox] = await Promise.all([
    look.getByRole("button", { name: "Smaller text" }).boundingBox(),
    look.getByRole("status").boundingBox(),
    larger.boundingBox(),
  ]);
  expect(nameBox!.x).toBeGreaterThanOrEqual(smallerBox!.x + smallerBox!.width);
  expect(nameBox!.x + nameBox!.width).toBeLessThanOrEqual(largerBox!.x);
  await expect(look.getByRole("status")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(larger).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  expect(largerBox!.x - (smallerBox!.x + smallerBox!.width)).toBeGreaterThan(80);
  for (let step = 0; step < 3; step++) await larger.click();
  await expect(look.getByRole("status")).toHaveText("Largest");
  await expect(larger).toHaveAttribute("aria-disabled", "true");
  await expect(sample).toHaveCSS("font-size", "28px");
  await page.getByLabel("Narrow").check();

  await page.reload();
  await appReady(page);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(244, 235, 215)");
  await expect(page.getByLabel("Sepia")).toBeChecked();
  await expect(page.getByLabel("Atkinson Hyperlegible")).toBeChecked();
  await expect(page.getByRole("region", { name: "Look and feel" }).getByRole("status")).toHaveText("Largest");
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
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(244, 235, 215)");
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

test("nothing scrolls underneath the Sidebar button", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 400 });
  await openApp(page, "/settings");
  // Settings is longer than this window, so it scrolls, but only inside its
  // own box, which starts below the band where the Sidebar button sits.
  const scroller = page.getByRole("region", { name: "Settings" }).locator(".overflow-y-auto");
  expect(await scroller.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  const scrollingTop = (await scroller.boundingBox())!.y;
  if (await toggle(page).isVisible()) {
    const box = (await toggle(page).boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(scrollingTop);
  }
  // A faint line appears under the top line only once something has scrolled under it.
  await expect(scroller).not.toHaveAttribute("data-scrolled");
  await scroller.evaluate((element) => element.scrollBy(0, 200));
  await expect(scroller).toHaveAttribute("data-scrolled", "");
  await scroller.evaluate((element) => element.scrollTo(0, 0));
  await expect(scroller).not.toHaveAttribute("data-scrolled");
});

test("Add a feed opens as a sheet over the list you were on: a serif title, one row of actions, and Escape or a press outside closes it", async ({ page, isMobile }) => {
  test.skip(isMobile, "on a phone, Add a feed is a screen of its own");
  await openApp(page);
  await page.keyboard.press("a");
  const sheet = page.getByRole("dialog", { name: "Add a feed" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel("Paste a website or feed URL")).toBeFocused();
  // Every title speaks in one voice: the sheet's is the same serif, size and weight as the list's (decision 0042).
  const heading = sheet.getByRole("heading", { level: 2, name: "Add a feed" });
  expect(await heading.evaluate((element) => getComputedStyle(element).fontFamily)).toContain("Literata");
  await expect(heading).toHaveCSS("font-size", "24px");
  await expect(heading).toHaveCSS("font-weight", "600");
  // The field takes the full width; Cancel, then Add feed at the right end, in one row at the foot.
  const [field, cancel, add, card] = await Promise.all([
    sheet.getByLabel("Paste a website or feed URL").boundingBox(),
    sheet.getByRole("button", { name: "Cancel" }).boundingBox(),
    sheet.getByRole("button", { name: "Add feed" }).boundingBox(),
    sheet.boundingBox(),
  ]);
  expect(field!.width).toBeGreaterThan(card!.width - 2 * 24 - 4);
  expect(Math.abs(cancel!.y - add!.y)).toBeLessThan(2);
  expect(cancel!.x + cancel!.width).toBeLessThanOrEqual(add!.x);
  expect(add!.y).toBeGreaterThan(field!.y + field!.height);
  expect(Math.abs(card!.x + card!.width - 24 - (add!.x + add!.width))).toBeLessThan(2);
  // 20px of room above the row and 12px between its buttons; Cancel has no edge, so only Add feed has weight.
  expect(Math.round(add!.y - (field!.y + field!.height))).toBe(20);
  expect(Math.round(add!.x - (cancel!.x + cancel!.width))).toBe(12);
  await expect(sheet.getByRole("button", { name: "Cancel" })).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
  // The list stays in view behind it, and nothing behind it answers the keyboard.
  await expect(page.locator("#list-heading")).toBeVisible();
  // No X: Escape is the way out, and so is a press on the dimmed page.
  await expect(sheet.getByRole("button", { name: "Close" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await page.keyboard.press("a");
  await expect(sheet).toBeVisible();
  await page.mouse.click(5, 400);
  await expect(sheet).toHaveCount(0);
  // Cancel closes it too, and a message appearing in it doesn't move it.
  await page.keyboard.press("a");
  const top = (await sheet.boundingBox())!.y;
  await sheet.getByLabel("Paste a website or feed URL").fill("nonsense");
  await page.keyboard.press("Enter");
  await expect(sheet.locator("#feed-address-status")).not.toBeEmpty();
  expect((await sheet.boundingBox())!.y).toBe(top);
  await sheet.getByRole("button", { name: "Cancel" }).click();
  await expect(sheet).toHaveCount(0);
  // Add feed is an action, so it never shows the "where you are" bar.
  await expect(sidebar(page).getByRole("link", { name: "Add feed" })).not.toHaveAttribute("aria-current");
});

test("the chrome never advertises shortcuts: no hint under the list, with the sidebar shown or hidden; ? still opens them", async ({ page, isMobile }) => {
  test.skip(isMobile, "Shortcuts are for screens with a keyboard.");
  // Medium: the sidebar starts hidden. Wide: it shows, with its keyboard icon at its foot (decision 0041).
  await page.setViewportSize({ width: 1000, height: 800 });
  await openApp(page);
  await expect(sidebar(page)).toBeHidden();
  await expect(page.getByText("Press ? for shortcuts")).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 800 });
  await expect(sidebar(page)).toBeVisible();
  await expect(page.getByText("Press ? for shortcuts")).toHaveCount(0);
  await expect(sidebar(page).getByRole("button", { name: "Keyboard shortcuts" })).toBeVisible();
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
});

test("the sidebar ends with Add feed, then the shortcut list and Settings as icons; its toggle says what it does", async ({ page, isMobile }) => {
  test.skip(isMobile, "The phone has its own screens and no sidebar toggle.");
  await page.setViewportSize({ width: 1440, height: 900 });
  await openApp(page);
  const box = async (locator: Locator) => (await locator.boundingBox())!;
  const add = await box(sidebar(page).getByRole("link", { name: "Add feed" }));
  const keys = sidebar(page).getByRole("button", { name: "Keyboard shortcuts" });
  const settings = sidebar(page).getByRole("link", { name: "Settings" });
  const all = await box(sidebar(page).getByRole("link", { name: "All" }));
  // One row at the foot of the window, below everything else in the sidebar.
  const [k, set] = [await box(keys), await box(settings)];
  for (const each of [k, set]) {
    expect(Math.abs(each.y + each.height / 2 - (add.y + add.height / 2))).toBeLessThan(2);
    expect(Math.min(each.width, each.height)).toBeGreaterThanOrEqual(44);
  }
  expect(add.x + add.width).toBeLessThanOrEqual(k.x + 1);
  expect(k.x + k.width).toBeLessThanOrEqual(set.x + 1);
  expect(add.y).toBeGreaterThan(all.y);
  expect(set.y + set.height).toBeLessThanOrEqual(900);
  await expect(settings).toHaveAttribute("title", "Settings");
  await keys.click();
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(toggle(page)).toHaveAttribute("title", "Hide the sidebar ( [ )");
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute("title", "Show the sidebar ( [ )");
});

test("Settings is one centred column of grouped lists; Your data and Sign out are rows of their own, each ending in a glyph", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openApp(page, "/settings");
  // Each group has a small header above it; the groups share one column, no wider than 560px.
  const groups = page.getByRole("region", { name: "Settings" }).locator(".inset-group");
  await expect(groups).toHaveCount(4);
  const boxes = await groups.evaluateAll((all) => all.map((each) => each.getBoundingClientRect()).map((box) => [Math.round(box.x), Math.round(box.width)]));
  for (const [x, width] of boxes) expect([x, width]).toEqual(boxes[0]);
  expect(boxes[0]![1]).toBeLessThanOrEqual(560);
  for (const name of ["Reading", "Look and feel", "Your data", "Account"]) {
    await expect(page.getByRole("heading", { level: 3, name })).toBeVisible();
  }
  // The data actions are full-width rows, at least 44px tall, in the text color (the accent means only "where you are").
  const rows = [
    page.getByRole("button", { name: "Import OPML" }),
    page.getByRole("link", { name: "Export OPML" }),
    page.getByRole("link", { name: "Export starred articles" }),
    page.getByRole("button", { name: "Sign out" }),
  ];
  const ink = await page.locator("body").evaluate((body) => getComputedStyle(body).color);
  for (const row of rows) {
    const box = (await row.boundingBox())!;
    expect(Math.round(box.width)).toBe(boxes[0]![1]);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(await row.evaluate((element) => getComputedStyle(element).color)).toBe(ink);
    // A quiet glyph at its right end says it acts (› opens, a tray saves a file, a door signs out), never the accent (decision 0042).
    const glyph = (await row.locator(".row-glyph").boundingBox())!;
    expect(box.x + box.width - (glyph.x + glyph.width)).toBeLessThan(20);
  }
  // Import opens something, so it ends in "…"; Sign out removes nothing, so it isn't in the destructive red.
  await expect(rows[0]!).toHaveText("Import OPML…");
  // The preview passage sits on the page under "Look and feel", not in a card inside a card.
  expect(await page.locator(".reading-sample").evaluate((element) => element.closest(".inset-group"))).toBeNull();
});
