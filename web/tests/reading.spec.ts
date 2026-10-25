import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, openReadingRoom, signIn, tabTo } from "./screens";

// SPEC section 7 (and 19 and 21), "How to check it", done by a browser, on
// the made-up Reading Room blog (tests/feed-server.mjs).

const article = (page: Page) => page.getByRole("region", { name: "Article" });
const title = (page: Page, name: string) => article(page).getByRole("heading", { level: 2, name });
const row = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(name) });

async function openRoom(page: Page, width = 1280) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await openReadingRoom(page);
}

async function visits(page: Page, path: string): Promise<number> {
  const response = await page.request.get(`${FEED_SITE}/visits`);
  const counts = (await response.json()) as Record<string, number>;
  return counts[path] ?? 0;
}

test.describe("on a wide window", () => {
  test.skip(({ isMobile }) => isMobile, "the phone layout has its own test below");

  test("] hides and shows the article list, and \\ both; with both hidden one button brings both back", async ({ page }) => {
    await openRoom(page);
    const list = page.locator("#list-pane");
    const listButton = page.getByRole("button", { name: "Article list", exact: true });
    await expect(listButton).toBeVisible();

    await page.keyboard.press("]");
    await expect(list).toBeHidden();
    await page.keyboard.press("]");
    await expect(list).toBeVisible();

    await page.keyboard.press("\\");
    await expect(list).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Sidebar" })).toBeHidden();
    await expect(listButton).toHaveCount(0);
    await page.getByRole("button", { name: "Sidebar and article list" }).click();
    await expect(list).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Sidebar" })).toBeVisible();
  });

  test("j shows an article cleaned and restyled, and j and k move through the list", async ({ page }) => {
    await openRoom(page);
    // One quiet line in the middle of the paper (decision 0053): serif, muted grey, never the
    // accent; screen readers also hear, since the list has articles to open, how to open one.
    const empty = article(page).locator(".reading-empty");
    await expect(empty).toHaveText("No article open");
    await expect(empty).toBeVisible();
    await expect(empty).toHaveCSS("font-family", /Literata/);
    const [color, muted] = await empty.evaluate((element) => {
      const probe = document.createElement("div");
      probe.style.color = "var(--muted)";
      document.body.append(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return [getComputedStyle(element).color, value];
    });
    expect(color).toBe(muted);
    const [line, pane] = await Promise.all([empty.boundingBox(), article(page).boundingBox()]);
    expect(Math.abs(line!.x + line!.width / 2 - (pane!.x + pane!.width / 2))).toBeLessThan(4);
    expect(Math.abs(line!.y + line!.height / 2 - (pane!.y + pane!.height / 2))).toBeLessThan(4);
    await expect(article(page)).toContainText("Choose one from the list, or press j.");
    await expect(article(page).locator(".sr-only", { hasText: "Choose one from the list" })).toHaveCSS("position", "absolute");
    await expect(article(page).locator("kbd")).toHaveCount(0);

    await page.keyboard.press("j");
    await expect(row(page, "The pleasure of a slow letter")).toHaveAttribute("aria-current", "true");
    await expect(row(page, "The pleasure of a slow letter")).toBeFocused();
    await expect(title(page, "The pleasure of a slow letter")).toBeVisible();

    // The title comes first, then the byline under it; the article ends with a short line.
    const byline = (await article(page).locator(".article-byline").boundingBox())!;
    expect(byline.y).toBeGreaterThan((await title(page, "The pleasure of a slow letter").boundingBox())!.y);
    await expect(article(page).locator("hr.article-end")).toBeAttached();

    // Headings, quotes, tables, code and the publisher's image, in place.
    const text = article(page).locator(".article-text");
    await expect(text.getByRole("heading", { name: "What a slow reader keeps" })).toBeVisible();
    await expect(text.locator("blockquote")).toContainText("Reading is a conversation");
    await expect(text.getByRole("table")).toBeVisible();
    await expect(text.locator("pre")).toContainText("read(book, slowly=True)");
    const image = article(page).getByRole("img", { name: "A river drawn as three blue lines" });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

    // Credit: the source links to the publisher, with the author and time.
    await expect(article(page).getByRole("link", { name: "Reading Room" })).toHaveAttribute("href", "https://reading-room.example/");
    await expect(article(page).getByText("Asha Rao")).toBeVisible();
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
    await expect(article(page).getByText("This feed shares only a summary.")).toBeVisible();

    await page.keyboard.press("k");
    await expect(title(page, "The pleasure of a slow letter")).toBeVisible({ timeout: 100 });
  });

  test("a screen reader finds the three panes as named regions, and headings to jump between", async ({ page }) => {
    await openRoom(page);
    await page.keyboard.press("j");
    await expect(title(page, "The pleasure of a slow letter")).toBeVisible();

    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Sidebar" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Reading Room" })).toBeVisible();
    await expect(article(page)).toBeVisible();
    // One page title, then a heading for the list and one for the article.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("nine turtles");
    await expect(page.getByRole("heading", { level: 2, name: "Reading Room" })).toBeVisible();
    // The selected row says it's the current one.
    await expect(page.locator('[aria-current="true"]')).toHaveCount(1);
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

    // The arrow keys work like j and k in the list.
    await page.keyboard.press("ArrowDown");
    await expect(row(page, "A third, shorter note")).toBeFocused();
    await expect(title(page, "A third, shorter note")).toBeVisible();
  });

  test("a click shows an article, and Open original and v open the publisher's page in a new tab", async ({ page, context }) => {
    await context.route("https://reading-room.example/**", (route) =>
      route.fulfill({ contentType: "text/html", body: "<title>The original</title>" }),
    );
    await openRoom(page);
    await row(page, "Only the first page").click();
    await expect(title(page, "Only the first page")).toBeVisible();

    const original = article(page).getByRole("link", { name: "Open original" }).first();
    // The actions are quiet icons, each named in its tooltip with its key; the way to the publisher comes first,
    // then Aa, Star and More (decision 0038).
    const order = await article(page)
      .locator(".reading-bar")
      .locator("a[aria-label], button[aria-label]")
      .evaluateAll((controls) => controls.map((control) => control.getAttribute("aria-label")));
    expect(order).toEqual(["Open original", "Reading appearance", "Star", "More actions"]);
    expect((await original.innerText()).trim()).toBe("");
    await expect(article(page).getByRole("button", { name: "Star" })).toHaveAttribute("title", "Star (s)");
    await expect(original).toHaveAttribute("title", "Open original (v)");
    // More holds Copy link and Mark unread, its key shown beside it.
    const more = article(page).getByRole("button", { name: "More actions" });
    await expect(more).toHaveAttribute("aria-haspopup", "menu");
    await more.click();
    const menu = page.getByRole("menu", { name: "More actions" });
    await expect(menu.getByRole("menuitem")).toHaveText([/Copy link/, /Mark unread/]);
    await expect(menu.getByRole("menuitem", { name: "Mark unread" })).toHaveAttribute("aria-keyshortcuts", "m");
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
    await page.keyboard.press("j");
    await article(page).getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Copy link" }).click();
    await expect(article(page).getByRole("status")).toHaveText("Link copied.");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("https://reading-room.example/slow-letter");
  });

  test("the Aa panel changes text size, appearance, font and line width at once; Escape closes it", async ({ page }) => {
    await openRoom(page);
    await page.keyboard.press("j");
    const aa = article(page).getByRole("button", { name: "Reading appearance" });
    await expect(aa).toHaveAttribute("aria-haspopup", "dialog");
    await expect(aa).toHaveAttribute("aria-expanded", "false");
    await aa.click();
    const panel = page.getByRole("dialog", { name: "Reading appearance" });
    await expect(panel).toBeVisible();
    await expect(aa).toHaveAttribute("aria-expanded", "true");
    // A popover under its button, lined up with its right edge.
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

    // Appearance: day, night or as the device is set, applied at once. No theme tiles (decision 0056).
    await expect(panel.getByRole("group", { name: "Appearance" }).getByRole("radio")).toHaveCount(3);
    await expect(panel.getByRole("radio", { name: "Match device" })).toBeChecked();
    await expect(panel.getByRole("group", { name: "Theme" })).toHaveCount(0);
    await panel.getByRole("radio", { name: "Light", exact: true }).check();
    await expect(root).toHaveAttribute("data-theme", "original");
    await expect(root).toHaveAttribute("data-mode", "light");
    await panel.getByRole("radio", { name: "Dark", exact: true }).check();
    await expect(root).toHaveAttribute("data-mode", "dark");
    await panel.getByRole("radio", { name: "Match device" }).check();
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
    // Fonts are named in their own face; line width has three steps.
    await panel.getByRole("radio", { name: "Atkinson Hyperlegible" }).check();
    await expect.poll(() => root.evaluate((html) => html.style.getPropertyValue("--reading-font"))).toContain("Atkinson");
    await expect(text).toHaveCSS("font-weight", "400");
    const measure = () => root.evaluate((html) => html.style.getPropertyValue("--reading-measure"));
    const medium = await measure();
    await panel.getByRole("radio", { name: "Wide" }).check();
    await expect.poll(measure).not.toBe(medium);

    // The keyboard's outline is in the text color, never the accent.
    await panel.getByRole("radio", { name: "Light", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowLeft");
    await expect(panel.getByRole("radio", { name: "Light", exact: true })).toBeChecked();
    const [outline, ink] = await panel
      .getByRole("radio", { name: "Light", exact: true })
      .evaluate((input) => [getComputedStyle(input.closest("label")!).outlineColor, getComputedStyle(document.body).color]);
    expect(outline).toBe(ink);

    // Escape closes only the panel and gives the keyboard back to the Aa button; the article stays.
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(aa).toBeFocused();
    await expect(aa).toHaveAttribute("aria-expanded", "false");
    await expect(title(page, "The pleasure of a slow letter")).toBeVisible();

    // A press outside closes it too, and Settings shows the same choices.
    await aa.click();
    await expect(panel).toBeVisible();
    await title(page, "The pleasure of a slow letter").click({ position: { x: 4, y: 4 } });
    await expect(panel).toHaveCount(0);
    await page.getByRole("navigation", { name: "Sidebar" }).getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("region", { name: "Look and feel" }).getByRole("radio", { name: "Light", exact: true })).toBeChecked();
    await expect(page.getByRole("region", { name: "Look and feel" }).getByRole("radio", { name: "Wide" })).toBeChecked();
    await expect(page.getByText("The Aa button above an article changes these too")).toBeVisible();
  });

  test("a footnote link stays inside the article", async ({ page }) => {
    await openRoom(page);
    await page.keyboard.press("j");
    const text = article(page).locator(".article-text");
    await text.locator("sup").getByRole("link", { name: "1" }).click();
    await expect(text.getByText("1. Written in Python, a long time ago.")).toBeFocused();
    await expect(page).toHaveURL(/\/feeds\/[0-9]+$/);
    expect(page.context().pages()).toHaveLength(1);
  });

  test("the controls stay calm: a one-line search box, and you can always see where the keyboard is", async ({ page }) => {
    await openRoom(page);
    // At rest, the field just says "Search": the list's title above already names where you are.
    await expect(page.getByRole("button", { name: "Remove in: Reading Room" })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Search", exact: true })).toHaveAttribute("placeholder", "Search");
    // In the search, the scope chip sits in the box without making it taller (decision 0025).
    await page.getByRole("combobox", { name: "Search", exact: true }).focus();
    await expect(page.getByRole("button", { name: "Remove in: Reading Room" })).toBeVisible();
    // Shift+Tab reaches the chip's Remove button, and the chip stays while it has the keyboard.
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("button", { name: "Remove in: Reading Room" })).toBeFocused();
    // Leaving an empty search puts the field back at rest.
    await page.locator("#list-heading").focus();
    await expect(page.getByRole("button", { name: "Remove in: Reading Room" })).toHaveCount(0);
    // A click on the word "Search" opens the search without removing its scope.
    await page.getByRole("combobox", { name: "Search", exact: true }).click({ position: { x: 60, y: 20 } });
    await expect(page.getByRole("button", { name: "Remove in: Reading Room" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Search", exact: true })).toBeFocused();
    const box = (await page.locator(".search-box").boundingBox())!;
    expect(box.height).toBeLessThanOrEqual(48);
    // The chip's remove button is small to look at but a full 44px to press.
    const remove = (await page.getByRole("button", { name: "Remove in: Reading Room" }).boundingBox())!;
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
    // drawn inside its edge.
    await expect(selected).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(selected).toHaveCSS("border-top-left-radius", "8px");
    expect(await selected.evaluate((element) => getComputedStyle(element, "::before").content)).toBe("none");
    const inset = await selected.evaluate(
      (element) => element.getBoundingClientRect().left - element.closest(".scroller")!.getBoundingClientRect().left,
    );
    expect(Math.abs(inset - 8)).toBeLessThan(1);
    // Every title starts 32px into the pane, lined up with the list's title
    // and the search field, dot or no dot (decision 0041).
    const titleX = (await selected.locator(".title").boundingBox())!.x;
    const paneX = await selected.evaluate((element) => element.closest("section")!.getBoundingClientRect().left);
    expect(Math.abs(titleX - paneX - 32)).toBeLessThan(1);
    expect(Math.abs((await page.locator("#list-heading").boundingBox())!.x - titleX)).toBeLessThan(1);
    expect(Math.abs((await page.locator(".search-box").boundingBox())!.x - titleX)).toBeLessThan(1);
    // The hairlines run from the titles' edge to the pill's right edge, so a
    // line and the selection end in the same place.
    const hairline = await page.locator(".item-list > li + li").first().evaluate((element) => {
      const css = getComputedStyle(element, "::before");
      return [css.left, css.right];
    });
    expect(hairline).toEqual(["32px", "8px"]);
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
    // A finished list says so, in a quiet caption at the titles' edge, with no rule.
    const end = page.getByText("That's everything.");
    await expect(end).toBeVisible();
    await expect(end).toHaveCSS("border-top-width", "0px");
    await expect(end).toHaveCSS("text-align", "start");
    await expect(page.getByRole("button", { name: "Show older items" })).toHaveCount(0);
    // The note (here, Undo for a star) sits at the foot of the list pane, even under a short list.
    await page.keyboard.press("s");
    const note = page.locator(".toast");
    await expect(note).toBeVisible();
    const [noteBox, paneBox] = [(await note.boundingBox())!, (await selected.evaluate((element) => element.closest(".scroller")!.getBoundingClientRect().toJSON()))];
    expect(paneBox.bottom - (noteBox.y + noteBox.height)).toBeLessThan(48);
    // It sits in a band of the list's own tone across the pane, which the rows end above, so it
    // never lies over the rows you're acting on (decision 0048).
    const band = note.locator("xpath=..");
    const [bandFill, paneFill] = await Promise.all([
      band.evaluate((element) => getComputedStyle(element).backgroundColor),
      selected.evaluate((element) => getComputedStyle(element.closest(".list-pane")!).backgroundColor),
    ]);
    expect(bandFill).toBe(paneFill);
    const bandBox = (await band.boundingBox())!;
    expect(bandBox.width).toBeGreaterThan(paneBox.width - 16);
    await page.keyboard.press("u");
    // Opening an article gives its title the keyboard's place for screen
    // readers, but no ring: a title can't be pressed (decision 0047). The
    // next Tab lands on the byline's link to the publisher, which rings.
    await page.keyboard.press("o");
    const heading = title(page, "The pleasure of a slow letter");
    await expect(heading).toBeFocused();
    await expect(heading).toHaveCSS("outline-style", "none");
    await page.keyboard.press("Tab");
    const publisher = article(page).locator(".article-byline").getByRole("link", { name: "Reading Room" });
    await expect(publisher).toBeFocused();
    await expect(publisher).toHaveCSS("outline-style", "solid");
  });

  test("on a wide window the article sits in the middle, and its actions sit together at the pane's right edge",async ({ page }) => {
    await openRoom(page, 2560);
    await page.keyboard.press("j");
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
    // The bar is anchored to the pane, not the text column (decision 0038): its tools sit together at the
    // right, Open original first and More near the pane's edge, all outside the text (decision 0050).
    const pane = (await article(page).boundingBox())!;
    const first = (await article(page).getByRole("link", { name: "Open original" }).first().boundingBox())!;
    const last = (await article(page).getByRole("button", { name: "More actions" }).boundingBox())!;
    expect(first.x).toBeGreaterThan(text.x + text.width);
    expect(last.x - (first.x + first.width)).toBeLessThan(2 * 44 + 3 * 8 + 1);
    expect(pane.x + pane.width - (last.x + last.width)).toBeLessThan(40);
    expect(last.x + last.width).toBeGreaterThan(text.x + text.width + 100);
    expect(Math.abs(first.y - last.y)).toBeLessThan(2);
  });

  test("the three panes share one top line, and a toolbar's focus ring stays clear of the window's top", async ({ page }) => {
    await openRoom(page);
    await page.keyboard.press("j");
    // One band for every pane's top line (decision 0043): the sidebar's, the list's and the article's end at the same height.
    const bottoms = await page.locator("#sidebar .pane-bar, .list-pane > .pane-bar, .reading-bar").evaluateAll((bars) =>
      bars.map((bar) => Math.round(bar.getBoundingClientRect().bottom)),
    );
    expect(bottoms).toHaveLength(3);
    expect(new Set(bottoms).size).toBe(1);
    // Their controls sit on one line: the sidebar button, the list's More and the article's Aa.
    const middle = async (selector: string) => {
      const box = (await page.locator(selector).first().boundingBox())!;
      return box.y + box.height / 2;
    };
    const line = await middle("button[aria-label='Sidebar']");
    expect(Math.abs((await middle(".list-pane > .pane-bar button")) - line)).toBeLessThan(1);
    expect(Math.abs((await middle(".reading-bar button[aria-label='Reading appearance']")) - line)).toBeLessThan(1);
    // A toolbar button's ring is drawn inside its own edge, so it never touches the window's top.
    const aa = article(page).getByRole("button", { name: "Reading appearance" });
    await tabTo(page, aa);
    await expect(aa).toHaveCSS("outline-offset", "-2px");
    expect((await aa.boundingBox())!.y).toBeGreaterThanOrEqual(6);
  });

  test("the top bar is solid in the page's color, with a line under it only once the text has scrolled", async ({ page }) => {
    await openRoom(page);
    await page.keyboard.press("j");
    const bar = article(page).locator(".reading-bar");
    const scroller = article(page).locator(".reading-scroller");
    // Solid, never see-through or blurred, so no text shows through it (decision 0040).
    const [barColor, paperColor, blur] = await Promise.all([
      bar.evaluate((element) => getComputedStyle(element).backgroundColor),
      article(page).evaluate((element) => getComputedStyle(element).backgroundColor),
      bar.evaluate((element) => getComputedStyle(element).backdropFilter),
    ]);
    expect(barColor).toBe(paperColor);
    expect(barColor).not.toMatch(/0\.\d+\)$/);
    expect(blur).toBe("none");
    // The text scrolls below the bar, not under it; the bar spans the whole pane, scrollbar included.
    const [barBox, scrollerBox, paneBox] = [(await bar.boundingBox())!, (await scroller.boundingBox())!, (await article(page).boundingBox())!];
    expect(scrollerBox.y).toBeGreaterThanOrEqual(barBox.y + barBox.height - 1);
    expect(Math.abs(barBox.x + barBox.width - (paneBox.x + paneBox.width))).toBeLessThan(1);
    // The hairline between them shows only once the text has scrolled.
    await expect(scroller).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
    await scroller.evaluate((element) => element.scrollBy(0, 120));
    await expect(scroller).toHaveAttribute("data-scrolled", "");
    await expect(scroller).not.toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
    // The scrollbar's track is see-through, so its gutter is the page's own color in every theme.
    expect(await scroller.evaluate((element) => getComputedStyle(element).scrollbarColor)).toMatch(/ transparent$|rgba\(0, 0, 0, 0\)$/);
  });

  test("the title is about 32px, set tight and balanced; the byline is quiet with the publisher in full ink", async ({ page }) => {
    await openRoom(page);
    await page.keyboard.press("j");
    const heading = article(page).locator(".article-title");
    await expect(heading).toHaveCSS("font-size", "32px");
    // Its lines are balanced, so a two-line title reads as two even lines (decision 0044).
    await expect(heading).toHaveCSS("text-wrap", /balance/);
    expect(parseFloat(await heading.evaluate((element) => getComputedStyle(element).lineHeight)) / 32).toBeCloseTo(1.12, 2);
    // Tracked in only a little, with a clear 20px pause before the byline (decision 0047).
    await expect(heading).toHaveCSS("letter-spacing", "-0.16px");
    await expect(heading).toHaveCSS("margin-bottom", "20px");
    const byline = article(page).locator(".article-byline");
    await expect(byline).toHaveCSS("font-size", "14px");
    await expect(byline).toHaveCSS("margin-top", "0px");
    const publisher = byline.getByRole("link", { name: "Reading Room" });
    await expect(publisher).toHaveCSS("font-weight", "600");
    const [inkColor, bylineColor, publisherColor] = await Promise.all([
      page.evaluate(() => getComputedStyle(document.body).color),
      byline.evaluate((element) => getComputedStyle(element).color),
      publisher.evaluate((element) => getComputedStyle(element).color),
    ]);
    expect(publisherColor).toBe(inkColor);
    expect(bylineColor).not.toBe(inkColor);
    // A heading inside the article is about 22px.
    await expect(article(page).locator(".article-text h2").first()).toHaveCSS("font-size", "22px");
  });

  test("on a 1280px window the text keeps at least 56px of paper on each side", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openRoom(page);
    await page.keyboard.press("j");
    // The measure gives way before the margins do, as in Apple Books (decision 0044).
    const [text, scroller] = await Promise.all([
      article(page).locator(".article").boundingBox(),
      article(page).locator(".reading-scroller").boundingBox(),
    ]);
    expect(text!.x - scroller!.x).toBeGreaterThanOrEqual(56);
    expect(scroller!.x + scroller!.width - (text!.x + text!.width)).toBeGreaterThanOrEqual(56);
  });

  test("a summary-only article ends with a small centred note under the closing rule, linking the whole article", async ({ page }) => {
    await openRoom(page);
    await row(page, "Only the first page").click();
    const note = article(page).locator(".article-note");
    await expect(note).toContainText("This feed shares only a summary. Read the full article");
    // End matter, as in a book: small upright interface type, centred (decision 0040).
    expect(await note.evaluate((element) => getComputedStyle(element).fontFamily)).not.toContain("Literata");
    await expect(note).toHaveCSS("font-style", "normal");
    await expect(note).toHaveCSS("text-align", "center");
    await expect(note).toHaveCSS("font-size", "14px");
    // Only the link is underlined.
    expect(await note.evaluate((element) => getComputedStyle(element).textDecorationLine)).toBe("none");
    const link = note.getByRole("link", { name: "Read the full article on Reading Room" });
    await expect(link).toHaveCSS("text-decoration-line", "underline");
    // The publisher is named in the byline, so the link's words stay short and, where they fit, on one line (decision 0044).
    await expect(link).toHaveCSS("display", "inline-block");
    const lines = await link.evaluate((element) => element.getClientRects().length === 1 && element.getBoundingClientRect().height < parseFloat(getComputedStyle(element).lineHeight) * 1.5);
    expect(lines).toBe(true);
    expect(await link.evaluate((element) => element.firstChild?.textContent)).toBe("Read the full article");
    await expect(link).toHaveAttribute("href", "https://reading-room.example/first-page");
    await expect(link).toHaveAttribute("target", "_blank");
    // It comes after the short closing line, and is the last thing in the article.
    expect(await note.evaluate((element) => element.previousElementSibling?.classList.contains("article-end"))).toBe(true);
    expect(await note.evaluate((element) => element.nextElementSibling)).toBeNull();
  });

  test("in high-contrast mode, only the selected article is marked", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await openRoom(page);
    await page.keyboard.press("j");
    await page.keyboard.press("Enter");
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
    await page.goto(new URL(`/feeds/${id}`, FEEDS_APP).href);
    await expect(page.getByRole("button", { name: /\(\d+\)/ }).nth(30)).toBeAttached();

    const fillsWindow = () =>
      page.evaluate(() => {
        const main = document.querySelector("main")!.getBoundingClientRect();
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

    // And over the article, too.
    await article(page).hover();
    for (let i = 0; i < 15; i++) await page.mouse.wheel(0, 400);
    expect(await fillsWindow()).toEqual(still);
  });

  test("+ and - change the text size while reading, and Settings remembers it", async ({ page }) => {
    await openRoom(page);
    await page.keyboard.press("j");
    const text = article(page).locator("article");
    const size = () => text.evaluate((element) => getComputedStyle(element).fontSize);
    await expect.poll(size).toBe("20px");

    await page.keyboard.press("+");
    await expect.poll(size).toBe("22px");
    await page.keyboard.press("-");
    await page.keyboard.press("-");
    await expect.poll(size).toBe("18px");

    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("region", { name: "Look and feel" }).getByRole("status")).toHaveText("Small");
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
  await expect(page.getByRole("region", { name: "Reading Room" })).toBeHidden();

  await article(page).getByRole("button", { name: "Back to Reading Room" }).click();
  await expect(row(page, "The pleasure of a slow letter")).toBeFocused();
  await expect(article(page)).toBeHidden();
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
    await page.mouse.wheel(0, 300);
    await expect.poll(() => top(page)).toBeGreaterThan(250);
    // Written down a moment after scrolling stops.
    await page.waitForTimeout(600);
    const stopped = await top(page);

    await row(page, "Only the first page").click();
    await expect(title(page, "Only the first page")).toBeVisible();
    expect(await top(page)).toBe(0);
    await row(page, "The pleasure of a slow letter").click();
    await expect(title(page, "The pleasure of a slow letter")).toBeVisible();
    await expect.poll(() => top(page)).toBeGreaterThan(stopped - 8);
    expect(await top(page)).toBeLessThan(stopped + 8);

    await page.reload();
    await appReady(page);
    await row(page, "The pleasure of a slow letter").click();
    await expect.poll(() => top(page)).toBeGreaterThan(stopped - 8);
    expect(await top(page)).toBeLessThan(stopped + 8);

    // Read to the end: next time it starts again at its top, as a finished book does.
    await scroller(page).hover();
    await page.mouse.wheel(0, 5000);
    await expect.poll(() => scroller(page).evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThan(2);
    await page.waitForTimeout(600);
    await row(page, "Only the first page").click();
    await expect(title(page, "Only the first page")).toBeVisible();
    await row(page, "The pleasure of a slow letter").click();
    await expect(title(page, "The pleasure of a slow letter")).toBeVisible();
    await expect(article(page).locator("table")).toBeAttached();
    await page.waitForTimeout(200);
    expect(await top(page)).toBe(0);
  });
});
