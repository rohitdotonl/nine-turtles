import { expect, test, type Locator, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, nothingToPickUp, openAppearance, openReadingRoom, signIn, tabTo } from "./screens";

// SPEC section 7 (and 19 and 21), "How to check it", done by a browser, on
// the made-up Reading Room blog (tests/feed-server.mjs).

const article = (page: Page) => page.getByRole("region", { name: "Article", exact: true });
const title = (page: Page, name: string) => article(page).getByRole("heading", { level: 2, name });
const row = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(name) });
/** Back to the list from an open article, which has the window to itself (decision 0275). */
async function toList(page: Page): Promise<void> {
  const back = page.getByRole("region", { name: "Article", exact: true }).getByRole("button", { name: /^Back to / });
  if (await back.isVisible()) await back.click();
}

async function openRoom(page: Page, width = 1280, { read = false } = {}) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await openReadingRoom(page, { read });
}

/** j chooses the first article in the list, and Enter opens it, alone in the window (decision 0275). */
async function openFirst(page: Page) {
  await page.keyboard.press("j");
  await page.keyboard.press("Enter");
}

async function visits(page: Page, path: string): Promise<number> {
  const response = await page.request.get(`${FEED_SITE}/visits`);
  const counts = (await response.json()) as Record<string, number>;
  return counts[path] ?? 0;
}

test.describe("on a wide window", () => {
  test.skip(({ isMobile }) => isMobile, "the phone layout has its own test below");

  test("an article or the feeds that couldn't be loaded say so, aloud too, with Try again", async ({ page }) => {
    // All read, so nothing has fetched the first article yet.
    await openRoom(page, 1280, { read: true });
    let failing = true;
    await page.route(/\/api\/articles\/[0-9]+$/, (route) => (failing ? route.fulfill({ status: 500 }) : route.fallback()));
    await openFirst(page);
    const articleProblem = article(page).getByRole("status").filter({ hasText: "This article couldn't be loaded." });
    await expect(articleProblem).toBeVisible();
    failing = false;
    // From the keyboard: Try again goes as the article comes, and the keyboard waits on its title, not lost.
    await tabTo(page, articleProblem.getByRole("button", { name: "Try again" }));
    await page.keyboard.press("Enter");
    await expect(articleProblem).toHaveCount(0);
    await expect(article(page).locator("h2.article-title")).toBeFocused();

    // The list itself, back in it: Try again asks for it again from the top, the keyboard waiting on the list's heading.
    await page.keyboard.press("Escape");
    let listFailing = true;
    await page.route(/\/api\/(items|articles)\?/, (route) => (listFailing ? route.fulfill({ status: 500 }) : route.fallback()));
    await page.keyboard.press("r");
    const listProblem = page.getByRole("status").filter({ hasText: "The articles couldn't be loaded." });
    await expect(listProblem).toBeVisible();
    listFailing = false;
    await tabTo(page, listProblem.getByRole("button", { name: "Try again" }));
    await page.keyboard.press("Enter");
    await expect(listProblem).toHaveCount(0);
    await expect(page.locator("#list-heading")).toBeFocused();

    let feedsFailing = true;
    await page.route("**/api/feeds", (route) =>
      feedsFailing && route.request().method() === "GET" ? route.fulfill({ status: 500 }) : route.fallback(),
    );
    await page.reload();
    const feedsProblem = page.getByRole("status").filter({ hasText: "Everyone you follow couldn't be loaded." });
    await expect(feedsProblem).toBeVisible();
    feedsFailing = false;
    await tabTo(page, feedsProblem.getByRole("button", { name: "Try again" }));
    await page.keyboard.press("Enter");
    await expect(feedsProblem).toHaveCount(0);
    await expect(page.locator("#sidebar a").first()).toBeFocused();
    await expect(page.getByRole("navigation", { name: "Sidebar" }).getByRole("link", { name: /^Asha/ }).first()).toBeVisible();
  });

  test("no layout buttons: the sidebar and the list have none, and f does nothing (decisions 0275 and 0282)", async ({ page }) => {
    await openRoom(page);
    const list = page.locator("#list-pane");
    const nav = page.getByRole("navigation", { name: "Sidebar" });
    // The list has no button of its own (decision 0241), and nor does the sidebar (decision 0282).
    await expect(page.getByRole("button", { name: "Article list", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sidebar", exact: true })).toHaveCount(0);
    await expect(nav).toBeVisible();

    // Full-screen reading is gone: an article has the window anyway.
    await page.keyboard.press("f");
    await expect(list).toBeVisible();
    await expect(nav).toBeVisible();
  });

  test("the keyboard starts on the list's title, and Skip to articles is the first Tab stop", async ({ page }) => {
    await openRoom(page);
    // Opening a list puts the keyboard's place on its title, never on the sidebar's wordmark, and draws no ring there.
    const heading = page.locator("#list-heading");
    await expect(heading).toBeFocused();
    await expect(heading).toHaveCSS("outline-style", "none");
    // From the top of the page, the first Tab lands on "Skip to articles", shown only while it has the keyboard.
    const skip = page.getByRole("link", { name: "Skip to articles" });
    expect((await skip.boundingBox())?.width ?? 0).toBeLessThanOrEqual(1);
    // From the very top of the page, as after a reload with nothing focused.
    await page.evaluate(() => {
      document.body.tabIndex = -1;
      document.body.focus();
      document.body.removeAttribute("tabindex");
    });
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
    const box = (await skip.boundingBox())!;
    expect(box.width).toBeGreaterThan(80);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await expect(skip).toHaveCSS("outline-style", "solid");
    // Enter goes past the sidebar to the first article.
    await page.keyboard.press("Enter");
    await expect(page.locator("#list-pane .item-row").first()).toBeFocused();
  });

  test("on a window about 1024px wide the list has room for feed names and titles, and no width to drag", async ({ page }) => {
    await openRoom(page, 1024);
    const list = page.locator("#list-pane");
    await expect(list).toBeVisible();
    // Nothing open: no reading area beside it (decision 0275).
    await expect(page.getByRole("region", { name: "Article", exact: true })).toHaveCount(0);
    expect((await list.boundingBox())!.width).toBeGreaterThanOrEqual(336);
    // Its titles get at least 280px of the row.
    expect((await list.locator(".item-row .title").first().boundingBox())!.width).toBeGreaterThanOrEqual(280);
    await expect(page.getByRole("separator", { name: "Resize the article list" })).toHaveCount(0);
  });

  test("j shows an article cleaned and restyled, and j and k move through the list", async ({ page }) => {
    await openRoom(page, 1280, { read: true });
    const room = page.url();
    // Nothing open: no empty reading area beside the list, so no quiet line and no tip (decision 0275).
    await expect(article(page)).toHaveCount(0);
    await expect(page.getByText("Time to read something beautiful.")).toHaveCount(0);

    await page.goto(room);
    await appReady(page);
    await expect(row(page, "The pleasure of a slow letter")).toBeVisible();
    // j chooses the first article in the list; Enter opens it, alone in the window.
    await page.keyboard.press("j");
    await expect(row(page, "The pleasure of a slow letter")).toHaveAttribute("aria-current", "true");
    await expect(row(page, "The pleasure of a slow letter")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(title(page, "The pleasure of a slow letter")).toBeVisible();

    // The title comes first, then the byline under it; the article ends with a short line.
    const byline = (await article(page).locator(".article-byline").boundingBox())!;
    expect(byline.y).toBeGreaterThan((await title(page, "The pleasure of a slow letter").boundingBox())!.y);
    await expect(article(page).locator("hr.article-end")).toBeHidden();

    // Headings, quotes, tables, code and the publisher's image, in place.
    const text = article(page).locator(".article-text");
    await expect(text.getByRole("heading", { name: "What a slow reader keeps" })).toBeVisible();
    await expect(text.locator("blockquote")).toContainText("Reading is a conversation");
    // A quotation is upright, in the text's own ink, with a 2px line at its start (decision 0296).
    const textInk = await text.evaluate((t) => getComputedStyle(t).color);
    const quote = await text.locator("blockquote").first().evaluate((q) => {
      const style = getComputedStyle(q);
      return { slant: style.fontStyle, ink: style.color, line: style.borderInlineStartWidth };
    });
    expect(quote).toEqual({ slant: "normal", ink: textInk, line: "2px" });
    // The writer's pull quote keeps its mark: centred, bigger than the text but under a heading, with no quotation line (decision 0297).
    const pull = await text.locator(".pull-quote").evaluate((q) => {
      const style = getComputedStyle(q);
      const size = (e: Element) => parseFloat(getComputedStyle(e).fontSize);
      return { align: style.textAlign, line: style.borderInlineStartWidth, bigger: size(q) > size(q.parentElement!), underHeading: size(q) < size(q.parentElement!.querySelector("h2")!) };
    });
    expect(pull).toEqual({ align: "center", line: "0px", bigger: true, underHeading: true });
    await expect(text.getByRole("table")).toBeVisible();
    await expect(text.locator("pre")).toContainText("read(book, slowly=True)");
    const image = article(page).locator('img[alt="A river drawn as three blue lines"]');
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

    // Credit: the source, with the author and time. Someone followed: their name opens their list (decision 0289),
    // a link that wraps as text does (decision 0260).
    const writer = article(page).locator(".article-byline").getByRole("link", { name: "Asha Rao" });
    await expect(writer).toHaveAttribute("title", "Everything by Asha Rao");
    await expect(writer).toHaveAttribute("href", /^\/(?:[a-z0-9-]+-)?[0-9]+$/);
    expect((await writer.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // The author is who the source is called by, so their name is said once (decision 0309).
    await expect(article(page).locator(".article-byline").getByText("Asha Rao")).toHaveCount(1);
    // Marked with its language, for screen readers.
    await expect(article(page).locator("article")).toHaveAttribute("lang", "en-gb");

    // Links in the text are underlined in the text color, never blue.
    const link = text.getByRole("link", { name: "letter" });
    await expect(link).toHaveAttribute("href", "https://reading-room.example/letters");
    const [linkColor, bodyColor, underline] = await link.evaluate((element) => [
      getComputedStyle(element).color,
      getComputedStyle(document.body).color,
      getComputedStyle(element).textDecorationLine,
    ]);
    expect(linkColor).toBe(bodyColor);
    expect(underline).toBe("underline");

    // The invisible tracking image never reached the screen, so it was never loaded.
    expect(await visits(page, "/reading/pixel.gif")).toBe(0);

    // j: the next one, a summary-only article. It was fetched in advance, so it shows at once.
    await page.keyboard.press("j");
    await expect(title(page, "Only the first page")).toBeVisible({ timeout: 100 });
    await expect(article(page).getByText("This feed shares just the opening paragraph")).toBeVisible({ timeout: 100 });
    await expect(article(page).getByText("Only the beginning is shared here.")).toBeVisible();

    await page.keyboard.press("k");
    await expect(title(page, "The pleasure of a slow letter")).toBeVisible({ timeout: 100 });
  });

  test("a screen reader finds the sidebar, the list and the article as named regions, and headings to jump between", async ({ page }) => {
    await openRoom(page);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Sidebar" })).toBeVisible();
    // On a computer the sidebar sits beside the main content, so "jump to main" goes past it (decision 0313).
    if (test.info().project.name !== "phone") await expect(page.getByRole("main").getByRole("navigation", { name: "Sidebar" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Asha Rao" })).toBeVisible();
    // One page title, then a heading for the list.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("nine turtles");
    await expect(page.getByRole("heading", { level: 2, name: "Asha Rao" })).toBeVisible();
    // j chooses a row: it says it's the current one.
    await page.keyboard.press("j");
    await expect(page.locator('[aria-current="true"]')).toHaveCount(1);
    // Opened, the article is a named region of its own, with its heading; the page title is still there for screen readers.
    await page.keyboard.press("Enter");
    await expect(title(page, "The pleasure of a slow letter")).toBeVisible();
    await expect(article(page)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("nine turtles");
  });

  test("Enter opens the article to read; Escape goes back to the list", async ({ page }) => {
    await openRoom(page);
    // Keyboard only: Tab reaches the first article; Enter opens it.
    await tabTo(page, row(page, "The pleasure of a slow letter"));
    await page.keyboard.press("Enter");
    await expect(title(page, "The pleasure of a slow letter")).toBeFocused();

    // While reading, j moves to the next article and keeps you reading.
    await page.keyboard.press("j");
    await expect(title(page, "Only the first page")).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(row(page, "Only the first page")).toBeFocused();

    // The arrow keys work like j and k in the list; Enter opens the one chosen.
    await page.keyboard.press("ArrowDown");
    await expect(row(page, "A third, shorter note")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(title(page, "A third, shorter note")).toBeVisible();
  });

  test("a click shows an article, and View original and v open the publisher's page in a new tab", async ({ page, context }) => {
    await context.route("https://reading-room.example/**", (route) =>
      route.fulfill({ contentType: "text/html", body: "<title>The original</title>" }),
    );
    await openRoom(page);
    await row(page, "Only the first page").click();
    await expect(title(page, "Only the first page")).toBeVisible();

    const original = article(page).getByRole("link", { name: "View original" }).first();
    // Two and two, quiet icons each named in its tooltip with its key (decision 0299): the way back to the list (decision 0275)
    // and the way to the publisher on the left, Save and More on the right; Write back is never in the bar (decision 0298).
    const order = await article(page)
      .locator(".reading-bar")
      .locator("a[aria-label], button[aria-label]")
      .evaluateAll((controls) => controls.map((control) => control.getAttribute("aria-label")));
    expect(order).toEqual(["Back to Asha Rao", "View original", "Save", "More actions"]);
    expect((await original.innerText()).trim()).toBe("");
    await expect(article(page).getByRole("button", { name: "Save", exact: true }).first()).toHaveAttribute("title", "Save (S)");
    await expect(original).toHaveAttribute("title", "View original (V)");
    // More holds Copy link (Share where there's a share menu), Text and page, Mark unread, Add a note, then, apart, Info about them and Hide articles about…, each with its icon, their keys shown beside them.
    const more = article(page).getByRole("button", { name: "More actions" });
    await expect(more).toHaveAttribute("aria-haspopup", "menu");
    await more.click();
    const menu = page.getByRole("menu", { name: "More actions" });
    await expect(menu.getByRole("menuitem")).toHaveText([/Copy link\s*C/, /Text and page/, /Mark as unread/, /Add a note/, /Info about Asha Rao/, /Hide articles about/]);
    await expect(menu.getByRole("menuitem", { name: "Mark as unread" })).toHaveAttribute("aria-keyshortcuts", "m");
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(more).toBeFocused();
    await expect(original).toHaveAttribute("href", "https://reading-room.example/first-page");
    await expect(original).toHaveAttribute("target", "_blank");

    const [tab] = await Promise.all([context.waitForEvent("page"), page.keyboard.press("v")]);
    await tab.waitForLoadState();
    expect(tab.url()).toBe("https://reading-room.example/first-page");
    await tab.close();
  });

  test("Copy link copies the publisher's address, not nine turtles'", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: FEEDS_APP });
    await openRoom(page);
    await openFirst(page);
    await article(page).getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menu", { name: "More actions" }).getByRole("menuitem", { name: /Copy link/ }).click();
    await expect(article(page).getByRole("status")).toHaveText("Link copied.");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("https://reading-room.example/slow-letter");
  });

  test("Text and page opens with the keyboard alone, and More pressed again closes the panel before its menu opens (decision 0293)", async ({ page }) => {
    await openRoom(page);
    await openFirst(page);
    const more = article(page).getByRole("button", { name: "More actions" });
    const panel = page.getByRole("dialog", { name: "Text and page" });
    const menu = page.getByRole("menu", { name: "More actions" });
    // With only a keyboard: Enter on More, the first row is Copy link, the next Text and page, and Enter opens the panel on its first control.
    await more.focus();
    await page.keyboard.press("Enter");
    await expect(menu.getByRole("menuitem").first()).toBeFocused();
    await expect(menu.getByRole("menuitem").first()).toHaveText(/Copy link/);
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem").nth(1)).toHaveText(/Text and page/);
    await expect(menu.getByRole("menuitem").nth(1)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("button", { name: "Smaller text" })).toBeFocused();
    // Tab past its last choice: the panel closes, so the keyboard never lands on something under it (decision 0313).
    for (let press = 0; press < 8 && (await panel.count()) > 0; press++) await page.keyboard.press("Tab");
    await expect(panel).toHaveCount(0);
    await openAppearance(page);
    // Escape gives the keyboard back to More.
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(more).toBeFocused();
    // Open again, then press More: the panel goes and the menu shows, never hidden under the panel.
    await openAppearance(page);
    await more.click();
    await expect(panel).toHaveCount(0);
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("elsewhere than a Mac, Share is three linked dots (decision 0293)", async ({ page }) => {
    await openRoom(page);
    await openFirst(page);
    await article(page).getByRole("button", { name: "More actions" }).click();
    const icon = page.getByRole("menu", { name: "More actions" }).getByRole("menuitem", { name: /Copy link/ }).locator("svg");
    expect(await icon.evaluate((svg) => svg.querySelectorAll("circle").length)).toBe(3);
  });

  test("on a Mac, Share is Apple's box with an arrow (decision 0293)", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "platform", { get: () => "MacIntel" }));
    await openRoom(page);
    await openFirst(page);
    await article(page).getByRole("button", { name: "More actions" }).click();
    const icon = page.getByRole("menu", { name: "More actions" }).getByRole("menuitem", { name: /Copy link/ }).locator("svg");
    expect(await icon.evaluate((svg) => [svg.querySelectorAll("circle").length, svg.querySelectorAll("path").length])).toEqual([0, 3]);
  });

  test("the reading panel changes text size, appearance and font at once; Escape closes it", async ({ page }) => {
    await openRoom(page);
    await openFirst(page);
    // Text and page, in More (decision 0293).
    const aa = article(page).getByRole("button", { name: "More actions" });
    const panel = await openAppearance(page);
    // A popover under More, lined up with its right edge.
    const button = (await aa.boundingBox())!;
    const box = (await panel.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(button.y + button.height);
    expect(Math.abs(box.x + box.width - (button.x + button.width))).toBeLessThan(2);
    // The keyboard starts on its first control.
    await expect(panel.getByRole("button", { name: "Smaller text" })).toBeFocused();

    // Text size: the same steps as + and -, applied at once.
    const root = page.locator("html");
    const size = () => root.evaluate((html) => html.style.getPropertyValue("--reading-size"));
    const before = await size();
    await panel.getByRole("button", { name: "Larger text" }).click();
    await expect(panel.getByRole("status")).toHaveText("Large");
    expect(await size()).not.toBe(before);
    await panel.getByRole("button", { name: "Smaller text" }).click();
    await expect.poll(size).toBe(before);

    // Page: White, Paper, Night or Match device, applied at once (decision 0176).
    const pages = panel.getByRole("group", { name: "Page" });
    await expect(pages.getByRole("radio")).toHaveCount(4);
    // One line per setting (decision 0123): every choice 44px to press; the chosen word
    // semibold and underlined, so it shows without color; the pages as swatches named under them.
    for (const choice of await panel.locator("label").all()) {
      const box = (await choice.boundingBox())!;
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
    }
    const chosenFont = panel.locator("label", { has: page.getByRole("radio", { name: "Literata" }) });
    await expect(chosenFont).toHaveCSS("font-weight", "600");
    await expect(chosenFont).toHaveCSS("text-decoration-line", "underline");
    // One line width for everyone (decision 0187): there's no choice of it.
    await expect(panel.getByRole("group", { name: "Line width" })).toHaveCount(0);
    for (const name of ["White", "Paper", "Night", "Match device"]) await expect(pages.getByText(name, { exact: true })).toBeVisible();
    await expect(pages.getByRole("radio", { name: "Match device" })).toBeChecked();
    await expect(panel.locator(".swatch-name", { hasText: "Match device" })).toHaveCSS("font-weight", "600");
    await expect(panel.getByRole("group", { name: "Theme" })).toHaveCount(0);
    // Links in articles are the text's own color on every page, underlined.
    const link = article(page).locator(".article-text a").first();
    const textColor = () => article(page).locator(".article-text").first().evaluate((el) => getComputedStyle(el).color);
    await expect(link).toHaveCSS("color", await textColor());
    await pages.getByRole("radio", { name: "Paper" }).check();
    await expect(root).toHaveAttribute("data-theme", "paper");
    await expect(root).toHaveAttribute("data-mode", "light");
    await expect(link).toHaveCSS("color", await textColor());
    await expect(link).toHaveCSS("text-decoration-line", "underline");
    // With the keyboard, as any radio buttons: the arrow key moves on to Night.
    await pages.getByRole("radio", { name: "Paper" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(pages.getByRole("radio", { name: "Night" })).toBeChecked();
    await expect(root).toHaveAttribute("data-theme", "night");
    await expect(root).toHaveAttribute("data-mode", "dark");
    await pages.getByRole("radio", { name: "White" }).check();
    await expect(root).toHaveAttribute("data-theme", "white");
    await pages.getByRole("radio", { name: "Match device" }).check();
    // The article text is regular; a publisher's bold words are semibold.
    const text = article(page).locator(".article-text").first();
    await expect(text).toHaveCSS("font-weight", "400");
    const strongWeight = () =>
      text.evaluate((el) => {
        const strong = el.appendChild(document.createElement("strong"));
        const weight = getComputedStyle(strong).fontWeight;
        strong.remove();
        return weight;
      });
    await expect.poll(strongWeight).toBe("600");
    // Fonts are named in their own face.
    await panel.getByRole("radio", { name: "Atkinson Hyperlegible" }).check();
    await expect.poll(() => root.evaluate((html) => html.style.getPropertyValue("--reading-font"))).toContain("Atkinson");
    // rohit.onl's font: the device's own serif (decision 0063).
    await panel.getByRole("radio", { name: "System serif" }).check();
    await expect.poll(() => root.evaluate((html) => html.style.getPropertyValue("--reading-font"))).toContain("ui-serif");
    await panel.getByRole("radio", { name: "Atkinson Hyperlegible" }).check();
    await expect(text).toHaveCSS("font-weight", "400");

    // The keyboard's outline is in the text color, never the accent.
    await panel.getByRole("radio", { name: "White", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowLeft");
    await expect(panel.getByRole("radio", { name: "White", exact: true })).toBeChecked();
    const [outline, ink] = await panel
      .getByRole("radio", { name: "White", exact: true })
      .evaluate((input) => [getComputedStyle(input.closest("label")!).outlineColor, getComputedStyle(document.body).color]);
    expect(outline).toBe(ink);

    // Escape closes only the panel and gives the keyboard back to More, where it opened; the article stays.
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(aa).toBeFocused();
    await expect(aa).toHaveAttribute("aria-expanded", "false");
    await expect(title(page, "The pleasure of a slow letter")).toBeVisible();

    // A press outside closes it too. Settings shows the same Page; text size and font are only here (decision 0241).
    await openAppearance(page);
    await title(page, "The pleasure of a slow letter").click({ position: { x: 4, y: 4 } });
    await expect(panel).toHaveCount(0);
    // To Settings by its keys: the sidebar is away while the article is open (decision 0275).
    await page.keyboard.press("g");
    await page.keyboard.press(",");
    await expect(page.getByRole("region", { name: "Look and feel" }).getByRole("radio", { name: "White", exact: true })).toBeChecked();
    await expect(page.getByText("This device only. Text size and font are in any article's More › Text and page.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Look and feel" }).getByRole("radio", { name: "Atkinson Hyperlegible" })).toHaveCount(0);
  });

  test("a footnote opens where you are, and the article's typewriter marks are set properly", async ({ page }) => {
    await openRoom(page);
    await openFirst(page);
    const text = article(page).locator("#article-text");
    // A footnote's number opens its note in a card just under the line (decision 0247); the notes stay at the end too.
    const one = text.locator("sup").getByRole("link", { name: "1", exact: true });
    await one.click();
    const card = page.getByRole("dialog", { name: "Footnote 1" });
    await expect(card).toBeFocused();
    await expect(card).toContainText("Written in Python, a long time ago.");
    await expect(card).not.toContainText("1. Written");
    const [line, box] = [(await one.boundingBox())!, (await card.boundingBox())!];
    expect(box.y).toBeGreaterThan(line.y + line.height - 1);
    expect(box.y).toBeLessThan(line.y + line.height + 12);
    // Escape closes it and gives the keyboard back to the number; nothing left this tab or the article's address.
    await page.keyboard.press("Escape");
    await expect(card).toHaveCount(0);
    await expect(one).toBeFocused();
    await expect(page).toHaveURL(/\/(?:[a-z0-9-]+-)?[0-9]+\/(?:[a-z0-9-]+-)?[0-9]+$/);
    expect(page.context().pages()).toHaveLength(1);
    // From the keyboard alone: Enter on the number opens it; Tab reaches its ×, and Tab past it closes it.
    await page.keyboard.press("Enter");
    await expect(card).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(card.getByRole("button", { name: "Close" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(card).toHaveCount(0);
    // A note in a list, without its way back, its own link set as the article's are; × closes it, and so does a press anywhere else.
    await text.locator("sup").getByRole("link", { name: "2", exact: true }).click();
    const two = page.getByRole("dialog", { name: "Footnote 2" });
    await expect(two).toContainText("She taught for \u2018thirty years\u2019, and wrote every letter by hand;");
    await expect(two.getByRole("link")).toHaveCount(1);
    await expect(two.getByRole("link", { name: "her notebooks" })).toHaveCSS("text-decoration-line", "underline");
    await two.getByRole("button", { name: "Close" }).click();
    await expect(two).toHaveCount(0);
    await text.locator("sup").getByRole("link", { name: "2", exact: true }).click();
    await title(page, "The pleasure of a slow letter").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // A number that isn't a superscript, with the note's id on the note's own number, as some newsletters write them.
    await text.getByRole("link", { name: "3", exact: true }).first().click();
    const three = page.getByRole("dialog", { name: "Footnote 3" });
    await expect(three).toContainText("A note shaped as some newsletters write them.");
    await expect(three.getByRole("link")).toHaveCount(0);
    await page.keyboard.press("Escape");
    // A note's own way back still jumps to its place.
    await text.locator("li").getByRole("link", { name: "\u21a9" }).click();
    await expect(text.locator("sup").getByRole("link", { name: "2", exact: true })).toBeFocused();
    // Curly quotes, an apostrophe, a dash and an ellipsis, as a typesetter would; a paragraph's opening mark opens; code exactly as written.
    await expect(text).toContainText("As my teacher said, \u201cDon\u2019t rush it \u2014 the words will wait\u2026\u201d");
    await expect(text).toContainText("\u201cSlowly,\u201d she said, \u201calways slowly.\u201d");
    await expect(text.locator("code").first()).toHaveText('print("hello")');
  });

  test("a highlight kept with straight quotes is still found in the curled text", async ({ page }) => {
    await openRoom(page);
    await openFirst(page);
    const id = new URL(page.url()).pathname.match(/[0-9]+$/)?.[0];
    const made = await page.request.post(new URL(`/api/articles/${id}/highlights`, FEEDS_APP).href, {
      data: { quote: `"Don't rush it -- the words` },
      headers: { Origin: FEEDS_APP },
    });
    expect(made.status()).toBe(201);
    await page.reload();
    await expect(article(page).locator("#article-text mark.highlight").first()).toBeVisible();
    await expect(article(page).locator("#article-text")).toContainText("\u201cDon\u2019t rush it \u2014 the words");
    expect(await article(page).locator("#article-text mark.highlight").allTextContents()).toEqual(["\u201cDon\u2019t rush it \u2014 the words"]);
    // Taken off again, so the other tests find the article as it was.
    const { highlight } = (await made.json()) as { highlight: { id: number } };
    await page.request.post(new URL(`/api/highlights/${highlight.id}/delete`, FEEDS_APP).href, { headers: { Origin: FEEDS_APP } });
  });

  test("the controls stay calm: a one-line search box, and you can always see where the keyboard is", async ({ page }) => {
    await openRoom(page);
    // At rest, the field says "Search articles", so it isn't mistaken for the sidebar's find field (decision 0217).
    await expect(page.getByRole("button", { name: "Remove in: Asha Rao" })).toHaveCount(0);
    // At rest the field waits behind Search, beside More (decision 0242); opened, its name is "Search articles" (decision 0217).
    await expect(page.getByRole("textbox", { name: "Search articles", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    // In the search, the scope chip sits in the box without making it taller (decision 0025).
    await expect(page.getByRole("button", { name: "Remove in: Asha Rao" })).toBeVisible();
    // Shift+Tab reaches the chip's Remove button, and the chip stays while it has the keyboard.
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("button", { name: "Remove in: Asha Rao" })).toBeFocused();
    // Leaving an empty search puts the field back at rest, still open until Search or Escape.
    await page.locator("#list-heading").focus();
    await expect(page.getByRole("button", { name: "Remove in: Asha Rao" })).toHaveCount(0);
    // A click on the words "Search articles" opens the search without removing its scope.
    await page.getByRole("textbox", { name: "Search articles", exact: true }).click({ position: { x: 60, y: 20 } });
    await expect(page.getByRole("button", { name: "Remove in: Asha Rao" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Search articles", exact: true })).toBeFocused();
    const box = (await page.locator(".search-box").boundingBox())!;
    expect(box.height).toBeLessThanOrEqual(48);
    // The chip's remove button is small to look at but a full 44px to press.
    const remove = (await page.getByRole("button", { name: "Remove in: Asha Rao" }).boundingBox())!;
    expect(Math.min(remove.width, remove.height)).toBeGreaterThanOrEqual(44);
    // Before anything is selected, Tab reaches the first row and draws the
    // keyboard's outline just inside its edge. The selected row keeps the
    // same outline over its pill.
    const first = row(page, "The pleasure of a slow letter");
    await tabTo(page, first);
    await expect(first).toHaveCSS("outline-style", "solid");
    await expect(first).toHaveCSS("outline-width", "2px");
    await page.keyboard.press("j");
    const selected = row(page, "The pleasure of a slow letter");
    await expect(selected).toBeFocused();
    await expect(selected).toHaveCSS("outline-style", "solid");
    await expect(selected).toHaveCSS("outline-width", "2px");
    // The selection is a pill (decision 0037): filled, 8px corners, 8px in
    // from the list's edge, grey with no bar (decision 0057). The outline is
    // drawn inside its edge. The list's edge is its column's: the reading column's, 32px in from it (decision 0277).
    await expect(selected).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(selected).toHaveCSS("border-top-left-radius", "8px");
    expect(await selected.evaluate((element) => getComputedStyle(element, "::before").content)).toBe("none");
    const paneX = await selected.evaluate((element) => element.closest(".scroller")!.getBoundingClientRect().left + parseFloat(getComputedStyle(element.closest(".scroller")!).paddingLeft) - 32);
    const inset = (await selected.boundingBox())!.x - paneX;
    expect(Math.abs(inset - 8)).toBeLessThan(1);
    // Every title starts 32px into the column, lined up with the list's title
    // and the search field, dot or no dot (decision 0041).
    const titleX = (await selected.locator(".title").boundingBox())!.x;
    expect(Math.abs(titleX - paneX - 32)).toBeLessThan(1);
    expect(Math.abs((await page.locator("#list-heading").boundingBox())!.x - titleX)).toBeLessThan(1);
    expect(Math.abs((await page.locator(".search-box").boundingBox())!.x - titleX)).toBeLessThan(1);
    // No line parts the rows: space alone does (decision 0123).
    expect(await page.locator(".item-list > li + li").first().evaluate((element) => getComputedStyle(element, "::before").content)).toBe("none");
    await expect(selected).toHaveCSS("outline-offset", "-2px");
    // The pill is the accent mixed into the list: deeper than the list, never the hover's neutral tone.
    const [fill, tint] = await selected.evaluate((element) => {
      const probe = document.createElement("div");
      probe.style.backgroundColor = "var(--tint-list)";
      document.body.append(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return [getComputedStyle(element).backgroundColor, color];
    });
    expect(fill).toBe(tint);
    // A finished list says so, in a quiet caption on the list's edge, in the serif, with no rule (decision 0142).
    const end = page.getByText("That's everything.");
    await expect(end).toBeVisible();
    await expect(end).toHaveCSS("border-top-width", "0px");
    await expect(end).toHaveCSS("text-align", "start");
    await expect(end).toHaveCSS("font-family", /Literata/);
    await expect(page.getByRole("button", { name: "Show older articles" })).toHaveCount(0);
    // The note (here, Undo for a star) sits at the foot of the list pane, even under a short list.
    await page.keyboard.press("s");
    const note = page.locator(".toast:not(.sr-only)");
    await expect(note).toBeVisible();
    const [noteBox, paneBox] = [(await note.boundingBox())!, (await selected.evaluate((element) => element.closest(".scroller")!.getBoundingClientRect().toJSON()))];
    expect(paneBox.bottom - (noteBox.y + noteBox.height)).toBeLessThan(48);
    // It sits in a band of the pane's own color (the page, decision 0221) across the list's column, which the rows end above, so it
    // never lies over the rows you're acting on (decision 0048).
    const band = note.locator("xpath=..");
    const [bandFill, paneFill] = await Promise.all([
      band.evaluate((element) => getComputedStyle(element).backgroundColor),
      selected.evaluate((element) => getComputedStyle(element.closest(".list-pane")!).backgroundColor),
    ]);
    expect(bandFill).toBe(paneFill);
    const bandBox = (await band.boundingBox())!;
    expect(bandBox.width).toBeGreaterThan(Math.min(paneBox.width, 42 * 16) - 16);
    await page.keyboard.press("u");
    // Opening an article gives its title the keyboard's place for screen
    // readers, but no ring: a title can't be pressed (decision 0047). The
    // next Tab lands on the writer's name in the byline, which rings.
    await page.keyboard.press("Enter");
    const heading = title(page, "The pleasure of a slow letter");
    await expect(heading).toBeFocused();
    await expect(heading).toHaveCSS("outline-style", "none");
    await page.keyboard.press("Tab");
    const publisher = article(page).locator(".article-byline").getByRole("link", { name: "Asha Rao" });
    await expect(publisher).toBeFocused();
    await expect(publisher).toHaveCSS("outline-style", "solid");
  });

  test("on a wide window the article sits in the middle, and its actions sit together over the text's right edge",async ({ page }) => {
    await openRoom(page, 2560);
    await openFirst(page);
    const text = (await article(page).locator("article").boundingBox())!;
    // Centred in its scrolling area (the space left beside any scrollbar):
    // as much room on its left as on its right, within a pixel or two.
    const room = await article(page)
      .locator("article")
      .evaluate((element) => {
        const area = element.parentElement!;
        const box = area.getBoundingClientRect();
        const own = element.getBoundingClientRect();
        return { left: own.left - box.left, right: box.left + area.clientWidth - own.right };
      });
    expect(Math.abs(room.left - room.right)).toBeLessThan(4);
    // The bar stands over the text column (decision 0277, replacing the pane's edges of 0050), two and two (decision 0299):
    // the way back on the text's left edge with View original beside it, Save beside More, More's icon ending on the
    // text's right edge, so on a very wide window they stay within reach of the words.
    const bar = article(page).locator(".reading-bar");
    const original = (await bar.getByRole("link", { name: "View original" }).boundingBox())!;
    const save = (await bar.getByRole("button", { name: "Save", exact: true }).boundingBox())!;
    const last = (await bar.getByRole("button", { name: "More actions" }).boundingBox())!;
    const back = (await bar.getByRole("button", { name: /^Back to / }).boundingBox())!;
    expect(original.x - (back.x + back.width)).toBeLessThan(9);
    expect(last.x - (save.x + save.width)).toBeLessThan(9);
    expect(Math.abs(last.x + last.width - 12 - (text.x + text.width))).toBeLessThan(2);
    expect(Math.abs(back.x + 12 - text.x)).toBeLessThan(2);
    expect(Math.abs(original.y - last.y)).toBeLessThan(2);
  });

  test("every pane shares one top line, and a toolbar's focus ring stays clear of the window's top", async ({ page }) => {
    await openRoom(page);
    // One band for every pane's top line (decision 0043): the sidebar's and the list's end at the same height,
    // and the article's, alone in the window once open (decision 0275), at that height too.
    const bottomsOf = (selector: string) =>
      page.locator(selector).evaluateAll((bars) => bars.map((bar) => Math.round(bar.getBoundingClientRect().bottom)));
    const bottoms = await bottomsOf("#sidebar .pane-bar, .list-pane > .pane-bar");
    expect(bottoms).toHaveLength(2);
    expect(new Set(bottoms).size).toBe(1);
    // Their controls sit on one line: the list's More, then the article's.
    const middle = async (selector: string) => {
      const box = (await page.locator(selector).first().boundingBox())!;
      return box.y + box.height / 2;
    };
    const line = await middle(".list-pane > .pane-bar button");
    await openFirst(page);
    expect(await bottomsOf(".reading-bar")).toEqual([bottoms[0]]);
    expect(Math.abs((await middle(".reading-bar button[aria-label='Save']")) - line)).toBeLessThan(1);
    // A toolbar button's ring is drawn inside its own edge, so it never touches the window's top.
    const aa = article(page).locator(".reading-bar").getByRole("button", { name: "Save", exact: true });
    await tabTo(page, aa);
    await expect(aa).toHaveCSS("outline-offset", "-2px");
    // (5, not 6: the bar now stays at the top, decision 0298, and a sticky bar may sit half a pixel off the whole.)
    expect((await aa.boundingBox())!.y).toBeGreaterThanOrEqual(5);
  });

  test("the top bar is solid in the page's color, stays, and names the article once its title has gone; Save and View original are only there, never again at the end (decision 0302)", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: FEEDS_APP });
    await openRoom(page);
    // A short window, so even a short article scrolls its title away.
    await page.setViewportSize({ width: 1280, height: 420 });
    await openFirst(page);
    const bar = article(page).locator(".reading-bar");
    const scroller = article(page).locator(".reading-scroller");
    // Solid, never see-through or blurred (decision 0040).
    const [barColor, paperColor, blur] = await Promise.all([
      bar.evaluate((element) => getComputedStyle(element).backgroundColor),
      article(page).evaluate((element) => getComputedStyle(element).backgroundColor),
      bar.evaluate((element) => getComputedStyle(element).backdropFilter),
    ]);
    expect(barColor).toBe(paperColor);
    expect(barColor).not.toMatch(/0\.\d+\)$/);
    expect(blur).toBe("none");
    // The bar is the article's first line, its edges the pane's (bar the scrollbar), and it stays at the top (decision 0298, replacing 0263).
    const [barBox, scrollerBox] = [(await bar.boundingBox())!, (await scroller.boundingBox())!];
    expect(Math.abs(barBox.x - scrollerBox.x)).toBeLessThan(1);
    expect(Math.abs(barBox.y - scrollerBox.y)).toBeLessThan(1);
    // Room above the title: 48px of the column's own over the bar (decision 0302).
    expect((await article(page).locator(".article-title").boundingBox())!.y - (barBox.y + barBox.height)).toBeGreaterThanOrEqual(48);
    // At the top it names nothing and has no hairline: the title is right there.
    const running = bar.locator(".running-title");
    await expect(running).toHaveCount(0);
    await expect(bar).toHaveCSS("border-bottom-width", "0px");
    // Just after the title's foot has gone under the bar, its copy is on its way up, still partly below the bar's middle,
    // moving only as far as the page scrolls (decision 0302).
    const heading = article(page).locator(".article-title");
    await scroller.evaluate((element, foot) => element.scrollBy(0, foot + 6), (await heading.boundingBox())!.y + (await heading.boundingBox())!.height - barBox.y - barBox.height);
    await expect(running).toHaveCount(1);
    const rising = await running.locator(".running-words").evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m42);
    expect(rising).toBeGreaterThan(0);
    // In the title's own face, never the interface's.
    expect(await running.locator(".running-words").evaluate((element) => getComputedStyle(element).fontFamily)).toBe(await heading.evaluate((element) => getComputedStyle(element).fontFamily));
    await scroller.evaluate((element) => element.scrollBy(0, 300));
    await expect(running.locator(".running-words")).toHaveCSS("transform", "none");
    expect(Math.abs((await bar.boundingBox())!.y - scrollerBox.y)).toBeLessThan(1);
    // Once the title has gone up under it, the bar names the article over a hairline, in the text's true middle
    // (decision 0299); screen readers don't hear it twice.
    await expect(running).toHaveText((await article(page).locator(".article-title").textContent())!.trim());
    await expect(running).toHaveAttribute("aria-hidden", "true");
    const centre = async (locator: Locator) => { const box = (await locator.boundingBox())!; return box.x + box.width / 2; };
    expect(Math.abs((await centre(running.locator(".running-words"))) - (await centre(article(page).locator(".article-text"))))).toBeLessThan(1.5);
    await expect(bar).toHaveCSS("border-bottom-width", "1px");
    // Back at the top, it goes at once.
    await scroller.evaluate((element) => element.scrollTo(0, 0));
    await expect(running).toHaveCount(0);
    // No hairline at the window's top: nothing stays above the bar for it to part from.
    await expect(scroller).toHaveCSS("border-top-width", "0px");
    // At the end, the bar's Save and View original are still in view, and nowhere else (decision 0302).
    await scroller.evaluate((element) => element.scrollTo(0, element.scrollHeight));
    await expect(bar.getByRole("button", { name: "Save", exact: true })).toBeInViewport();
    await expect(bar.getByRole("link", { name: "View original" })).toBeInViewport();
    await expect(article(page).getByRole("button", { name: "Save", exact: true })).toHaveCount(1);
    await expect(article(page).getByRole("link", { name: "View original" })).toHaveCount(1);
    await expect(bar.getByRole("button", { name: "Save", exact: true })).toHaveAttribute("aria-pressed", "false");
    // What was just done floats at the pane's foot, wherever the bar is, with its ×.
    await article(page).locator(".article-title").focus();
    await page.keyboard.press("c");
    const said = article(page).locator(".away .toast");
    await expect(said).toContainText("Link copied.");
    expect((await said.boundingBox())!.y).toBeGreaterThan(scrollerBox.y + scrollerBox.height - 120);
    // A note that comes later (here the star's Undo) puts the older line away, so the newest shows.
    await page.keyboard.press("s");
    await expect(said).toContainText("Saved.");
    await said.getByRole("button", { name: "Undo" }).click();
    await expect(bar.getByRole("button", { name: "Save", exact: true })).toHaveAttribute("aria-pressed", "false");
    await said.getByRole("button", { name: "Close the note" }).click();
    await expect(said).toHaveClass(/sr-only/);
    // The scrollbar's track is see-through, so its gutter is the page's own color in every theme.
    expect(await scroller.evaluate((element) => getComputedStyle(element).scrollbarColor)).toMatch(/ transparent$|rgba\(0, 0, 0, 0\)$/);
  });

  test("the title is centred, in the display cut, sized by its length; under it, the name leads and the day is small and faint", async ({ page }) => {
    await openRoom(page);
    await openFirst(page);
    const heading = article(page).locator(".article-title");
    // A short title is set large: 3.2 times the text (decision 0294).
    await expect(heading).toHaveClass(/\bshort\b/);
    await expect(heading).toHaveCSS("font-size", "64px");
    // Regular weight, in Literata's display cut, centred as a book opens a chapter (decisions 0246, 0294).
    await expect(heading).toHaveCSS("font-weight", "400");
    await expect(heading).toHaveCSS("font-family", /^"Literata Display"/);
    await expect(heading).toHaveCSS("text-align", "center");
    // Its lines are balanced, so a two-line title reads as two even lines (decision 0044).
    await expect(heading).toHaveCSS("text-wrap", /balance/);
    expect(parseFloat(await heading.evaluate((element) => getComputedStyle(element).lineHeight)) / 64).toBeCloseTo(1, 2);
    // A clear pause before the byline, seven-tenths of its size (decision 0047).
    await expect(heading).toHaveCSS("margin-bottom", "44.8px");
    const byline = article(page).locator(".article-byline");
    // In the reading face at the interface size, centred (decision 0294).
    await expect(byline).toHaveCSS("font-size", /^(15|17)px$/);
    await expect(byline).toHaveCSS("text-align", "center");
    await expect(byline).toHaveCSS("font-family", /Literata/);
    const publisher = byline.getByRole("link", { name: "Asha Rao" });
    await expect(publisher).toHaveCSS("font-weight", "400");
    // The name alone, no "by" to see; screen readers still hear "by" (decision 0323).
    await expect(byline).not.toContainText("/");
    await expect(byline.locator(".sr-only").first()).toHaveText("by");
    const time = byline.locator("time");
    await expect(time).toHaveCSS("display", "block");
    await expect(time).toHaveCSS("font-size", "12px");
    const [inkColor, publisherColor, timeColor, faint] = await Promise.all([
      page.evaluate(() => getComputedStyle(document.body).color),
      publisher.evaluate((element) => getComputedStyle(element).color),
      time.evaluate((element) => getComputedStyle(element).color),
      page.evaluate(() => {
        const probe = document.createElement("span");
        probe.style.color = "var(--faint)";
        document.body.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      }),
    ]);
    expect(publisherColor).toBe(inkColor);
    expect(timeColor).toBe(faint);
    // Headings inside the article speak in the title's voice, stepping down by size alone: 31px, then 24px, regular (decision 0295).
    const h2 = article(page).locator(".article-text h2").first();
    const h3 = article(page).locator(".article-text h3").first();
    await expect(h2).toHaveCSS("font-size", "31px");
    await expect(h3).toHaveCSS("font-size", "24px");
    for (const h of [h2, h3]) {
      await expect(h).toHaveCSS("font-weight", "400");
      await expect(h).toHaveCSS("font-family", /^"Literata Display"/);
      await expect(h).toHaveCSS("text-align", "start");
    }

  });

  test("an article's parts are set as a book sets them: real bold italics, plain zeros in dates, spacing that follows the size (decision 0246)", async ({ page }) => {
    await openRoom(page);
    await openFirst(page);
    // Bold inside italics is drawn from its own font files, never slanted by the browser.
    const boldItalic = (family: string) =>
      page.evaluate((name) => [...document.fonts].some((font) => font.family.replaceAll('"', "") === name && font.style === "italic" && font.weight === "600"), family);
    expect(await boldItalic("Literata")).toBe(true);
    expect(await boldItalic("Atkinson Hyperlegible Next")).toBe(true);
    // A date in the interface takes the face with a plain zero; the article's own text doesn't.
    await expect(article(page).locator(".article-byline time")).toHaveCSS("font-family", /^"Atkinson Hyperlegible Next Plain Zero"/);
    const words = article(page).locator(".article-text");
    expect(await words.locator("p").first().evaluate((element) => getComputedStyle(element).fontFamily)).not.toContain("Plain Zero");
    // A footnote's number has room to be pressed, and is underlined as every article link is.
    const note = article(page).locator('.article-text sup > a[href^="#article-"]').first();
    await expect(note).toHaveCSS("text-decoration-line", "underline");
    expect((await note.evaluate((element) => parseFloat(getComputedStyle(element).paddingLeft))) > 0).toBe(true);
    // On a touch screen it has an unseen 44px place to press around it (decision 0313).
    if (test.info().project.name === "phone") expect(await note.evaluate((element) => parseFloat(getComputedStyle(element, "::after").height))).toBeGreaterThanOrEqual(44);
    // A writer's highlighting is a soft tone of the ink, never the browser's yellow; keys are key caps; a term is semibold; a table's figures line up.
    const mark = words.locator("mark");
    await expect(mark).not.toHaveCSS("background-color", "rgb(255, 255, 0)");
    await expect(mark).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(words.locator("kbd")).toHaveCSS("border-bottom-width", "2px");
    await expect(words.locator("dt")).toHaveCSS("font-weight", "600");
    await expect(words.locator("table")).toHaveCSS("font-variant-numeric", "tabular-nums");
    // In high contrast the system's own highlight colors show it.
    await page.emulateMedia({ forcedColors: "active" });
    await expect(mark).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await page.emulateMedia({ forcedColors: "none" });
    // Line spacing follows the reader's size: 1.55 at the usual size, less for larger text, never under 1.5.
    const text = article(page).locator("article");
    const leading = () => text.evaluate((element) => parseFloat(getComputedStyle(element).lineHeight) / parseFloat(getComputedStyle(element).fontSize));
    expect(await leading()).toBeCloseTo(1.55, 2);
    await page.keyboard.press("+");
    await expect.poll(leading).toBeCloseTo(1.52, 2);
    await page.keyboard.press("+");
    await page.keyboard.press("+");
    await expect.poll(leading).toBeCloseTo(1.5, 2);
    await page.keyboard.press("-");
    await page.keyboard.press("-");
    await page.keyboard.press("-");
  });

  test("on a 1280px window the text keeps at least 56px of paper on each side", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openRoom(page);
    await openFirst(page);
    // A list's words start on the paragraphs' left edge, its numbers hanging in the margin (decision 0218).
    const [paragraph, item] = await Promise.all([
      article(page).locator(".article-text > p").first().boundingBox(),
      article(page).locator(".article-text > ol > li").first().boundingBox(),
    ]);
    expect(Math.abs(item!.x - paragraph!.x)).toBeLessThanOrEqual(1);
    // The measure gives way before the margins do, as in Apple Books (decision 0044).
    const [text, scroller] = await Promise.all([
      article(page).locator(".article").boundingBox(),
      article(page).locator(".reading-scroller").boundingBox(),
    ]);
    expect(text!.x - scroller!.x).toBeGreaterThanOrEqual(56);
    expect(scroller!.x + scroller!.width - (text!.x + text!.width)).toBeGreaterThanOrEqual(56);
  });

  test("with reduced motion, the bar's title doesn't rise: it's simply there once the title has gone (decision 0302)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openRoom(page);
    await page.setViewportSize({ width: 1280, height: 420 });
    await openFirst(page);
    const bar = article(page).locator(".reading-bar");
    const scroller = article(page).locator(".reading-scroller");
    const heading = article(page).locator(".article-title");
    const running = bar.locator(".running-title");
    // Just after the title's foot has gone under the bar: no copy on its way up.
    const [barBox, box] = [(await bar.boundingBox())!, (await heading.boundingBox())!];
    await scroller.evaluate((element, foot) => element.scrollBy(0, foot + 6), box.y + box.height - barBox.y - barBox.height);
    await expect(running).toHaveCount(1);
    await expect(running.locator(".running-words")).toHaveCSS("transform", "none");
    // A little short of that, nothing at all.
    await scroller.evaluate((element) => element.scrollBy(0, -12));
    await expect(running).toHaveCount(0);
  });

  test("a summary-only article ends with a small centred note under the closing rule, and the page's one main button to read it on the publisher's site", async ({ page }) => {
    await openRoom(page);
    await row(page, "Only the first page").click();
    const note = article(page).locator(".article-note");
    await expect(note).toContainText("Only the beginning is shared here. Read the rest on Reading Room");
    // End matter, as in a book: small upright interface type, centred (decision 0040).
    expect(await note.evaluate((element) => getComputedStyle(element).fontFamily)).not.toContain("Literata");
    await expect(note).toHaveCSS("font-style", "normal");
    await expect(note).toHaveCSS("text-align", "center");
    await expect(note).toHaveCSS("font-size", /^(13|15)px$/);
    // The way on is the page's one main button, filled in a deep tone of the ink (decision 0298).
    expect(await note.evaluate((element) => getComputedStyle(element).textDecorationLine)).toBe("none");
    const link = note.getByRole("link", { name: "Read the rest on Reading Room" });
    await expect(link).toHaveClass(/btn-primary/);
    await expect(link).toHaveCSS("text-decoration-line", "none");
    // A row of its own under the sentence, centred, at least 44px tall to press, its words on one line where they fit.
    await expect(link).toHaveCSS("display", "flex");
    const [box, sentence] = await Promise.all([link.boundingBox(), note.locator("span").first().boundingBox()]);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.y).toBeGreaterThanOrEqual(sentence!.y + sentence!.height - 1);
    expect(await link.evaluate((element) => element.getClientRects().length)).toBe(1);
    await expect(link).toHaveAttribute("href", "https://reading-room.example/first-page");
    await expect(link).toHaveAttribute("target", "_blank");
    // It comes after the short closing line; then Write back, the article's last word (SPEC section 37).
    expect(await note.evaluate((element) => element.previousElementSibling?.classList.contains("article-end"))).toBe(true);
    expect(await note.evaluate((element) => element.nextElementSibling?.classList.contains("write-back"))).toBe(true);
    // Then only the credit line that shows on paper alone (decision 0236).
    expect(await note.evaluate((element) => element.nextElementSibling?.nextElementSibling?.className)).toBe("print-credit");
    await expect(article(page).locator(".print-credit")).toBeHidden();
  });

  test("an article whose feed has only its title says so, with the publisher's site as the way on (decision 0305)", async ({ page }) => {
    // The feed's text answered as empty, as a feed that shares only titles would.
    await page.route("**/api/articles/*", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      if (body?.article?.title === "Only the first page") Object.assign(body.article, { content: null, summary: null });
      await route.fulfill({ response, json: body });
    });
    await openRoom(page);
    await row(page, "Only the first page").click();
    const note = article(page).locator(".article-note");
    await expect(note).toContainText("Only the title is in the feed. Read it on Reading Room");
    await expect(note.getByRole("link", { name: "Read it on Reading Room" })).toHaveAttribute("href", "https://reading-room.example/first-page");
    expect(await note.evaluate((element) => element.previousElementSibling?.classList.contains("article-end"))).toBe(true);
    await expect(article(page).getByText("View original")).toHaveCount(0);
  });

  test("a writer in someone else's publication reads \"Writer / Publication\": the slash faint and unheard, \"by\" and \"in\" heard but unseen (decision 0323)", async ({ page }) => {
    // The feed's article answered as written by someone besides Asha Rao, the feed's own name, as a magazine's would be.
    await page.route("**/api/articles/*", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      if (body?.article) body.article.author = "Mina Okafor";
      await route.fulfill({ response, json: body });
    });
    await openRoom(page);
    await openFirst(page);
    const byline = article(page).locator(".article-byline");
    await expect(byline).toContainText(/by\s*Mina Okafor\s*in\s*\/\s*Asha Rao/);
    const crumb = byline.locator(".crumb");
    await expect(crumb).toHaveAttribute("aria-hidden", "true");
    await expect(crumb).toBeVisible();
    // Room on each side of it, more than a plain space (Rohit, 20 November 2026).
    expect(parseFloat(await crumb.evaluate((element) => getComputedStyle(element).marginLeft))).toBeGreaterThanOrEqual(4);
    expect(parseFloat(await byline.locator(".crumb-room").evaluate((element) => getComputedStyle(element).wordSpacing))).toBeGreaterThanOrEqual(4);
    // What a screen reader is given: the words with spaces between them, and no slash.
    await expect(byline).toMatchAriaSnapshot(`
      - paragraph:
        - text: by Mina Okafor in
        - link "Asha Rao"
        - text: ","
        - time: /.+/
    `);
    const [crumbColor, faint] = await Promise.all([
      crumb.evaluate((element) => getComputedStyle(element).color),
      page.evaluate(() => {
        const probe = document.createElement("span");
        probe.style.color = "var(--faint)";
        document.body.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      }),
    ]);
    expect(crumbColor).toBe(faint);
    await expect(byline.getByRole("link", { name: "Asha Rao" })).toBeVisible();
  });

  test("a whole article ends with a small ◆ on a line of its own, centred under its last words, never copied; a summary has none (decisions 0298, 0302)", async ({ page }) => {
    await openRoom(page);
    await row(page, "The pleasure of a slow letter").click();
    const ending = article(page).locator(".article-text.ends");
    await expect(ending).toHaveCount(1);
    expect(await ending.evaluate((element) => getComputedStyle(element, "::after").content)).toContain("◆");
    expect(await ending.evaluate((element) => getComputedStyle(element, "::after").display)).toBe("block");
    expect(await ending.evaluate((element) => getComputedStyle(element, "::after").textAlign)).toBe("center");
    // Drawn, not written: it's not in the text, so it's never copied, highlighted or read aloud.
    expect(await article(page).locator(".article-text").innerText()).not.toContain("◆");
    await toList(page);
    await row(page, "Only the first page").click();
    await expect(title(page, "Only the first page")).toBeVisible();
    await expect(article(page).locator(".article-text.ends")).toHaveCount(0);
  });

  test("a big picture opens larger, alone on a dimmed sheet; Escape closes it and the keyboard is back on the picture (decision 0107)", async ({ page }) => {
    await openRoom(page);
    await row(page, "A third, shorter note").click();
    const picture = article(page).getByRole("button", { name: "Open picture larger: Two hills at dusk, drawn in greys" });
    await expect(picture).toBeVisible();
    await expect(picture).toHaveCSS("cursor", "pointer");

    // A picture shown at its full size, or inside a link, stays the publisher's picture, with nothing added.
    const stone = article(page).locator('img[alt="A small stone"]');
    const linked = article(page).locator('img[alt="The same hills, as a link"]');
    for (const other of [stone, linked]) {
      await expect.poll(() => other.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
      await expect(other).not.toHaveAttribute("role", "button");
      await expect(other).not.toHaveAttribute("tabindex");
    }
    // The linked one really is shown smaller, so only the link keeps it from opening.
    expect(await linked.evaluate((img: HTMLImageElement) => img.naturalWidth > img.clientWidth * 1.2)).toBe(true);

    // Tab reaches the picture from the article's title.
    await title(page, "A third, shorter note").focus();
    await tabTo(page, picture, 20);

    // A click opens it: alone, its alt text under it, an X and Open in a new tab.
    await picture.click();
    const sheet = page.getByRole("dialog", { name: "Picture: Two hills at dusk, drawn in greys" });
    await expect(sheet).toBeVisible();
    await expect(sheet.locator("figcaption")).toHaveText("Two hills at dusk, drawn in greys");
    // Drawn outside the article, it says the article's language itself.
    const language = await article(page).locator("article").getAttribute("lang");
    expect(language).toBeTruthy();
    await expect(sheet).toHaveAttribute("lang", language!);
    const close = sheet.getByRole("button", { name: "Close" });
    await expect(close).toHaveAttribute("title", "Close (Esc)");
    const closeBox = await close.boundingBox();
    expect(closeBox!.width).toBeGreaterThanOrEqual(44);
    expect(closeBox!.height).toBeGreaterThanOrEqual(44);
    const link = sheet.getByRole("link", { name: "Open in a new tab" });
    await expect(link).toHaveAttribute("href", /\/reading\/hills\.svg$/);
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(link).toHaveAttribute("target", "_blank");
    // As large as fits: bigger than in the article, never past the window.
    const [inArticle, opened] = await Promise.all([picture.boundingBox(), sheet.locator("img").boundingBox()]);
    expect(opened!.width).toBeGreaterThan(inArticle!.width);
    expect(opened!.x + opened!.width).toBeLessThanOrEqual(1280);
    expect(opened!.y + opened!.height).toBeLessThanOrEqual(800);

    // Escape closes it, and the keyboard is back on the picture.
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(picture).toBeFocused();

    // With the keyboard only: Enter opens it, the X closes it; Space opens it, a press on the dim closes it.
    await page.keyboard.press("Enter");
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "Close" }).press("Enter");
    await expect(sheet).toHaveCount(0);
    await expect(picture).toBeFocused();
    await page.keyboard.press(" ");
    await expect(sheet).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(sheet).toHaveCount(0);
    await expect(picture).toBeFocused();
  });

  test("a picture is looked at again when the window changes size; one that no longer opens larger gives the keyboard to the title on closing (decision 0107)", async ({ page }) => {
    // Alone in the window (decision 0275), the article has room for the field's 560px in any computer's window,
    // and a computer's window narrowed to a phone's shows the phone's home screen: so this starts at a phone's width.
    await openRoom(page, 390);
    await row(page, "A third, shorter note").click();
    const field = article(page).locator('img[alt="A wide field"]');
    await expect.poll(() => field.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    // In the phone's narrow column it's shown smaller, so it opens larger.
    await expect(field).toHaveAttribute("role", "button");
    await expect(field).toHaveAttribute("tabindex", "0");
    await field.click();
    const sheet = page.getByRole("dialog", { name: "Picture: A wide field" });
    await expect(sheet).toBeVisible();

    // Wide while it's open: the field fits the column, so it no longer opens larger, and closing puts the keyboard on the title.
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(field).not.toHaveAttribute("role", "button");
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(title(page, "A third, shorter note")).toBeFocused();
  });

  test("in high-contrast mode, only the selected article is marked", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await openRoom(page);
    // Opened and back in the list (decision 0275), its row still the chosen one; the keyboard elsewhere.
    await openFirst(page);
    await page.keyboard.press("Escape");
    await page.locator("#list-heading").focus();
    const style = (name: string) =>
      row(page, name).evaluate((element) => {
        const css = getComputedStyle(element);
        return { outline: css.outlineStyle, width: css.outlineWidth };
      });
    // The pill's fill gives way to the system's colors, so the selected row gets an edge instead.
    const selected = await style("The pleasure of a slow letter");
    expect(selected.outline).toBe("solid");
    expect(selected.width).toBe("2px");
    const other = await style("Only the first page");
    expect(other.outline).toBe("none");
    // The keyboard on the selected row draws a thicker outline still, never a thinner one.
    await row(page, "The pleasure of a slow letter").focus();
    await expect(row(page, "The pleasure of a slow letter")).toHaveCSS("outline-width", "3px");
  });

  test("after scrolling a long list, the panes still fill the window and only the list moves", async ({ page }) => {
    // The owner's photo (24 October 2026): scrolling a long list moved the whole
    // page, leaving the panes as a strip at the top and blank space below.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(new URL("/all", FEEDS_APP).href);
    await appReady(page);
    await signIn(page);
    // Quiet Notes has 60 articles: far more than one window holds.
    const id = await follow(page, `${FEED_SITE}/`);
    await page.goto(new URL(`/${id}`, FEEDS_APP).href);
    await expect(page.getByRole("button", { name: /\(\d+\)/ }).nth(30)).toBeAttached();

    const fillsWindow = () =>
      page.evaluate(() => {
        const main = document.querySelector("[role=main]")!.getBoundingClientRect();
        return {
          pageScroll: window.scrollY,
          pageTaller: document.documentElement.scrollHeight > window.innerHeight,
          top: main.top,
          bottom: Math.round(main.bottom) === window.innerHeight,
        };
      });
    const still = { pageScroll: 0, pageTaller: false, top: 0, bottom: true };
    expect(await fillsWindow()).toEqual(still);

    // Scroll the list with the mouse wheel, then walk far down it with j.
    const list = page.getByRole("region", { name: "Quiet Notes" }).locator(".overflow-y-auto");
    await list.hover();
    for (let i = 0; i < 15; i++) await page.mouse.wheel(0, 400);
    await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect(await fillsWindow()).toEqual(still);
    for (let i = 0; i < 40; i++) await page.keyboard.press("j");
    expect(await fillsWindow()).toEqual(still);

    // And over the article, too, opened alone in the window.
    await page.keyboard.press("Enter");
    await article(page).hover();
    for (let i = 0; i < 15; i++) await page.mouse.wheel(0, 400);
    expect(await fillsWindow()).toEqual(still);
  });

  test("+ and - change the text size while reading, and the Aa panel shows it", async ({ page }) => {
    await openRoom(page);
    await openFirst(page);
    const text = article(page).locator("article");
    const size = () => text.evaluate((element) => getComputedStyle(element).fontSize);
    await expect.poll(size).toBe("20px");

    await page.keyboard.press("+");
    await expect.poll(size).toBe("22px");
    await page.keyboard.press("-");
    await page.keyboard.press("-");
    await expect.poll(size).toBe("18px");

    // The same setting as the Aa panel's, the one place for it (decision 0241).
    await expect((await openAppearance(page)).getByRole("status")).toHaveText("Small");
  });

  test("a YouTube video plays in YouTube's own player, and nothing loads from YouTube until Play is pressed", async ({ page }) => {
    // Stand in for YouTube's player, so the test never leaves this computer. Asked to talk, it says it's
    // paused at 4:00 of 10:00, or, started from there, that it ended.
    const asked: string[] = [];
    await page.route(/youtube/, (route) => {
      asked.push(route.request().url());
      const say = (info: string) => `<p>YouTube's player</p><script>
        addEventListener("message", () => parent.postMessage(JSON.stringify(${info}), "*"));
      </script>`;
      const ended = route.request().url().includes("start=240");
      return route.fulfill({
        contentType: "text/html",
        body: say(ended ? `{ event: "onStateChange", info: 0 }` : `{ event: "infoDelivery", info: { currentTime: 240, duration: 600, playerState: 2 } }`),
      });
    });
    const PLAYER = /^https:\/\/www\.youtube-nocookie\.com\/embed\/AAAAAAAAAAA\?autoplay=1&rel=0&enablejsapi=1&origin=/;
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(new URL("/all", FEEDS_APP).href);
    await appReady(page);
    await signIn(page);
    const id = await follow(page, `${FEED_SITE}/videos/`);
    await page.goto(new URL(`/${id}`, page.url()).href);
    await row(page, "A river at dawn").click();

    // The video waits in a box drawn in ink, with Play and nothing else (the title is the page's own, decision 0324).
    const play = article(page).getByRole("button", { name: "Play video: A river at dawn, for an hour" });
    await expect(play).toBeVisible();
    await expect(play).toHaveText("Play video");
    // Under it, two closed words: the description and the chapters stay out of the way until asked for.
    const chaptersWord = article(page).getByRole("button", { name: /^Chapters/ });
    const descriptionWord = article(page).getByRole("button", { name: "Description" });
    await expect(chaptersWord).toHaveAttribute("aria-expanded", "false");
    await expect(descriptionWord).toHaveAttribute("aria-expanded", "false");
    await expect(article(page).getByText("Nothing happens, slowly.")).toBeHidden();
    const chapters = article(page).getByRole("list", { name: "Chapters", includeHidden: true });
    await expect(chapters).toBeHidden();
    // Chapters opens a contents page: each name, then its time; each a button.
    await chaptersWord.press("Enter");
    await expect(chaptersWord).toHaveAttribute("aria-expanded", "true");
    await expect(chapters.getByRole("button")).toHaveText([/^First light\s*0:00$/, /^The heron\s*4:00$/, /^Mist lifts\s*41:30$/]);
    await expect(chapters.getByRole("button", { name: "The heron 4:00" })).toBeVisible();
    // Description swaps them: one open at a time.
    await descriptionWord.click();
    await expect(descriptionWord).toHaveAttribute("aria-expanded", "true");
    await expect(chaptersWord).toHaveAttribute("aria-expanded", "false");
    await expect(chapters).toBeHidden();
    await expect(article(page).getByText("Nothing happens, slowly.")).toBeVisible();
    await expect(article(page).getByText("Filmed on one still morning", { exact: false })).toBeVisible();
    // Pressed again, it closes; this device remembers it closed.
    await descriptionWord.click();
    await expect(article(page).getByText("Nothing happens, slowly.")).toBeHidden();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("nine-turtles.video-open"))).toBeNull();
    const box = await play.boundingBox();
    expect(Math.round((box!.width / box!.height) * 9)).toBe(16);
    expect(asked).toEqual([]);

    // Pressed, YouTube's privacy-enhanced player takes the button's place and the keyboard.
    await play.press("Enter");
    const player = article(page).locator("iframe");
    await expect(player).toHaveAttribute("src", PLAYER);
    await expect(player).toHaveAttribute("title", "YouTube video: A river at dawn, for an hour");
    await expect(player).toBeFocused();
    // Sandboxed, and told only nine turtles' address, never the article's.
    await expect(player).toHaveAttribute("referrerpolicy", "strict-origin");
    await expect(player).toHaveAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox");
    await expect(page.frameLocator("iframe").getByText("YouTube's player")).toBeVisible();
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatch(PLAYER);
    expect(Math.round((await player.boundingBox())!.height)).toBe(Math.round(box!.height));

    // A video with no description is just the video, never "Only the title is in the feed".
    await toList(page);
    await row(page, "Rain on a tin roof").click();
    const rain = article(page).getByRole("button", { name: "Play video: Rain on a tin roof" });
    await expect(rain).toBeVisible();
    await expect(article(page).locator("iframe")).toHaveCount(0);
    await expect(article(page).getByText("Only the title is in the feed")).toHaveCount(0);

    // Space plays it too. (Tab out of the player is the browser's own frame
    // handling, which differs between runs, so it isn't asserted here.)
    await rain.focus();
    await page.keyboard.press(" ");
    await expect(article(page).locator("iframe")).toBeFocused();

    // Back to the first video: it picks up where the player said it stopped, and closes when it ends.
    await toList(page);
    await row(page, "A river at dawn").click();
    const resume = article(page).getByRole("button", { name: "Resume from 4:00: A river at dawn, for an hour" });
    await expect(resume).toContainText("Resume from 4:00");
    // This stand-in ends at once when started from 4:00, so the frame may already be gone by the time
    // it's looked for: what was asked of YouTube is the proof it started from there.
    await resume.click();
    await expect.poll(() => asked.at(-1)).toMatch(/&start=240&/);
    const again = article(page).getByRole("button", { name: "Play video: A river at dawn, for an hour" });
    await expect(again).toBeFocused();
    await expect(article(page).locator("iframe")).toHaveCount(0);

    // A chapter, from the keyboard alone, plays the video from there (and this stand-in ends it there).
    await article(page).getByRole("button", { name: /^Chapters/ }).press("Enter");
    await article(page).getByRole("list", { name: "Chapters" }).getByRole("button", { name: "The heron 4:00" }).focus();
    const before = asked.length;
    await page.keyboard.press("Enter");
    await expect.poll(() => asked.length).toBe(before + 1);
    expect(asked.at(-1)).toMatch(/&start=240&/);
    await expect(again).toBeFocused();
  });

  test("a YouTube video plays at the speed last chosen in one (decision 0156)", async ({ page }) => {
    // Stand in for YouTube's player: it plays at 1× until told otherwise, says its speed when asked to talk
    // and when it changes, keeps every command it's sent, and `choose(rate)` is the reader using its own menu.
    await page.route(/youtube/, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<p>YouTube's player</p><script>
          let rate = 1;
          window.commands = [];
          const say = (message) => parent.postMessage(JSON.stringify(message), "*");
          window.choose = (to) => { rate = to; say({ event: "onPlaybackRateChange", info: rate }); };
          addEventListener("message", (event) => {
            const message = JSON.parse(event.data);
            if (message.event === "listening") say({ event: "infoDelivery", info: { currentTime: 0, duration: 600, playerState: 1, playbackRate: rate } });
            if (message.event === "command") {
              window.commands.push(message.func + " " + JSON.stringify(message.args));
              if (message.func === "setPlaybackRate") window.choose(message.args[0]);
            }
          });
        </script>`,
      }),
    );
    const kept = () => page.evaluate(() => localStorage.getItem("nine-turtles.video-speed"));
    const player = async () => (await article(page).locator("iframe").elementHandle())!.contentFrame();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(new URL("/all", FEEDS_APP).href);
    await appReady(page);
    await signIn(page);
    const id = await follow(page, `${FEED_SITE}/videos/`);
    await page.goto(new URL(`/${id}`, page.url()).href);

    // The first video plays at YouTube's own 1×, which isn't taken as a choice; choosing 1.5× in its menu is kept.
    await toList(page);
    await row(page, "A river at dawn").click();
    await article(page).getByRole("button", { name: /^(Play video|Resume from [\d:]+): A river at dawn, for an hour$/ }).press("Enter");
    const first = (await player())!;
    await expect.poll(() => first.evaluate(() => (window as unknown as { commands: string[] }).commands)).toContain('addEventListener ["onPlaybackRateChange"]');
    expect(await first.evaluate(() => (window as unknown as { commands: string[] }).commands)).not.toContainEqual(expect.stringMatching(/^setPlaybackRate/));
    expect(await kept()).toBeNull();
    await first.evaluate(() => (window as unknown as { choose: (rate: number) => void }).choose(1.5));
    await expect.poll(kept).toBe("1.5");

    // (The test before may have left a place in either video.) The next video, played from the keyboard, is given 1.5×, and its starting 1× doesn't undo the choice.
    await toList(page);
    await row(page, "Rain on a tin roof").click();
    await article(page).getByRole("button", { name: /^(Play video|Resume from [\d:]+): Rain on a tin roof$/ }).press(" ");
    const next = (await player())!;
    await expect.poll(() => next.evaluate(() => (window as unknown as { commands: string[] }).commands)).toContain("setPlaybackRate [1.5]");
    expect(await kept()).toBe("1.5");

    // Back to 1× forgets it.
    await next.evaluate(() => (window as unknown as { choose: (rate: number) => void }).choose(1));
    await expect.poll(kept).toBeNull();
  });
});

test("on a phone, an article fills the screen and the back button returns to the list", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the phone layout only");
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await openReadingRoom(page);

  await row(page, "The pleasure of a slow letter").click();
  await expect(title(page, "The pleasure of a slow letter")).toBeFocused();
  await expect(page.getByRole("region", { name: "Asha Rao" })).toBeHidden();
  // A heading's first step is smaller on a phone, so it stays clearly under even a long title (1.6 times): 1.35 times 18px (decision 0295).
  await expect(article(page).locator(".article-text h2").first()).toHaveCSS("font-size", "24.3px");

  await article(page).getByRole("button", { name: "Back to Asha Rao" }).click();
  await expect(row(page, "The pleasure of a slow letter")).toBeFocused();
  await expect(article(page)).toBeHidden();
});

test("on a phone, a tap opens a big picture larger, inside the screen, and the X closes it (decision 0107)", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the phone layout only");
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await openReadingRoom(page);

  await row(page, "A third, shorter note").click();
  const picture = article(page).getByRole("button", { name: "Open picture larger: Two hills at dusk, drawn in greys" });
  await expect(picture).toBeVisible();
  await expect(article(page).locator('img[alt="The same hills, as a link"]')).not.toHaveAttribute("role", "button");
  await picture.tap();
  const sheet = page.getByRole("dialog", { name: "Picture: Two hills at dusk, drawn in greys" });
  await expect(sheet).toBeVisible();
  const viewport = page.viewportSize()!;
  const opened = await sheet.locator("img").boundingBox();
  expect(opened!.x).toBeGreaterThanOrEqual(0);
  expect(opened!.x + opened!.width).toBeLessThanOrEqual(viewport.width);
  expect(opened!.y + opened!.height).toBeLessThanOrEqual(viewport.height);
  await expect(sheet.getByRole("link", { name: "Open in a new tab" })).toBeVisible();
  const close = sheet.getByRole("button", { name: "Close" });
  const closeBox = await close.boundingBox();
  expect(closeBox!.width).toBeGreaterThanOrEqual(44);
  expect(closeBox!.height).toBeGreaterThanOrEqual(44);
  await close.tap();
  await expect(sheet).toHaveCount(0);
  await expect(picture).toBeFocused();
});

test.describe("your place in an article (decision 0060)", () => {
  test.skip(({ isMobile }) => isMobile, "the same reading area on a phone; the computer's is enough");

  const scroller = (page: Page) => article(page).locator(".reading-scroller");
  const top = (page: Page) => scroller(page).evaluate((element) => element.scrollTop);

  test("an article you stopped part of the way through opens where you were, even after a reload; one you finished opens at its top", async ({ page }) => {
    // A short window, so the Reading Room's long article runs to several screens.
    await openRoom(page);
    await page.setViewportSize({ width: 1280, height: 400 });
    await row(page, "The pleasure of a slow letter").click();
    await expect(title(page, "The pleasure of a slow letter")).toBeVisible();
    await expect(article(page).locator("table")).toBeAttached();
    expect(await top(page)).toBe(0);

    await scroller(page).hover();
    // Past the title and the room above it (decision 0302), into the middle of a paragraph.
    await page.mouse.wheel(0, 592);
    await expect.poll(() => top(page)).toBeGreaterThan(450);
    // Written down a moment after scrolling stops.
    await page.waitForTimeout(600);
    const stopped = await top(page);
    // Back in the list, its row says how far, in words, while the place is kept (decision 0224).
    await page.keyboard.press("Escape");
    const far = /^·\s(Just begun|A third read|Half read|Two-thirds read|Nearly finished)$/;
    await expect(row(page, "The pleasure of a slow letter").locator(".row-place")).toHaveText(far);
    await expect(row(page, "Only the first page").locator(".row-place")).toHaveCount(0);

    await row(page, "Only the first page").click();
    await expect(title(page, "Only the first page")).toBeVisible();
    expect(await top(page)).toBe(0);
    await page.keyboard.press("Escape");
    await row(page, "The pleasure of a slow letter").click();
    await expect(title(page, "The pleasure of a slow letter")).toBeVisible();
    await expect.poll(() => top(page)).toBeGreaterThan(stopped - 8);
    expect(await top(page)).toBeLessThan(stopped + 8);

    await page.reload();
    await appReady(page);
    // The reload opens the article named in the address, alone (decision 0275): back to the list.
    await expect(title(page, "The pleasure of a slow letter")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(row(page, "The pleasure of a slow letter").locator(".row-place")).toHaveText(far);
    await row(page, "The pleasure of a slow letter").click();
    await expect.poll(() => top(page)).toBeGreaterThan(stopped - 8);
    expect(await top(page)).toBeLessThan(stopped + 8);

    // Read to the end: next time it starts again at its top, as a finished book does.
    await scroller(page).hover();
    await page.mouse.wheel(0, 5000);
    await expect.poll(() => scroller(page).evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThan(2);
    await page.waitForTimeout(600);
    await page.keyboard.press("Escape");
    await row(page, "Only the first page").click();
    await expect(title(page, "Only the first page")).toBeVisible();
    await page.keyboard.press("Escape");
    await row(page, "The pleasure of a slow letter").click();
    await expect(title(page, "The pleasure of a slow letter")).toBeVisible();
    await expect(article(page).locator("table")).toBeAttached();
    await page.waitForTimeout(200);
    expect(await top(page)).toBe(0);
    // Finished, its row no longer says how far.
    await page.keyboard.press("Escape");
    await expect(row(page, "The pleasure of a slow letter").locator(".row-place")).toHaveCount(0);
  });

  test("coming back, the article you left part of the way through is offered in one quiet line, and opens where you were (decision 0175)", async ({ page }) => {
    await openRoom(page);
    await page.setViewportSize({ width: 1280, height: 400 });
    await row(page, "The pleasure of a slow letter").click();
    await expect(article(page).locator("table")).toBeAttached();
    // Where you left off reaches the server a moment after scrolling stops; leaving before it has would
    // test nothing (a busy computer can take longer than any fixed wait).
    const kept = page.waitForResponse((answer) => answer.url().endsWith("/api/resume") && answer.request().method() === "PUT");
    await scroller(page).hover();
    // Past the title and the room above it (decision 0302), into the middle of a paragraph.
    await page.mouse.wheel(0, 592);
    await expect.poll(() => top(page)).toBeGreaterThan(450);
    await kept;
    const stopped = await top(page);
    // Coming back after half an hour away (decision 0292). Leaving a page writes down the time as it goes, so the
    // time away is set as the next page starts.
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("away")) return;
      sessionStorage.removeItem("away");
      localStorage.setItem("nine-turtles.here", String(Date.now() - 31 * 60_000));
    });
    const away = () => page.evaluate(() => sessionStorage.setItem("away", "yes"));
    // Another device: this one's own bookmarks are gone, but the server still knows.
    await page.evaluate(() => localStorage.removeItem("nine-turtles.places"));
    await away();

    await page.goto(new URL("/all", page.url()).href);
    await appReady(page);
    // Nothing open: the line sits at the top of the list (decision 0275).
    const line = page.locator("#list-pane .reading-empty");
    await expect(line).toHaveText(/^You were reading The pleasure of a slow letter(, by .+)?\.$/);
    // Only on the first list you come back to (decision 0292): another list ends it, going back doesn't bring it back...
    await page.locator("#sidebar").getByRole("link", { name: "Saved" }).click();
    await expect(page.locator("#list-pane")).not.toContainText("You were reading");
    await page.locator("#sidebar").getByRole("link", { name: "All articles" }).click();
    await expect(page.locator(".item-row").first()).toBeVisible();
    await expect(page.locator("#list-pane")).not.toContainText("You were reading");
    // ...and nor does a refresh, which isn't coming back. Half an hour away is.
    await page.reload();
    await appReady(page);
    await expect(page.locator(".item-row").first()).toBeVisible();
    await expect(page.locator("#list-pane")).not.toContainText("You were reading");
    // Coming back to a page that isn't a list, such as Add a feed: the list you go to next doesn't offer it either.
    await away();
    await page.goto(new URL("/add", page.url()).href);
    await appReady(page);
    await expect(page.getByRole("heading", { level: 2, name: "Add a person or publication" })).toBeVisible();
    await page.keyboard.press("Escape");
    // Where the app opens, Saved (decision 0310), which may hold nothing yet: its title shows it's there.
    await expect(page.locator("#list-heading")).toBeVisible();
    await expect(page.locator("#list-pane")).not.toContainText("You were reading");
    await away();
    await page.reload();
    await appReady(page);
    await expect(line).toHaveText(/^You were reading The pleasure of a slow letter(, by .+)?\.$/);
    // The title is the way in, from the keyboard too.
    const title_ = line.getByRole("button", { name: "The pleasure of a slow letter" });
    await title_.focus();
    await page.keyboard.press("Enter");
    await expect(title(page, "The pleasure of a slow letter")).toBeVisible();
    await expect.poll(() => top(page)).toBeGreaterThan(stopped - 8);
    expect(await top(page)).toBeLessThan(stopped + 8);

    // Opening something else lets it go: next time, no line.
    await page.keyboard.press("Escape");
    await row(page, "Only the first page").click();
    await expect(title(page, "Only the first page")).toBeVisible();
    await page.waitForTimeout(300);
    await away();
    await page.goto(new URL("/all", page.url()).href);
    await appReady(page);
    await expect(page.locator(".item-row").first()).toBeVisible();
    await expect(page.locator("#list-pane")).not.toContainText("You were reading");
  });
});

// Decision 0220: every list opens the same quiet way, its first article unread or not: no begun
// first article, no Start reading, and nothing opens by itself.
test("an unread first article waits in the list as every other does, in Unread too", async ({ page }) => {
  await nothingToPickUp(page);
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await openReadingRoom(page, { unread: true });
  for (const path of [null, "/unread"]) {
    if (path) {
      await page.goto(new URL(path, page.url()).href);
      await appReady(page);
      await expect(page.locator(".item-row").first()).toBeVisible();
    }
    await expect(page.locator(".item-row").first()).toContainText(", unread");
    // The first row's title is the same size as the second's: it isn't drawn larger, as a begun row was.
    const sizes = await page.locator(".item-row .title").evaluateAll((titles) => titles.slice(0, 2).map((each) => getComputedStyle(each).fontSize));
    expect(sizes[0]).toBe(sizes[1]);
    await expect(page.getByText(/^(Newest|Oldest) unread$/)).toHaveCount(0);
    await expect(page.getByText("Start reading", { exact: true })).toHaveCount(0);
    await expect(article(page)).toHaveCount(0);
  }
});
