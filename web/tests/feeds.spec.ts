import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn, tabTo } from "./screens";

// SPEC sections 2, 3 and 6, "How to check it", done by a browser. Tests that
// add feeds use the nine turtles that may read the made-up publisher
// (playwright.config.ts), each with a blog of its own.

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });
const field = (page: Page) => page.getByLabel("Paste a website or feed URL");

async function openApp(page: Page, path: string, base = FEEDS_APP) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL(path, base).href);
  await appReady(page);
  await signIn(page);
}

/** A blog name no other test uses. */
function newBlog(prefix = "blog"): string {
  return `${prefix}-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
}

test("a fresh nine turtles shows the welcome in the reading area: the paste field, and importing OPML", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/unread");
  await appReady(page);
  await signIn(page);
  // The welcome is in the reading area, centred, and owns the screen (decision 0041): the list
  // beside it says nothing, and the sidebar has no find field while there's nothing to find.
  const reading = page.getByRole("region", { name: "A quiet place to read." });
  await expect(reading.getByRole("heading", { level: 2, name: "A quiet place to read." })).toBeVisible();
  await expect(reading.getByLabel("Paste a website or feed URL")).toBeVisible();
  await expect(reading.getByRole("button", { name: "Add feed" })).toBeVisible();
  await expect(page.getByText("Nothing here yet.")).toHaveCount(0);
  await expect(sidebar(page).getByRole("searchbox", { name: "Find a feed or folder" })).toHaveCount(0);
  await expect(page.getByText("Time to read something beautiful.")).toHaveCount(0);
  const [welcome, pane] = await Promise.all([reading.locator("#welcome-heading").boundingBox(), reading.boundingBox()]);
  expect(Math.abs(welcome!.x + welcome!.width / 2 - (pane!.x + pane!.width / 2))).toBeLessThan(4);
  // One empty state, not an empty column beside it (decision 0048): the list pane steps aside and
  // the welcome takes everything beside the sidebar.
  await expect(page.getByRole("region", { name: "Unread" })).toHaveCount(0);
  const sidebarBox = (await sidebar(page).boundingBox())!;
  expect(Math.abs(pane!.x - (sidebarBox.x + sidebarBox.width))).toBeLessThan(2);
  // The field is wide enough for a real address.
  expect((await field(page).boundingBox())!.width).toBeGreaterThan(280);
  // One alignment (decision 0048): the field's name is its placeholder (and its label for screen
  // readers), so no line sits left-aligned under the centred title.
  await expect(field(page)).toHaveAttribute("placeholder", "Paste a website or feed URL");
  await expect(reading.locator("label[for='feed-address']")).toHaveClass(/sr-only/);
  // "Import an OPML file…", an underlined link in the text color just under the field and centred
  // under it, 44px tall to touch, leads to Settings, at Your data (decisions 0045, 0048, 0055).
  const importLink = page.getByRole("link", { name: "import an OPML file" });
  const [fieldBox, importBox, addBox] = await Promise.all([field(page).boundingBox(), importLink.boundingBox(), reading.getByRole("button", { name: "Add feed" }).boundingBox()]);
  expect(importBox!.y - (fieldBox!.y + fieldBox!.height)).toBeLessThanOrEqual(12);
  expect(importBox!.height).toBeGreaterThanOrEqual(44);
  await expect(importLink).toHaveCSS("text-decoration-line", "underline");
  const rowCentre = (fieldBox!.x + addBox!.x + addBox!.width) / 2;
  expect(Math.abs(importBox!.x + importBox!.width / 2 - rowCentre)).toBeLessThan(3);
  await importLink.click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { level: 3, name: "Your data" })).toBeFocused();
  await expect(sidebar(page).getByRole("link", { name: "Add feed" })).toBeVisible();
});

test("the welcome stays still under the Add a feed sheet", async ({ page, isMobile }) => {
  test.skip(isMobile, "on a phone, Add a feed is a screen of its own");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/unread");
  await appReady(page);
  await signIn(page);
  const reading = page.getByRole("region", { name: "A quiet place to read." });
  const shape = () => Promise.all([page.locator("#welcome-heading").boundingBox(), page.getByText("Import an OPML file…").first().boundingBox()]);
  const before = await shape();
  // Nothing behind the sheet moves as it opens or closes (decision 0048): the welcome keeps its shape under the dim.
  await page.keyboard.press("a");
  const sheet = page.getByRole("dialog", { name: "Add a feed" });
  await expect(sheet.getByLabel("Paste a website or feed URL")).toBeFocused();
  expect(await shape()).toEqual(before);
  // The page has one field of that name: the sheet's.
  await expect(page.getByLabel("Paste a website or feed URL")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(reading.getByLabel("Paste a website or feed URL")).toBeVisible();
  expect(await shape()).toEqual(before);
});

test("on a phone-narrow window, a fresh nine turtles shows the welcome in the list's place", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/unread");
  await appReady(page);
  await signIn(page);
  const list = page.getByRole("region", { name: "Unread" });
  await expect(list.getByRole("heading", { level: 2, name: "A quiet place to read." })).toBeVisible();
  await expect(list.getByLabel("Paste a website or feed URL")).toBeVisible();
  await expect(list.getByRole("link", { name: "import an OPML file" })).toBeVisible();
  await expect(page.getByText("Nothing here yet.")).toHaveCount(0);
});

test("on a small phone, the welcome's hint fits its field, at 320 and 375 pixels and with larger text", async ({ page, isMobile }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto("/unread");
  await appReady(page);
  await signIn(page);
  const hint = page.getByRole("region", { name: "Unread" }).getByLabel("Paste a website or feed URL");
  await expect(hint).toBeVisible();
  // The hint's own width, in the hint's own type, against the room inside the field.
  const fits = () =>
    hint.evaluate((input) => {
      const field = input as HTMLInputElement;
      const style = getComputedStyle(field, "::placeholder");
      const context = document.createElement("canvas").getContext("2d")!;
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const own = getComputedStyle(field);
      const room = field.clientWidth - parseFloat(own.paddingLeft) - parseFloat(own.paddingRight);
      return { wide: context.measureText(field.placeholder).width, room, size: parseFloat(style.fontSize), typed: parseFloat(own.fontSize) };
    });
  for (const [width, text] of [
    [375, "100%"],
    [320, "100%"],
    [375, "125%"],
  ] as const) {
    await page.setViewportSize({ width, height: 700 });
    await page.evaluate((size) => (document.documentElement.style.fontSize = size), text);
    const { wide, room, size, typed } = await fits();
    expect(wide, `${width}px at ${text}`).toBeLessThanOrEqual(room);
    // Never smaller than 10.5px; what's typed stays the field's own size, so a phone never zooms in.
    expect(size).toBeGreaterThanOrEqual(10.5);
    expect(typed).toBeGreaterThanOrEqual(16);
  }
  // With room to spare, on a computer's window, the hint keeps the field's own size.
  if (isMobile) return;
  await page.evaluate(() => (document.documentElement.style.fontSize = ""));
  await page.setViewportSize({ width: 1280, height: 800 });
  // The welcome moves into the reading area as the window widens: asked again until it has.
  await expect
    .poll(() => page.getByLabel("Paste a website or feed URL").evaluate((input) => getComputedStyle(input, "::placeholder").fontSize))
    .toBe("16px");
});

test("the welcome's New to feeds? opens a sheet that explains feeds and offers a few to start with, none ticked", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/unread");
  await appReady(page);
  await signIn(page);
  const reading = page.getByRole("region", { name: "A quiet place to read." });
  await reading.getByRole("link", { name: "New to feeds? Start here" }).click();
  await expect(page).toHaveURL(/\/new-to-feeds$/);
  const sheet = page.getByRole("dialog", { name: "New to feeds?" });
  await expect(sheet.getByRole("heading", { level: 2, name: "New to feeds?" })).toBeFocused();
  // The welcome stays as it was behind the sheet.
  await expect(reading.locator("#welcome-heading")).toBeVisible();
  // The website's guide, in a tab of its own (decision 0079).
  const guide = sheet.getByRole("link", { name: /Here's how feeds work/ });
  await expect(guide).toHaveAttribute("href", "https://nineturtles.app/new-to-feeds/");
  await expect(guide).toHaveAttribute("target", "_blank");
  // A grouped list of tick boxes, nothing chosen for the reader, each row 44px or more.
  const boxes = sheet.getByRole("group", { name: "A few to start with" }).getByRole("checkbox");
  await expect(boxes).toHaveCount(5);
  for (const box of await boxes.all()) await expect(box).not.toBeChecked();
  for (const row of await sheet.locator("label.check-row").all()) expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // Nothing ticked: it says so, in words.
  const addChosen = sheet.getByRole("button", { name: "Add chosen feeds" });
  await addChosen.click();
  await expect(sheet.getByRole("status")).toHaveText("Choose a feed first.");
  // Ticked ones are added one after another through the same path as a pasted address; here
  // nine turtles is made to say the sites didn't answer, so this fresh nine turtles stays empty.
  const asked: string[] = [];
  await page.route("**/api/feeds", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    asked.push((route.request().postDataJSON() as { address: string }).address);
    await route.fulfill({ status: 502, json: { error: "unreachable" } });
  });
  await sheet.getByRole("checkbox", { name: /The Marginalian/ }).check();
  await sheet.getByRole("checkbox", { name: /kottke\.org/ }).check();
  await addChosen.click();
  await expect(sheet.getByRole("status")).toHaveText("Those feeds couldn't be added just now. Try again later.");
  expect(asked).toEqual(["https://www.themarginalian.org/feed/", "https://feeds.kottke.org/main"]);
  await expect(sheet.getByRole("checkbox", { name: /kottke\.org/ })).toBeChecked();
  // Escape closes it, back to the welcome, with the keyboard back on the link that opened it.
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/unread$/);
  await expect(sheet).toHaveCount(0);
  await expect(reading.getByRole("link", { name: "New to feeds? Start here" })).toBeFocused();
});

test("New to feeds? works with the keyboard alone, and the starters chosen are added and open Unread", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/unread");
  await appReady(page);
  await signIn(page);
  // nine turtles is made to accept the starters and then list them, so this fresh nine turtles stays empty.
  const followed: { id: number; title: string; site_url: null; unread: number; folders: number[] }[] = [];
  await page.route("**/api/feeds", async (route) => {
    if (route.request().method() === "POST") {
      const id = 9000 + followed.length;
      const feed = { id, title: `Starter ${id}`, site_url: null, unread: 0, folders: [] };
      followed.push(feed);
      return route.fulfill({ status: 201, json: { feed } });
    }
    if (followed.length === 0) return route.fallback();
    return route.fulfill({ json: { feeds: followed, folders: [] } });
  });
  const link = page.getByRole("link", { name: "New to feeds? Start here" });
  await tabTo(page, link);
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog", { name: "New to feeds?" });
  await expect(sheet.getByRole("heading", { name: "New to feeds?" })).toBeFocused();
  const first = sheet.getByRole("checkbox", { name: /The Marginalian/ });
  await tabTo(page, first);
  await page.keyboard.press("Space");
  await expect(first).toBeChecked();
  const nasa = sheet.getByRole("checkbox", { name: /NASA Image of the Day/ });
  await tabTo(page, nasa);
  await page.keyboard.press("Space");
  await tabTo(page, sheet.getByRole("button", { name: "Add chosen feeds" }));
  await page.keyboard.press("Enter");
  // Two added: Unread opens, with both in the sidebar.
  await expect(page).toHaveURL(/\/unread$/);
  await expect(sheet).toHaveCount(0);
  await expect(sidebar(page).getByRole("link", { name: /Starter 9000/ })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: /Starter 9001/ })).toBeVisible();
  // Once anything is followed, the sheet's address opens the home view instead (decision 0079).
  await page.goBack();
  await expect(page).toHaveURL(/\/unread$/);
  await expect(page.getByRole("dialog", { name: "New to feeds?" })).toHaveCount(0);
});

test("on a phone, New to feeds? is a page sheet with its X and the main action at the foot", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/unread");
  await appReady(page);
  await signIn(page);
  await page.getByRole("link", { name: "New to feeds? Start here" }).click();
  await expect(page).toHaveURL(/\/new-to-feeds$/);
  await expect(page.getByRole("heading", { level: 2, name: "New to feeds?" })).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Cancel" })).toHaveCount(0);
  const add = (await page.getByRole("button", { name: "Add chosen feeds" }).boundingBox())!;
  expect(add.y + add.height).toBeGreaterThan(700);
  // The X goes back to the welcome it opened from.
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page).toHaveURL(/\/unread$/);
  await expect(page.getByRole("heading", { level: 2, name: "A quiet place to read." })).toBeVisible();
});

test("a, a website's address and Enter add its feed, and its articles appear", async ({ page }) => {
  await openApp(page, "/all");
  const name = newBlog();
  await page.keyboard.press("a");
  await expect(page).toHaveURL(/\/add-feed$/);
  await expect(field(page)).toBeFocused();

  await page.keyboard.type(`${FEED_SITE}/blog/${name}/`);
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/feeds\/[0-9]+$/);
  await expect(page.getByRole("heading", { level: 2, name: `Blog ${name}` })).toBeFocused();
  await expect(page).toHaveTitle(`Blog ${name} · nine turtles`);
  const link = sidebar(page).getByRole("link", { name: `Blog ${name}` });
  await expect(link).toHaveAttribute("aria-current", "page");

  const rows = page.getByRole("region", { name: `Blog ${name}` }).getByRole("listitem");
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText("On keeping a commonplace book (3)");
  await expect(rows.first()).toContainText(`Blog ${name} · 20 Oct`);

  // Reloading keeps the place.
  await page.reload();
  await appReady(page);
  await expect(page.getByRole("heading", { level: 2, name: `Blog ${name}` })).toBeVisible();
});

test("a feed's own address works, and adding it twice says it's already there", async ({ page }) => {
  await openApp(page, "/add-feed");
  const name = newBlog();
  await field(page).fill(`${FEED_SITE}/blog/${name}/feed.xml`);
  await page.getByRole("button", { name: "Add feed" }).click();
  await expect(page.getByRole("heading", { level: 2, name: `Blog ${name}` })).toBeVisible();

  await sidebar(page).getByRole("link", { name: "Add feed" }).click();
  await field(page).fill(`${FEED_SITE}/blog/${name}/`);
  await page.keyboard.press("Enter");
  await expect(page.locator("#feed-address-status")).toHaveText("You already follow this feed.");
  await expect(sidebar(page).getByRole("link", { name: `Blog ${name}` })).toHaveCount(1);

  await page.getByRole("link", { name: `Go to Blog ${name}` }).click();
  await expect(page.getByRole("heading", { level: 2, name: `Blog ${name}` })).toBeVisible();
});

test("a site with several feeds offers a choice", async ({ page }) => {
  await openApp(page, "/add-feed");
  const name = newBlog("two");
  await field(page).fill(`${FEED_SITE}/blog/${name}/`);
  await page.keyboard.press("Enter");
  await expect(page.locator("#feed-address-status")).toHaveText("This site offers more than one feed. Choose one:");
  // A choice of one: radio buttons, the first chosen, each row ending in a round mark that shows
  // the choice by its dot, never by a tint alone (decision 0049).
  const choices = page.getByRole("radiogroup", { name: "Feeds on this site" });
  const [first, comments] = [choices.getByRole("radio").first(), choices.getByRole("radio", { name: /^Comments/ })];
  await expect(first).toBeChecked();
  await expect(comments).not.toBeChecked();
  const dot = (radio: typeof first) => radio.locator("xpath=..").locator(".radio-mark").evaluate((mark) => getComputedStyle(mark, "::after").backgroundColor);
  expect(await dot(comments)).toBe("rgba(0, 0, 0, 0)");
  expect(await dot(first)).not.toBe("rgba(0, 0, 0, 0)");
  await comments.check();
  await expect(first).not.toBeChecked();
  // Add feed adds the one chosen.
  await page.getByRole("button", { name: "Add feed", exact: true }).click();
  await expect(page.getByRole("heading", { level: 2, name: `Blog ${name}: comments` })).toBeVisible();
});

test("a page without a feed gets a calm, plain message", async ({ page }) => {
  await openApp(page, "/add-feed");
  await field(page).fill(`${FEED_SITE}/plain/`);
  await page.keyboard.press("Enter");
  await expect(page.locator("#feed-address-status")).toHaveText("This site doesn't seem to offer a feed. Try the feed's own address, or the site's home page.");
  // The field is marked as refused, for screen readers and by its red edge.
  await expect(field(page)).toHaveAttribute("aria-invalid", "true");
  // While the keyboard is in it, the focus line takes the edge's place: one line, never a red edge inside a ring (decision 0042).
  await expect(field(page)).toBeFocused();
  await expect(field(page)).toHaveCSS("outline-style", "solid");
  await expect(field(page)).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
  await field(page).evaluate((element) => (element as HTMLInputElement).blur());
  await expect(field(page)).not.toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
  await field(page).focus();

  await field(page).fill("not an address");
  await page.keyboard.press("Enter");
  await expect(page.locator("#feed-address-status")).toHaveText("That doesn't look like a web address.");
});

test("Escape leaves Add a feed for the list you were on", async ({ page }) => {
  await openApp(page, "/all");
  await page.keyboard.press("a");
  await expect(field(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/all$/);
});

test("the list shows 50 articles, then reaching the bottom loads more below", async ({ page }) => {
  await openApp(page, "/all");
  await follow(page, `${FEED_SITE}/`);
  await page.reload();
  await appReady(page);
  await sidebar(page).getByRole("link", { name: /^Quiet Notes( \d+ unread)?$/ }).click();

  const list = page.getByRole("region", { name: "Quiet Notes" });
  const rows = list.getByRole("listitem");
  await expect(rows).toHaveCount(50);
  // Where the first row sits inside the list, whatever the scrolling.
  const firstTop = () => rows.first().evaluate((row) => (row as HTMLElement).offsetTop);
  const firstBefore = await firstTop();
  // Nothing loads until the bottom of the list comes into view.
  await expect(rows).toHaveCount(50);
  await list.locator(".list-bottom").scrollIntoViewIfNeeded();
  await expect(rows).toHaveCount(60);
  expect(await firstTop()).toBe(firstBefore);
  await expect(rows.last()).toContainText("(1)");
  // The list has an end.
  await expect(list.getByRole("button", { name: "Show older articles" })).toHaveCount(0);
  await expect(list.getByText("That's everything.")).toBeVisible();
});

// The keyboard floor: everything above also works with the keyboard alone.

test("with only the keyboard: choose one of several feeds, then go back to it from the sidebar", async ({ page }) => {
  await openApp(page, "/all");
  const name = newBlog("two");
  await page.keyboard.press("a");
  await page.keyboard.type(`${FEED_SITE}/blog/${name}/`);
  await page.keyboard.press("Enter");
  await expect(page.locator("#feed-address-status")).toHaveText("This site offers more than one feed. Choose one:");

  // Tab reaches the chosen feed (the first); an arrow key moves the choice; Add feed adds it.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("radio").first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: /^Comments/ })).toBeChecked();
  await tabTo(page, page.getByRole("button", { name: "Add feed", exact: true }));
  await page.keyboard.press("Enter");
  const heading = page.getByRole("heading", { level: 2, name: `Blog ${name}: comments` });
  await expect(heading).toBeFocused();

  // Into the sidebar and back to the same feed after visiting All.
  await page.keyboard.press("g");
  await page.keyboard.press("a");
  await expect(page).toHaveURL(/\/all$/);
  const link = sidebar(page).getByRole("link", { name: `Blog ${name}: comments` });
  await tabTo(page, link);
  await page.keyboard.press("Enter");
  await expect(heading).toBeFocused();
});

test("with only the keyboard: 'Go to' a feed you already follow", async ({ page }) => {
  await openApp(page, "/all");
  const name = newBlog();
  await follow(page, `${FEED_SITE}/blog/${name}/`);
  await page.keyboard.press("a");
  await page.keyboard.type(`${FEED_SITE}/blog/${name}/feed.xml`);
  await page.keyboard.press("Enter");
  await expect(page.locator("#feed-address-status")).toHaveText("You already follow this feed.");
  await tabTo(page, page.getByRole("link", { name: /^Go to / }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 2, name: `Blog ${name}` })).toBeFocused();
});

test("with only the keyboard: Tab reaches Show older articles, and the keyboard's place stays in the list at the end", async ({ page }) => {
  await openApp(page, "/all");
  await follow(page, `${FEED_SITE}/`);
  await page.reload();
  await appReady(page);
  const feed = sidebar(page).getByRole("link", { name: /^Quiet Notes( \d+ unread)?$/ });
  await tabTo(page, feed);
  await page.keyboard.press("Enter");

  const list = page.getByRole("region", { name: "Quiet Notes" });
  const rows = list.getByRole("listitem");
  await expect(rows).toHaveCount(50);
  // Tab reaches the button under the list. Having the keyboard's place brings
  // the bottom into view, so the rest load by themselves (decision 0074). They
  // can arrive, and the button go, before the next look: stop Tabbing then too.
  for (let i = 0; i < 400; i++) {
    const on = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
    if (on === "Show older articles" || (await rows.count()) > 50) break;
    await page.keyboard.press("Tab");
  }
  await expect(rows).toHaveCount(60);
  // The button is gone (the list has ended); the keyboard's place moved to
  // the first article that just arrived, not to the top of the page.
  await expect(rows.nth(50).getByRole("button")).toBeFocused();
});

test("an address for a feed you don't follow says so", async ({ page }) => {
  await openApp(page, "/feeds/999999");
  await expect(page.getByRole("heading", { level: 2, name: "Feed not found" })).toBeVisible();
  await expect(page.getByText("You don't follow this feed.")).toBeVisible();
});

// Adding from elsewhere (SPEC section 3, decision 0104): a share menu, an Apple Shortcuts
// shortcut or a bookmark opens /add-feed with the page's address. Each test here looks once at
// the made-up publisher through the feed finder, which allows only a few lookups a site.

/** The reader's feeds as the server has them, signed in as the page is. */
async function followed(page: Page): Promise<string> {
  const answer = await page.request.get(`${FEEDS_APP}/api/feeds`);
  expect(answer.ok()).toBe(true);
  return answer.text();
}

test("a shared page opens Add a feed with its address and finds its feed, but follows it only on Add feed", async ({ page, isMobile }) => {
  const name = newBlog();
  const address = `${FEED_SITE}/blog/${name}/`;
  // Signed out at first: after signing in, Add a feed opens with the address kept. On a computer
  // it's the sheet; on a phone (checked at a phone's width) the phone's page sheet.
  await page.setViewportSize(isMobile ? { width: 390, height: 800 } : { width: 1280, height: 800 });
  await page.goto(new URL(`/add-feed?url=${encodeURIComponent(address)}`, FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await expect(page).toHaveURL(/\/add-feed$/);
  await expect(field(page)).toHaveValue(address);
  await expect(page.locator("#feed-address-status")).toHaveText("Found this feed:");
  const choice = page.getByRole("radiogroup", { name: "Feeds on this site" }).getByRole("radio");
  await expect(choice).toHaveCount(1);
  await expect(choice).toBeChecked();
  // Nothing is followed yet: not in the sidebar, not on the server.
  await expect(sidebar(page).getByRole("link", { name: `Blog ${name}` })).toHaveCount(0);
  expect(await followed(page)).not.toContain(name);
  if (isMobile) {
    // On a phone: Add feed, the full width at the screen's foot, follows it.
    await page.getByRole("button", { name: "Add feed", exact: true }).tap();
  } else {
    // With only the keyboard: the sheet opens with the keyboard in the field, and Enter adds the chosen feed.
    await expect(field(page)).toBeFocused();
    await page.keyboard.press("Enter");
  }
  await expect(page).toHaveURL(/\/feeds\/[0-9]+$/);
  expect(await followed(page)).toContain(name);
});

test("a share menu's text with the address inside it works too, and Escape follows nothing", async ({ page, isMobile }) => {
  test.skip(isMobile, "a computer's sheet and keys; the phone's page sheet is checked at a phone's width by the test above");
  // Installed on Android, nine turtles is offered in the share menu.
  const manifest = await (await page.request.get(`${FEEDS_APP}/manifest.webmanifest`)).json();
  expect(manifest.share_target).toEqual({ action: "/add-feed", method: "GET", params: { title: "title", text: "text", url: "url" } });

  const name = newBlog("two");
  const address = `${FEED_SITE}/blog/${name}/`;
  const text = `Have a look at ${address}, it's lovely.`;
  await openApp(page, `/add-feed?title=${encodeURIComponent(`Blog ${name}`)}&text=${encodeURIComponent(text)}`);
  const sheet = page.getByRole("dialog", { name: "Add a feed" });
  await expect(sheet.getByLabel("Paste a website or feed URL")).toHaveValue(address);
  await expect(sheet.locator("#feed-address-status")).toHaveText("This site offers more than one feed. Choose one:");
  // Escape, as Cancel would, leaves without following anything.
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(sidebar(page).getByRole("link", { name: `Blog ${name}` })).toHaveCount(0);
  expect(await followed(page)).not.toContain(name);
  // The shared address was for that one opening: Add a feed opens empty again.
  await page.keyboard.press("a");
  await expect(field(page)).toHaveValue("");
});

test("Settings gives the bookmark and the Shortcuts address, built from this nine turtles' own address", async ({ page }) => {
  await openApp(page, "/settings");
  const group = page.getByRole("region", { name: "Add from anywhere" });
  await expect(group.getByText(`javascript:location.href='${FEEDS_APP}/add-feed?url='+encodeURIComponent(location.href)`)).toBeVisible();
  await expect(group.getByText(`${FEEDS_APP}/add-feed?url=`, { exact: true })).toBeVisible();
  await expect(group.getByRole("button", { name: "Copy bookmark" })).toBeVisible();
  await expect(group.getByRole("button", { name: "Copy the Apple Shortcuts address" })).toBeVisible();
});
