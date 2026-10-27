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
// The reading area: an article, "Time to read something beautiful.", or the welcome on a nine turtles with no feeds.
const readingArea = (page: Page) => page.getByRole("region", { name: /^(Article|A quiet place to read\.)$/ });
const toggle = (page: Page) => page.getByRole("button", { name: "Sidebar" });

test("a wide window shows three areas, a medium one two, a phone-narrow one one", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  // Starred: with no feeds yet, Unread and All show one welcome in place of the list and the
  // reading area together (decision 0048); Starred keeps its own list.
  await openApp(page, "/starred");
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

test("[ hides and shows the sidebar; its button sits on the sidebar, then waits at the top left", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  const shown = (await toggle(page).boundingBox())!;
  const pane = (await sidebar(page).boundingBox())!;
  // At the right end of the sidebar's own top line, across from the wordmark.
  expect(shown.x + shown.width).toBeLessThanOrEqual(pane.x + pane.width);
  expect(shown.x).toBeGreaterThan(pane.x + pane.width / 2);

  // The keyboard starts in the sidebar (on the wordmark). Hiding the sidebar moves it to the
  // list itself, or with no articles to the sidebar button, never to the list's title (decision 0038).
  await page.locator("#sidebar h1").focus();
  await page.keyboard.press("[");
  await expect(sidebar(page)).toBeHidden();
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  expect((await toggle(page).boundingBox())!.x).toBeLessThan(20);
  await expect(page.locator("#list-heading")).not.toBeFocused();
  expect(
    await page.evaluate(() => {
      const focused = document.activeElement;
      return focused?.getAttribute("aria-label") === "Sidebar" || focused?.closest("li") !== null;
    }),
  ).toBe(true);

  await page.keyboard.press("[");
  await expect(sidebar(page)).toBeVisible();
  expect(await toggle(page).boundingBox()).toEqual(shown);

  // The button does the same with a click.
  await toggle(page).click();
  await expect(sidebar(page)).toBeHidden();
});


test("the sidebar lists Unread, Starred and All, with a grey pill marking where you are", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  const links = sidebar(page).getByRole("list").getByRole("link");
  await expect(links).toHaveText(["Unread", "Starred", "All"]);

  const unread = sidebar(page).getByRole("link", { name: "Unread" });
  await expect(unread).toHaveAttribute("aria-current", "page");
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  expect(accent).toBe("#2c4f8c");
  // One pill, as in the list: a neutral grey, the text color at 8% over the sidebar
  // (--tint-sidebar), 8px corners, 8px in from the pane's edge, with no color and
  // no bar (decision 0057).
  await expect(unread).toHaveCSS("background-color", "rgb(221, 221, 223)");
  expect(await unread.evaluate((element) => getComputedStyle(element, "::before").content)).toBe("none");
  await expect(unread).toHaveCSS("border-top-left-radius", "8px");
  // The place you're in has its icon in full ink, beside the pill and the semibold name; never the accent (decision 0057).
  await expect(unread.locator("svg")).toHaveCSS("color", "rgb(20, 20, 20)");
  await expect(sidebar(page).getByRole("link", { name: "Starred" }).locator("svg")).not.toHaveCSS("color", "rgb(20, 20, 20)");
  const inset = await unread.evaluate((element) => element.getBoundingClientRect().left - element.closest("nav")!.getBoundingClientRect().left);
  expect(Math.abs(inset - 8)).toBeLessThan(1);
  // The wordmark is a name, never a Tab stop (decision 0041).
  await expect(sidebar(page).getByRole("heading", { level: 1, name: "nine turtles" })).toHaveAttribute("tabindex", "-1");
  // When the app puts the keyboard there, its outline stands clear of the letters.
  const wordmark = sidebar(page).getByRole("heading", { level: 1, name: "nine turtles" });
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
  await expect(page).toHaveTitle("Starred · nine turtles");

  await page.keyboard.press("g");
  await page.keyboard.press("a");
  await expect(page).toHaveURL(/\/all$/);

  await page.reload();
  await appReady(page);
  await expect(page).toHaveTitle("All · nine turtles");
  // With no feeds yet, a wide window shows the welcome in the list's room (decision 0048); the list keeps its place behind it.
  await expect(page.locator("#list-heading")).toHaveText("All");

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
  // A two-press shortcut shows a key cap for each press, with "then" between, in capitals as a Mac prints keys (decision 0055).
  const goTo = dialog.getByRole("row", { name: /Go to Unread/ });
  await expect(goTo.locator("kbd")).toHaveText(["G", "U"]);
  // Shift shows as ⇧ on the cap, and screen readers hear "Shift A".
  const markAll = dialog.getByRole("row", { name: /Mark all as read/ });
  await expect(markAll.locator("kbd")).toHaveText(["⇧A"]);
  await expect(markAll).toHaveAccessibleName(/Shift A/);
  // Four named groups, each a region a screen reader can jump to.
  for (const group of ["Reading", "Getting around", "Tidying up", "Anywhere"]) {
    await expect(dialog.getByRole("region", { name: group })).toBeVisible();
  }
  // The list scrolls from the keyboard too: it's a Tab stop of its own, and a real one rings.
  const list = dialog.getByRole("region", { name: "Shortcuts" });
  await expect(list).toHaveAttribute("tabindex", "0");
  // Tab goes on to the find field, then Close, then the list.
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("searchbox", { name: "Find a shortcut" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
  await expect(dialog.getByRole("button", { name: "Close" })).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Tab");
  await expect(list).toBeFocused();
  await expect(list).toHaveCSS("outline-style", "solid");
  // Only what works today is listed.
  await expect(dialog.getByText("Next / previous feed")).toHaveCount(0);
  await expect(dialog.getByText("is:unread")).toBeVisible();

  // Shortcuts don't fire behind the open list: a key typed there finds itself in the list instead (decision 0062).
  await page.keyboard.press("[");
  if (sidebarShown) await expect(sidebar(page)).toBeVisible();
  else await expect(sidebar(page)).toBeHidden();
  await expect(dialog.getByRole("searchbox", { name: "Find a shortcut" })).toHaveValue("[");
  await expect(dialog.getByRole("row")).toHaveText([/Show \/ hide sidebar/]);

  // Escape empties the find field first, then closes the list.
  await page.keyboard.press("Escape");
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
  // On a phone it's a screen of its own, as every sheet is there: nothing behind it shows past its edge (decision 0049).
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBe(0);
  expect(box.y).toBe(0);
  expect(box.width).toBe(320);
  expect(box.height).toBe(640);
  await expect(dialog).toHaveCSS("border-top-left-radius", "0px");
  // The find field takes a line of its own under the title and the X, the screen's full width less its margins (decision 0062).
  const [heading, field, close] = await Promise.all([
    dialog.getByRole("heading", { name: "Keyboard shortcuts" }).boundingBox(),
    dialog.getByRole("searchbox", { name: "Find a shortcut" }).boundingBox(),
    dialog.getByRole("button", { name: "Close" }).boundingBox(),
  ]);
  expect(field!.y).toBeGreaterThanOrEqual(heading!.y + heading!.height);
  expect(field!.y).toBeGreaterThanOrEqual(close!.y + close!.height - 1);
  expect(field!.width).toBeGreaterThan(260);
});

test("on a desktop window the shortcut list fits without scrolling, at least 48px clear of the window's top and foot", async ({ page, isMobile }) => {
  test.skip(isMobile, "on a phone it's a screen of its own");
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  await page.keyboard.press("?");
  const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(48);
  expect(800 - (box.y + box.height)).toBeGreaterThanOrEqual(48);
  // The search filters sit in the right-hand column, under Anywhere, and the whole list shows.
  const [everywhere, filters] = [
    (await dialog.getByRole("region", { name: "Anywhere" }).boundingBox())!,
    (await dialog.getByRole("region", { name: "Search filters" }).boundingBox())!,
  ];
  expect(Math.abs(filters.x - everywhere.x)).toBeLessThan(1);
  expect(filters.y).toBeGreaterThan(everywhere.y);
  const list = dialog.getByRole("region", { name: "Shortcuts" });
  expect(await list.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
});

test("shortcuts don't fire while typing in a field", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  // No text fields exist yet, so add one the way later milestones will.
  await page.evaluate(() => {
    const field = document.createElement("input");
    field.setAttribute("aria-label", "Test field");
    document.querySelector("main")?.append(field);
  });
  await page.getByLabel("Test field").focus();
  await page.keyboard.type("[?gs");
  await expect(sidebar(page)).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page).toHaveURL(/\/unread$/);
});

test("Settings: appearance, font, size and width apply at once and are remembered on this device", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  await tabTo(page, sidebar(page).getByRole("link", { name: "Settings" }));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { level: 2, name: "Settings" })).toBeFocused();

  // Original, matching the device until another Appearance is chosen (decision 0056); Plain is the other theme (decision 0063).
  await expect(page.locator("label.tile")).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Theme" }).getByRole("radio")).toHaveCount(2);
  await expect(page.getByRole("radio", { name: "Original" })).toBeChecked();
  await expect(page.getByLabel("Match device")).toBeChecked();
  await page.getByLabel("Light", { exact: true }).check();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  // The phone's bar above the page follows the version showing too.
  const bars = page.locator('meta[name="theme-color"]');
  await expect(bars).toHaveCount(2);
  await expect(bars.nth(0)).toHaveAttribute("content", "#FFFFFF");
  await expect(bars.nth(1)).toHaveAttribute("content", "#FFFFFF");
  // Appearance: Dark shows the night version.
  await page.getByLabel("Dark", { exact: true }).check();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(18, 18, 18)");
  await expect(bars.nth(0)).toHaveAttribute("content", "#121212");
  // Match device follows the device, and switches with it while nine turtles is open.
  await page.getByLabel("Match device").check();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(18, 18, 18)");
  await expect(bars.nth(1)).toHaveAttribute("content", "#121212");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  // Arrow keys move between choices, as with any radio buttons.
  await page.getByLabel("Light", { exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("Dark", { exact: true })).toBeChecked();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByLabel("Light", { exact: true })).toBeChecked();
  // Font and line width are segmented controls: the chosen one is raised (a fill and a small shadow, no edge) and semibold.
  await expect(page.locator("label.choice").filter({ hasText: "Medium" })).toHaveCSS("font-weight", "600");
  await expect(page.locator("label.choice").filter({ hasText: "Medium" })).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
  await expect(page.locator("label.choice").filter({ hasText: "Medium" })).not.toHaveCSS("box-shadow", "none");
  await expect(page.locator("label.choice").filter({ hasText: "Wide" })).toHaveCSS("font-weight", "400");
  // Each row's control sits at its right end, and every control is the same width.
  const look = page.getByRole("region", { name: "Look and feel" });
  const controls = await look.locator(".control").evaluateAll((all) => all.map((each) => Math.round(each.getBoundingClientRect().width)));
  expect(controls).toHaveLength(5);
  expect(new Set(controls).size).toBe(1);

  const sample = page.locator(".reading-sample");
  await expect(sample).toHaveCSS("font-family", /^Literata/);
  // rohit.onl's font, the device's own serif (decision 0063).
  await page.getByLabel("System serif").check();
  await expect(sample).toHaveCSS("font-family", /^ui-serif/);
  await page.getByLabel("Atkinson Hyperlegible").check();
  await expect(sample).toHaveCSS("font-family", /^"Atkinson Hyperlegible"/);
  // Plain: rohit.onl's bare look, black on white by day, and back to Original (decision 0063).
  await page.getByRole("radio", { name: "Plain" }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "plain");
  await expect(page.locator("body")).toHaveCSS("color", "rgb(0, 0, 0)");
  await page.getByRole("radio", { name: "Original" }).check();
  await expect(page.locator("body")).toHaveCSS("color", "rgb(20, 20, 20)");
  // Text size is a stepper, as in the Aa panel: one flat capsule, a small A and a large A at its ends
  // and the step's name between them, parted by hairlines, nothing raised, so it never reads as a
  // chosen segment (decision 0055).
  const larger = look.getByRole("button", { name: "Larger text" });
  const [smallerBox, nameBox, largerBox] = await Promise.all([
    look.getByRole("button", { name: "Smaller text" }).boundingBox(),
    look.getByRole("status").boundingBox(),
    larger.boundingBox(),
  ]);
  expect(nameBox!.x).toBeGreaterThanOrEqual(smallerBox!.x + smallerBox!.width);
  expect(nameBox!.x + nameBox!.width).toBeLessThanOrEqual(largerBox!.x);
  await expect(look.getByRole("status")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(look.locator(".sizes")).toHaveCSS("border-radius", "10px");
  await expect(larger).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(larger).toHaveCSS("box-shadow", "none");
  await expect(larger).not.toHaveCSS("border-left-color", "rgba(0, 0, 0, 0)");
  expect(largerBox!.x - (smallerBox!.x + smallerBox!.width)).toBeGreaterThan(80);
  for (let step = 0; step < 3; step++) await larger.click();
  await expect(look.getByRole("status")).toHaveText("Largest");
  await expect(larger).toHaveAttribute("aria-disabled", "true");
  await expect(sample).toHaveCSS("font-size", "28px");
  await page.getByLabel("Narrow").check();

  await page.reload();
  await appReady(page);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.getByLabel("Light", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Atkinson Hyperlegible")).toBeChecked();
  await expect(page.getByRole("region", { name: "Look and feel" }).getByRole("status")).toHaveText("Largest");
  await expect(page.getByLabel("Narrow")).toBeChecked();

  // Escape closes Settings and returns to where you were.
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/unread$/);
});

test("a chosen Appearance stays, whatever the device's light or dark setting", async ({ page }) => {
  await chooseTheme(page, "original-light");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await appReady(page);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
});

test("a removed theme opens as Original, keeping its Appearance (decision 0056)", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("slowfeed.preferences", JSON.stringify({ theme: "calm", appearance: "dark" })));
  await page.goto("/");
  await appReady(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "original");
  await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
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

test("every font comes from nine turtles itself", async ({ page }) => {
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
  // The page stays in view behind it (here, with no feeds yet, the welcome, which keeps its shape), and nothing behind it answers the keyboard.
  await expect(page.locator("#welcome-heading")).toBeVisible();
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

test("the shortcut list finds a shortcut by its words or its key, and a letter typed anywhere in it starts the find (decision 0062)", async ({ page, isMobile }) => {
  test.skip(isMobile, "Shortcuts are for screens with a keyboard.");
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  await page.keyboard.press("?");
  const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  const field = dialog.getByRole("searchbox", { name: "Find a shortcut" });
  await expect(field).toBeVisible();
  // The keyboard starts on the title; typing a letter takes it to the field, letter and all.
  await page.keyboard.type("star");
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("star");
  await expect(dialog.getByRole("row")).toHaveText([/Star \/ unstar/, /Go to Starred/, /is:starred/]);
  await expect(dialog.getByRole("region", { name: "Tidying up" })).toHaveCount(0);
  // By its key, as printed or with a space between two presses.
  await field.fill("g u");
  await expect(dialog.getByRole("row")).toHaveText([/Go to Unread/]);
  await field.fill("shift a");
  await expect(dialog.getByRole("row")).toHaveText([/Mark all as read/]);
  await field.fill("zebra");
  await expect(dialog.getByText("No shortcut matches “zebra”.")).toBeVisible();
  await expect(dialog.getByRole("row")).toHaveCount(0);
  // Escape empties the field first, even with the keyboard elsewhere in the list, then closes the list; opened again, it starts whole.
  await field.fill("star");
  await dialog.getByRole("button", { name: "Close" }).focus();
  await page.keyboard.press("Escape");
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("");
  await field.fill("zebra");
  await page.keyboard.press("Escape");
  await expect(field).toHaveValue("");
  await expect(dialog.getByRole("region", { name: "Tidying up" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("on a computer a 1px line parts the sidebar, the list and the reading pane (decision 0054)", async ({ page, isMobile }) => {
  test.skip(isMobile, "A phone shows one pane at a time, with no line.");
  await page.setViewportSize({ width: 1440, height: 900 });
  await openApp(page);
  await expect(page.locator("#sidebar")).toHaveCSS("border-right-width", "1px");
  await expect(page.locator(".list-pane")).toHaveCSS("border-right-width", "1px");
});

test("the sidebar ends with Add feed, then Keys (icon and word) and Settings as an icon; its toggle says what it does", async ({ page, isMobile }) => {
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
  // Keys says what it is in a word beside its icon, as Add feed does, and both show whole (decisions 0062, 0064).
  await expect(keys).toContainText("Keys");
  await expect(keys.locator("svg")).toHaveCount(1);
  for (const each of [sidebar(page).getByRole("link", { name: "Add feed" }), keys]) {
    expect(await each.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  expect(k.x + k.width).toBeLessThanOrEqual(set.x + 1);
  expect(add.y).toBeGreaterThan(all.y);
  expect(set.y + set.height).toBeLessThanOrEqual(900);
  await expect(settings).toHaveAttribute("title", "Settings");
  // While the shortcut list is open its button is filled and says its dialog is open (decision 0054).
  // (Found by its label, not its role: the open list's dialog leaves the page behind it inert.)
  const keysBehind = page.locator('#sidebar button[aria-label="Keys (keyboard shortcuts)"]');
  await expect(keysBehind).toHaveAttribute("aria-haspopup", "dialog");
  await expect(keysBehind).toHaveAttribute("aria-expanded", "false");
  const restingFill = await keysBehind.evaluate((element) => getComputedStyle(element).backgroundColor);
  await keys.click();
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  await expect(keysBehind).toHaveAttribute("aria-expanded", "true");
  expect(await keysBehind.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(restingFill);
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(keysBehind).toHaveAttribute("aria-expanded", "false");
  await expect(toggle(page)).toHaveAttribute("title", "Hide the sidebar ( [ )");
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute("title", "Show the sidebar ( [ )");
});

test("in a sidebar narrowed below 15rem, Keys keeps only its icon and stays a full-size button", async ({ page, isMobile }) => {
  test.skip(isMobile, "The phone has no sidebar to narrow.");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem("nine-turtles.sidebar-width", "200"));
  await openApp(page);
  const keys = sidebar(page).getByRole("button", { name: "Keys (keyboard shortcuts)" });
  await expect(keys.locator("svg")).toBeVisible();
  await expect(keys.getByText("Keys")).toBeHidden();
  const box = (await keys.boundingBox())!;
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  const add = sidebar(page).getByRole("link", { name: "Add feed" });
  expect(await add.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test("Other apps: an app password is made, shown once with the server address, and turned off", async ({ page }) => {
  await openApp(page, "/settings");
  // With the keyboard alone: the pressed row is replaced, so the keyboard moves to the new password's Copy.
  // Until the server says whether other apps are on, the row is unavailable
  // (aria-disabled) and a press does nothing; a keyboard user hears that too.
  const makeFirst = page.getByRole("button", { name: "Make an app password" });
  await expect(makeFirst).toHaveAttribute("aria-disabled", "false");
  await makeFirst.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Copy app password" })).toBeFocused();
  const status = page.getByRole("status").filter({ hasText: "app password is ready" });
  await expect(status).toBeVisible();
  await expect(page.getByText(/\/api\/greader$/)).toBeVisible();
  await expect(page.getByText(/^[a-z2-9]{4}(-[a-z2-9]{4}){5}$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy app password" })).toBeVisible();
  await page.getByRole("button", { name: "Turn off other apps" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Other apps are off" })).toBeVisible();
  // …and back to Make an app password when that row returns.
  await expect(page.getByRole("button", { name: "Make an app password" })).toBeFocused();
  await expect(page.getByText(/^[a-z2-9]{4}(-[a-z2-9]{4}){5}$/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Make an app password" })).toBeVisible();
});

test("Newsletters: the reader's address with Copy, a label's switch, and New address with Undo", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "both runs share one reader, and so one address");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await openApp(page, "/settings");
  const address = page.getByText(/^turtle-[a-z2-9]{8}@in\.nineturtles\.app$/);
  await expect(address).toBeVisible();
  const old = (await address.textContent())!;

  // An email to a label lists it, with a switch that turns its email away.
  const [name, domain] = old.split("@");
  const cooking = `${name}+cooking@${domain}`;
  const posted = await page.request.post("/newsletters/incoming", {
    headers: {
      authorization: "Bearer a-made-up-newsletter-secret-for-the-browser-tests",
      "content-type": "message/rfc822",
      "x-nine-turtles-to": cooking,
    },
    data: `From: Kitchen <kitchen@example.com>\r\nTo: ${cooking}\r\nSubject: Soup\r\nMessage-ID: <soup@example.com>\r\nContent-Type: text/html\r\n\r\n<p>Soup.</p>\r\n`,
  });
  expect(posted.status()).toBe(200);
  await page.reload();
  const label = page.getByRole("switch", { name: `Takes email: ${cooking}` });
  await expect(label).toBeChecked();
  // From the keyboard alone: Space flips the switch.
  await label.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("status").filter({ hasText: `Email to ${cooking} is now turned away` })).toBeVisible();
  await page.reload();
  await expect(label).not.toBeChecked();
  await label.click();
  await expect(label).toBeChecked();
  // The email made a feed; unsubscribing leaves the reader as the other tests expect (a fresh nine turtles).
  const feeds = await (await page.request.get("/api/feeds")).json();
  const kitchen = feeds.feeds.find((feed: { title: string }) => feed.title === "Kitchen");
  expect((await page.request.post(`/api/feeds/${kitchen.id}/unsubscribe`, { data: {} })).ok()).toBe(true);

  await expect(page.getByRole("button", { name: "Copy address" })).toBeVisible();
  await page.getByRole("button", { name: "New address" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "You have a new address" })).toBeVisible();
  await expect(address).not.toHaveText(old);
  await expect(label).toHaveCount(0);
  // Copying the new address keeps Undo on the line.
  await page.getByRole("button", { name: "Copy address" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Address copied" })).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your old address works again" })).toBeVisible();
  await expect(address).toHaveText(old);
  await expect(label).toBeChecked();
});

test("Settings is one centred column of grouped lists; Your data, Feed health and Sign out are rows of their own, each ending in a glyph", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openApp(page, "/settings");
  // Each group has a small header above it; the groups share one column, no wider than 560px. The owner also sees Readers and Sign-up (decision 0087).
  const groups = page.getByRole("region", { name: "Settings" }).locator(".inset-group");
  await expect(groups).toHaveCount(11);
  const boxes = await groups.evaluateAll((all) => all.map((each) => each.getBoundingClientRect()).map((box) => [Math.round(box.x), Math.round(box.width)]));
  for (const [x, width] of boxes) expect([x, width]).toEqual(boxes[0]);
  expect(boxes[0]![1]).toBeLessThanOrEqual(560);
  for (const name of ["Reading", "Look and feel", "Your data", "Feeds", "Add from anywhere", "Rules", "Newsletters", "Other apps", "Readers", "Sign-up", "Account"]) {
    await expect(page.getByRole("heading", { level: 3, name })).toBeVisible();
  }
  // The data actions are full-width rows, at least 44px tall, in the text color (the accent means only "where you are").
  const rows = [
    page.getByRole("button", { name: "Import OPML" }),
    page.getByRole("link", { name: "Export OPML" }),
    page.getByRole("button", { name: "Import starred articles" }),
    page.getByRole("link", { name: "Export starred articles" }),
    page.getByRole("link", { name: "Your feeds" }),
    page.getByRole("link", { name: "Feed health" }),
    page.getByRole("button", { name: "Make an app password" }),
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
  // The preview passage is the first row of the "Look and feel" group, its words on the rows' words (decision 0055).
  const sampleRow = page.locator(".reading-sample");
  expect(await sampleRow.evaluate((element) => element.closest(".inset-group") !== null && element.parentElement?.firstElementChild === element)).toBe(true);
  const [sampleText, appearanceName] = await Promise.all([sampleRow.locator("p").boundingBox(), page.getByText("Appearance", { exact: true }).boundingBox()]);
  expect(Math.abs(sampleText!.x - appearanceName!.x)).toBeLessThan(1.5);
});

/** Makes the server's answers to /api/session say a newer version is live, then brings the tab back into view. */
async function newerVersionLive(page: Page) {
  await page.route("**/api/session", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), "x-nine-turtles-version": "a-newer-one" } });
  });
  const asked = page.waitForResponse((response) => response.url().endsWith("/api/session"));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await asked;
  await page.unroute("**/api/session");
}

/** Marks this page, so a test can tell whether the next move loaded a fresh one. */
async function markPage(page: Page): Promise<() => Promise<boolean>> {
  await page.evaluate(() => Object.assign(window, { stillHere: true }));
  // While the next page is loading there's nothing to ask yet: count that as still here, and ask again.
  return () => page.evaluate(() => "stillHere" in window).catch(() => true);
}

test("a tab left open across an update opens the new version at the next place it goes", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same on every width; Back on a phone is tested below");
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page, "/starred");
  let samePage = await markPage(page);

  // No newer version yet: going somewhere stays in the same page.
  await sidebar(page).getByRole("link", { name: /^All/ }).click();
  await expect(page).toHaveURL(/\/all$/);
  expect(await samePage()).toBe(true);

  // A newer version goes live. The tab notices when it comes back into view.
  await newerVersionLive(page);

  // Going to another place loads the new version there, with the keyboard's place on its heading.
  await page.keyboard.press("Shift"); // the keyboard is in use
  await sidebar(page).getByRole("link", { name: /^Starred/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/starred$/);
  await appReady(page);
  await expect.poll(samePage).toBe(false);
  await expect(page.getByRole("heading", { name: "Starred", level: 2 })).toBeFocused();

  // The screen stays as the reader arranged it: the hidden list stays hidden,
  // and closing Settings goes back to the list they came from.
  await page.keyboard.press("]");
  await expect(list(page)).toBeHidden();
  samePage = await markPage(page);
  await newerVersionLive(page);
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect.poll(samePage).toBe(false);
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(page).toHaveURL(/\/starred$/);
  await expect(list(page)).toBeHidden();
  await page.keyboard.press("]");
  await expect(list(page)).toBeVisible();

  // Back switches too: the address has already changed, so that's the page that loads.
  samePage = await markPage(page);
  await newerVersionLive(page);
  await page.goBack();
  await expect(page).toHaveURL(/\/settings$/);
  await expect.poll(samePage).toBe(false);
  await expect(page.getByRole("heading", { name: "Settings" }).first()).toBeVisible();
});

test("on a phone, Back after an update opens the new version one step back", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the phone layout only");
  // A phone opens on the feeds, its home screen.
  await openApp(page, "/");
  await sidebar(page).getByRole("link", { name: /^Starred/ }).click();
  await expect(page).toHaveURL(/\/starred$/);
  await expect(list(page)).toBeVisible();
  const samePage = await markPage(page);
  await newerVersionLive(page);
  await page.goBack();
  await expect.poll(samePage).toBe(false);
  // One step back from a list on a phone is the feeds, the home screen.
  await expect(sidebar(page)).toBeVisible();
  await expect(list(page)).toBeHidden();
});
