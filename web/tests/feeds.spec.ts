import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn, tabTo } from "./screens";

// SPEC sections 2, 3 and 6, "How to check it", done by a browser. Tests that
// add feeds use the nine turtles that may read the made-up publisher
// (playwright.config.ts), each with a blog of its own.

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });
const field = (page: Page) => page.getByLabel("Their website's address");
// The made-up publisher asked for as localhost: a site with no feed anywhere (tests/feed-server.mjs).
const NO_FEED_SITE = FEED_SITE.replace("127.0.0.1", "localhost");

async function openApp(page: Page, path: string, base = FEEDS_APP) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL(path, base).href);
  await appReady(page);
  await signIn(page);
}

/** Hands the open file chooser a file with this text, the way a chosen file arrives. */
async function choose(page: Page, text: string) {
  await page.locator('input[type="file"][accept*="opml"]').evaluate((input: HTMLInputElement, contents) => {
    const chosen = new DataTransfer();
    chosen.items.add(new File([contents], "list.opml", { type: "text/x-opml" }));
    input.files = chosen.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, text);
}

/** Signs up a reader of their own on the nine turtles that reads the made-up publisher: one who follows no one yet. */
async function newReader(page: Page, width: number) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto(new URL("/sign-up", FEEDS_APP).href);
  await page.getByLabel("Email").fill(`${newBlog("new")}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("slow mornings, long reads");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.locator("#sidebar")).toBeAttached();
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
  const reading = page.getByRole("region", { name: "Hello. Who would you like to read?" });
  await expect(reading.getByRole("heading", { level: 2, name: "Hello. Who would you like to read?" })).toBeVisible();
  await expect(reading.getByLabel("Their website's address")).toBeVisible();
  await expect(reading.getByRole("button", { name: "Add", exact: true })).toBeVisible();
  await expect(page.getByText("Nothing here yet.")).toHaveCount(0);
  await expect(sidebar(page).getByRole("searchbox", { name: "Find a person or folder" })).toHaveCount(0);
  // You're on the welcome, not in Unread: no row in the sidebar is marked as where you are (decision 0191).
  await expect(sidebar(page).locator('[aria-current="page"]')).toHaveCount(0);
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
  await expect(field(page)).toHaveAttribute("placeholder", "Their website's address");
  await expect(reading.locator("label[for='feed-address']")).toHaveClass(/sr-only/);
  // "Bring your list from another app…", an underlined link in the text color, 44px tall to touch
  // (decisions 0045, 0055), shares one line with "New to feeds?" at the foot, under the examples
  // (decision 0241), and opens the file chooser at once (decision 0137).
  const importLink = reading.getByRole("button", { name: "Bring your list from another app…" });
  const newTo = reading.getByRole("link", { name: "New to feeds? Start here" });
  const [fieldBox, importBox, newBox, addBox, tryBox] = await Promise.all([
    field(page).boundingBox(),
    importLink.boundingBox(),
    newTo.boundingBox(),
    reading.getByRole("button", { name: "Add", exact: true }).boundingBox(),
    reading.getByText("Or try one").boundingBox(),
  ]);
  expect(tryBox!.y).toBeGreaterThan(fieldBox!.y + fieldBox!.height);
  expect(importBox!.y).toBeGreaterThan(tryBox!.y);
  expect(Math.abs(importBox!.y - newBox!.y)).toBeLessThan(3);
  expect(importBox!.height).toBeGreaterThanOrEqual(44);
  await expect(importLink).toHaveCSS("text-decoration-line", "underline");
  // The line is centred under the field and Add.
  const rowCentre = (fieldBox!.x + addBox!.x + addBox!.width) / 2;
  const lineCentre = (newBox!.x + importBox!.x + importBox!.width) / 2;
  expect(Math.abs(lineCentre - rowCentre)).toBeLessThan(6);
  // A file that isn't a list is said under the link, and the welcome stays.
  const chooser = page.waitForEvent("filechooser");
  await importLink.click();
  await chooser;
  await choose(page, "not a list");
  await expect(reading.getByRole("status").filter({ hasText: "list of feeds" })).toHaveText("That file doesn't look like a list of feeds.");
  await expect(page).toHaveURL(/\/unread$/);
  // A list that brings no one in says so in the same place; the welcome and the keyboard's place stay.
  const again = page.waitForEvent("filechooser");
  await importLink.press("Enter");
  await again;
  await choose(page, `<?xml version="1.0"?><opml version="2.0"><body><outline text="Empty"/></body></opml>`);
  await expect(reading.getByRole("status").filter({ hasText: "No new" })).toHaveText("No new feeds were added.");
  await expect(importLink).toBeFocused();
  await expect(reading.getByRole("heading", { level: 2, name: "Hello. Who would you like to read?" })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Add a person or publication" })).toBeVisible();
});

test("the welcome stays still under the Add sheet", async ({ page, isMobile }) => {
  test.skip(isMobile, "on a phone, Add is a screen of its own");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/unread");
  await appReady(page);
  await signIn(page);
  const reading = page.getByRole("region", { name: "Hello. Who would you like to read?" });
  const shape = () => Promise.all([page.locator("#welcome-heading").boundingBox(), page.getByText("Bring your list from another app…").first().boundingBox()]);
  const before = await shape();
  // Nothing behind the sheet moves as it opens or closes (decision 0048): the welcome keeps its shape under the dim.
  await page.keyboard.press("a");
  const sheet = page.getByRole("dialog", { name: "Add a person or publication" });
  await expect(sheet.getByLabel("Their website's address")).toBeFocused();
  expect(await shape()).toEqual(before);
  // The page has one field of that name: the sheet's.
  await expect(page.getByLabel("Their website's address")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(reading.getByLabel("Their website's address")).toBeVisible();
  expect(await shape()).toEqual(before);
});

test("on a phone-narrow window, a fresh nine turtles shows the welcome in the list's place", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/unread");
  await appReady(page);
  await signIn(page);
  const list = page.getByRole("region", { name: "Unread" });
  await expect(list.getByRole("heading", { level: 2, name: "Hello. Who would you like to read?" })).toBeVisible();
  await expect(list.getByLabel("Their website's address")).toBeVisible();
  await expect(list.getByRole("button", { name: "Bring your list from another app…" })).toBeVisible();
  await expect(page.getByText("Nothing here yet.")).toHaveCount(0);
});

test("a new reader brings their list from another app straight from the welcome", async ({ page }) => {
  await newReader(page, 1280);
  const [name, folder] = [newBlog(), newBlog("Folder")];
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Bring your list from another app…" }).click();
  await chooser;
  await choose(
    page,
    `<?xml version="1.0"?><opml version="2.0"><body><outline text="${folder}"><outline type="rss" text="Blog ${name}" xmlUrl="${FEED_SITE}/blog/${name}/feed.xml"/></outline></body></opml>`,
  );
  // The welcome gives way to Unread, whose line says what came in; the folder is in the sidebar.
  await expect(page.getByText("Added 1 feed and 1 folder. Its articles arrive over the next few minutes.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Hello. Who would you like to read?" })).toHaveCount(0);
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`^${folder}`) })).toBeVisible();
});

test("on a phone, a new reader who follows no one opens on the welcome, and Back goes to the home screen", async ({ page }) => {
  await newReader(page, 390);
  await page.goto(new URL("/", FEEDS_APP).href);
  await appReady(page);
  await expect(page.getByRole("heading", { level: 2, name: "Hello. Who would you like to read?" })).toBeVisible();
  await expect(field(page)).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("link", { name: /^Unread/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Hello. Who would you like to read?" })).toBeHidden();
});

test("on a small phone, the welcome's hint fits its field, at 320 and 375 pixels and with larger text", async ({ page, isMobile }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto("/unread");
  await appReady(page);
  await signIn(page);
  const hint = page.getByRole("region", { name: "Unread" }).getByLabel("Their website's address");
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
    .poll(() => page.getByLabel("Their website's address").evaluate((input) => getComputedStyle(input, "::placeholder").fontSize))
    .toBe("16px");
});

test("the welcome's New to feeds? opens a sheet that explains feeds and offers a few to start with, none ticked", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/unread");
  await appReady(page);
  await signIn(page);
  const reading = page.getByRole("region", { name: "Hello. Who would you like to read?" });
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
  // Each name is a link to the writer's site, in a tab of its own.
  const james = sheet.getByRole("link", { name: /^James/ });
  await expect(james).toHaveAttribute("href", "https://jamesg.blog/");
  await expect(james).toHaveAttribute("target", "_blank");
  expect((await james.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // Nothing ticked: the main button adds all five; once any is ticked, only those.
  await expect(sheet.getByRole("button", { name: "Add all five" })).toBeVisible();
  // Ticked ones are added one after another through the same path as a pasted address; here
  // nine turtles is made to say the sites didn't answer, so this fresh nine turtles stays empty.
  const asked: string[] = [];
  await page.route("**/api/feeds", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    asked.push((route.request().postDataJSON() as { address: string }).address);
    await route.fulfill({ status: 502, json: { error: "unreachable" } });
  });
  await sheet.getByRole("checkbox", { name: /^James/ }).check();
  await sheet.getByRole("checkbox", { name: /Jeff Kaufman/ }).check();
  await sheet.getByRole("button", { name: "Add 2 chosen" }).click();
  await expect(sheet.getByRole("status")).toHaveText("Those feeds couldn't be added. Try again later.");
  expect(asked).toEqual(["https://jamesg.blog/feeds/posts.xml", "https://www.jefftk.com/news.rss"]);
  await expect(sheet.getByRole("checkbox", { name: /Jeff Kaufman/ })).toBeChecked();
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
  // Each starter added is filed as a person (decision 0079).
  const filed: unknown[] = [];
  await page.route("**/api/feeds/9*", async (route) => {
    filed.push(route.request().postDataJSON());
    return route.fulfill({ json: {} });
  });
  const link = page.getByRole("link", { name: "New to feeds? Start here" });
  await tabTo(page, link);
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog", { name: "New to feeds?" });
  await expect(sheet.getByRole("heading", { name: "New to feeds?" })).toBeFocused();
  const first = sheet.getByRole("checkbox", { name: /^James/ });
  await tabTo(page, first);
  await page.keyboard.press("Space");
  await expect(first).toBeChecked();
  const ava = sheet.getByRole("checkbox", { name: /^Ava/ });
  await tabTo(page, ava);
  await page.keyboard.press("Space");
  await tabTo(page, sheet.getByRole("button", { name: "Add 2 chosen" }));
  await page.keyboard.press("Enter");
  // Two added: Unread opens, with both in the sidebar.
  await expect(page).toHaveURL(/\/unread$/);
  await expect(sheet).toHaveCount(0);
  await expect(sidebar(page).getByRole("link", { name: /Starter 9000/ })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: /Starter 9001/ })).toBeVisible();
  expect(filed).toEqual([expect.objectContaining({ kind: "person" }), expect.objectContaining({ kind: "person" })]);
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
  const add = (await page.getByRole("button", { name: "Add all five" }).boundingBox())!;
  expect(add.y + add.height).toBeGreaterThan(700);
  // The X goes back to the welcome it opened from.
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page).toHaveURL(/\/unread$/);
  await expect(page.getByRole("heading", { level: 2, name: "Hello. Who would you like to read?" })).toBeVisible();
});

test("a, a website's address and Enter follow it, someone you might write to is asked, and its articles appear", async ({ page }) => {
  await openApp(page, "/all");
  const name = newBlog();
  await page.keyboard.press("a");
  await expect(page).toHaveURL(/\/add$/);
  await expect(field(page)).toBeFocused();

  await page.keyboard.type(`${FEED_SITE}/blog/${name}/`);
  await page.keyboard.press("Enter");

  // Followed: then one question, with nine turtles' guess chosen and the keyboard on it (decision 0163).
  // The field goes; the sheet's title finishes the sentence (the owner's core path, point 1).
  const asked = page.getByRole("group", { name: `Blog ${name} is…` });
  await expect(asked).toBeVisible();
  await expect(page.getByRole("heading", { name: `Blog ${name} is…` })).toBeVisible();
  await expect(field(page)).toHaveCount(0);
  await expect(asked.getByText("You can change this later in Edit.")).toBeVisible();
  await expect(asked.getByRole("radio", { name: "A person", exact: true })).toBeChecked();
  await expect(asked.getByRole("radio", { name: "A person", exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "Done" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toHaveCount(0);
  // Its list opens only once Done is pressed.
  await expect(page).toHaveURL(/\/add$/);
  await tabTo(page, page.getByRole("button", { name: "Done" }));
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/people\/[0-9]+$/);
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
  await page.getByRole("button", { name: "Add", exact: true }).click();
  // A publication, this time: it opens at a publication's address, under Publications.
  await page.getByRole("radio", { name: "A publication", exact: true }).check();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("heading", { level: 2, name: `Blog ${name}` })).toBeVisible();
  await expect(page).toHaveURL(/\/publications\/[0-9]+$/);

  await sidebar(page).getByRole("link", { name: "Add a person or publication" }).click();
  await field(page).fill(`${FEED_SITE}/blog/${name}/`);
  await page.keyboard.press("Enter");
  await expect(page.locator("#feed-address-status")).toHaveText("You already follow this.");
  await expect(sidebar(page).getByRole("link", { name: `Blog ${name}` })).toHaveCount(1);

  await page.getByRole("link", { name: `Go to Blog ${name}` }).click();
  await expect(page.getByRole("heading", { level: 2, name: `Blog ${name}` })).toBeVisible();
});

// A YouTube video's address asks about its channel over one plain row (decision 0213): its name, newest video
// and youtube.com/@handle, never the feed's address. Reached and followed with the keyboard alone.
test("a YouTube video asks \"Follow {channel}?\" over one row, and Follow by keyboard follows the channel", async ({ page }) => {
  const CHANNEL = "https://www.youtube.com/feeds/videos.xml?channel_id=UCYO_jab_esuFRV4b17AJtAw";
  const sent: string[] = [];
  await page.route("**/api/feeds", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const address = (route.request().postDataJSON() as { address: string }).address;
    sent.push(address);
    if (sent.length === 1) {
      return route.fulfill({
        json: { asks: "video", maker: "3Blue1Brown", choices: [{ title: "3Blue1Brown", url: CHANNEL, place: "youtube.com/@3blue1brown", latest: "But what is a neural network?" }] },
      });
    }
    return route.fulfill({ status: 502, json: { error: "unreachable" } });
  });
  await openApp(page, "/add-feed");
  await field(page).fill("https://www.youtube.com/watch?v=aircAruvnKk");
  await page.keyboard.press("Enter");
  await expect(page.locator("#feed-address-status")).toHaveText("Follow 3Blue1Brown?");
  const row = page.locator("#feed-only-choice");
  await expect(row).toContainText("But what is a neural network?");
  await expect(row).toContainText("youtube.com/@3blue1brown");
  await expect(page.getByText(CHANNEL)).toHaveCount(0);
  // One answer, so no radio button and no group to choose in.
  await expect(page.getByRole("radio")).toHaveCount(0);
  const followButton = page.getByRole("button", { name: "Follow", exact: true });
  await expect(followButton).toHaveAccessibleDescription(/3Blue1Brown.*But what is a neural network\?.*youtube\.com\/@3blue1brown/);
  await tabTo(page, followButton);
  await page.keyboard.press("Enter");
  await expect.poll(() => sent).toEqual(["https://www.youtube.com/watch?v=aircAruvnKk", CHANNEL]);
  await expect(page.locator("#feed-address-status")).toHaveText("The site didn't answer. Try again later.");
});

// A playlist offers only the playlist first, chosen, then every video (decision 0213).
test("a YouTube playlist offers Only the playlist first, then Every video", async ({ page }) => {
  await page.route("**/api/feeds", (route) =>
    route.request().method() !== "POST"
      ? route.fallback()
      : route.fulfill({
          json: {
            asks: "playlist",
            maker: "Walks",
            choices: [
              { title: "Only “Rivers”", url: "https://www.youtube.com/feeds/videos.xml?playlist_id=PL0123456789", place: "youtube.com", latest: "The Thames" },
              { title: "Every video", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCYO_jab_esuFRV4b17AJtAw", place: "youtube.com", latest: "A hill" },
            ],
          },
        }),
  );
  await openApp(page, "/add-feed");
  await field(page).fill("https://www.youtube.com/playlist?list=PL0123456789");
  await page.keyboard.press("Enter");
  await expect(page.locator("#feed-address-status")).toHaveText("This playlist is by Walks. Follow only the playlist, or every video?");
  const radios = page.getByRole("radiogroup", { name: "Feeds on this site" }).getByRole("radio");
  await expect(radios).toHaveCount(2);
  await expect(radios.first()).toHaveAccessibleName(/^Only “Rivers”/);
  await expect(radios.first()).toBeChecked();
  await expect(radios.nth(1)).toHaveAccessibleName(/^Every video/);
});

test("a site with several feeds offers them with tick boxes, and those followed together become one person", async ({ page }) => {
  await openApp(page, "/add-feed");
  const name = newBlog("two");
  await field(page).fill(`${FEED_SITE}/blog/${name}/`);
  await page.keyboard.press("Enter");
  await expect(page.locator("#feed-address-status")).toHaveText("This site offers more than one feed. Choose which to follow:");
  // A choice of any: tick boxes, the first ticked, each row ending in a square mark that shows
  // the choice by its check, never by a tint alone (decision 0206).
  const choices = page.getByRole("group", { name: "Feeds on this site" });
  // Each row says what's inside (its newest title) and its address as a person says it (decision 0165), and never how often it posts.
  await expect(choices).toContainText("On keeping a commonplace book (3)");
  await expect(choices).toContainText("/blog/");
  await expect(choices).not.toContainText("http://");
  await expect(choices.getByText(/^(Posts about|Posts less|Hasn't posted in|Too new to tell)/)).toHaveCount(0);
  const [first, comments] = [choices.getByRole("checkbox").first(), choices.getByRole("checkbox", { name: /^Comments/ })];
  await expect(first).toBeChecked();
  await expect(comments).not.toBeChecked();
  // With nothing ticked, Follow says so and follows nothing.
  await first.uncheck();
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(page.locator("#feed-address-status")).toHaveText("Tick at least one first.");
  // Both ticked: Follow follows both, as one person, and their list opens; nothing more is asked.
  await first.check();
  await comments.check();
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(page).toHaveURL(/\/people\/[0-9]+$/);
  await expect(page.getByRole("button", { name: "Done" })).toHaveCount(0);
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`^Blog ${name}`) })).toHaveCount(1);
  const together = async () => {
    const all = (await (await page.request.get(new URL("/api/feeds", FEEDS_APP).href)).json()).feeds as { title: string; person: number | null }[];
    const mine = all.filter((feed) => feed.title.startsWith(`Blog ${name}`));
    return [mine.length, new Set(mine.map((feed) => feed.person)).size, mine.every((feed) => feed.person !== null)];
  };
  await expect.poll(together).toEqual([2, 1, true]);
});

test("in the welcome, the heading stays still as feeds are offered, Add steps aside, and Cancel puts them away", async ({ page }) => {
  await newReader(page, 1280);
  const heading = page.locator("#welcome-heading");
  const top = async () => (await heading.boundingBox())!.y;
  const before = await top();
  await field(page).fill(`${FEED_SITE}/blog/${newBlog("two")}/`);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("group", { name: "Feeds on this site" })).toBeVisible();
  expect(await top()).toBe(before);
  // The field's own Add steps aside: Cancel and Follow sit at the list's foot, and the links under the field wait.
  await expect(page.getByRole("button", { name: "Add", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "New to feeds? Start here" })).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("group", { name: "Feeds on this site" })).toHaveCount(0);
  await expect(field(page)).toBeFocused();
  await expect(page.getByRole("button", { name: "Add", exact: true })).toBeVisible();
  expect(await top()).toBe(before);
});

test("following several, one that can't be followed is named in the list's line, and the rest are followed", async ({ page }) => {
  await openApp(page, "/add-feed");
  const name = newBlog("two");
  await field(page).fill(`${FEED_SITE}/blog/${name}/`);
  await page.keyboard.press("Enter");
  const choices = page.getByRole("group", { name: "Feeds on this site" });
  await choices.getByRole("checkbox", { name: /^Comments/ }).check();
  // The comments feed's follow fails; the first goes through.
  await page.route("**/api/feeds", async (route) => {
    const asked = route.request().postDataJSON() as { address: string };
    if (route.request().method() === "POST" && asked.address.includes("comments")) await route.fulfill({ status: 502, json: { error: "unreachable" } });
    else await route.continue();
  });
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  // One followed: it's asked about as a single feed is, then opens with the note.
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText(/couldn't be followed: The site didn't answer\. Try again later\./)).toBeVisible();
});

test("on a phone, the welcome's offered feeds sit on a grouped card a tone off the page, with Follow the list's full width", async ({ page }) => {
  await newReader(page, 390);
  await page.goto(new URL("/", FEEDS_APP).href);
  await appReady(page);
  await field(page).fill(`${FEED_SITE}/blog/${newBlog("two")}/`);
  await page.keyboard.press("Enter");
  const choices = page.getByRole("group", { name: "Feeds on this site" });
  await expect(choices).toBeVisible();
  // A card, not bare text on the page (finding 12): the list sits on the page (decision 0221), so the card is a tone off it.
  const [card, ground] = await Promise.all([
    choices.evaluate((group) => getComputedStyle(group).backgroundColor),
    page.locator("#list-pane").evaluate((pane) => getComputedStyle(pane).backgroundColor),
  ]);
  expect(card).not.toBe(ground);
  const [follow, list] = await Promise.all([page.getByRole("button", { name: "Follow", exact: true }).boundingBox(), choices.boundingBox()]);
  expect(Math.abs(follow!.width - list!.width)).toBeLessThan(1);
  expect(Math.abs(follow!.x - list!.x)).toBeLessThan(1);
});

test("a page without a feed gets a calm, plain message", async ({ page }) => {
  await openApp(page, "/add-feed");
  await field(page).fill(`${NO_FEED_SITE}/plain/`);
  await page.keyboard.press("Enter");
  await expect(page.locator("#feed-address-status")).toHaveText("nine turtles couldn't find a way to follow this site. You could write to them and ask if they have a feed or a newsletter.");
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
  await expect(page.locator("#feed-address-status")).toHaveText("That doesn't look like a web address. An address looks like example.com.");
});

test("a mistyped address is said with its one repair, as a button: nothing is changed or looked up by itself (decision 0234)", async ({ page }) => {
  await openApp(page, "/add-feed");
  const name = newBlog();
  const meant = `${FEED_SITE}/blog/${name}/`;
  const typed = meant.replace("://", "//");
  let lookups = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/feeds" && request.method() === "POST") lookups += 1;
  });
  await field(page).fill(typed);
  await page.keyboard.press("Enter");
  await expect(page.locator("#feed-address-status")).toHaveText(`That doesn't look like a web address. Did you mean ${meant}?`);
  // The field keeps what was typed, marked, and nothing was sent.
  await expect(field(page)).toHaveValue(typed);
  await expect(field(page)).toHaveAttribute("aria-invalid", "true");
  expect(lookups).toBe(0);
  const use = page.getByRole("button", { name: `Use ${meant}` });
  expect((await use.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // Typing again takes the offer away with its message.
  await field(page).press("End");
  await page.keyboard.type(" ");
  await expect(use).toHaveCount(0);
  await expect(page.locator("#feed-address-status")).toHaveText("");
  await page.keyboard.press("Enter");
  // Pressed (here from the keyboard), the repair goes in the field and is followed.
  await tabTo(page, use);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("group", { name: `Blog ${name} is…` })).toBeVisible();
  expect(lookups).toBe(1);
});

test("Add pressed again after a repair is offered looks the address up as typed", async ({ page }) => {
  await openApp(page, "/add-feed");
  await field(page).fill("gardenletters,blog");
  await page.keyboard.press("Enter");
  const status = page.locator("#feed-address-status");
  await expect(status).toHaveText("That doesn't look like a web address. Did you mean gardenletters.blog, with a dot?");
  const sent = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/feeds" && request.method() === "POST");
  await page.keyboard.press("Enter");
  expect((await sent).postDataJSON()).toMatchObject({ address: "gardenletters,blog" });
  // nine turtles can't read it either, so the repair is offered again.
  await expect(page.getByRole("button", { name: "Use gardenletters.blog" })).toBeVisible();
});

test("changing the address after a choice of feeds takes the old choices away", async ({ page }) => {
  await openApp(page, "/add-feed");
  await field(page).fill(`${FEED_SITE}/blog/${newBlog("two")}/`);
  await page.keyboard.press("Enter");
  const choices = page.getByRole("group", { name: "Feeds on this site" });
  await expect(choices).toBeVisible();
  // The ticked feed fails for an address reason: the field is marked, and the choices stay to pick another.
  await page.route("**/api/feeds", (route) =>
    route.request().method() === "POST" ? route.fulfill({ status: 422, json: { error: "not-found" } }) : route.continue(),
  );
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(page.locator("#feed-address-status")).toHaveText("Nothing was found at that address.");
  await expect(field(page)).toHaveAttribute("aria-invalid", "true");
  await page.unroute("**/api/feeds");
  // They belong to the old address: typing another one clears them and all that was said, red edge included, and Add looks again.
  await field(page).fill(`${NO_FEED_SITE}/plain/`);
  await expect(choices).toHaveCount(0);
  await expect(page.locator("#feed-address-status")).toHaveText("");
  await expect(field(page)).not.toHaveAttribute("aria-invalid", "true");
  await page.keyboard.press("Enter");
  await expect(page.locator("#feed-address-status")).toHaveText("nine turtles couldn't find a way to follow this site. You could write to them and ask if they have a feed or a newsletter.");
});

test("without a connection, adding says so without marking the address as wrong", async ({ page, context }) => {
  await openApp(page, "/add-feed");
  await field(page).fill(`${FEED_SITE}/blog/${newBlog()}/`);
  await context.setOffline(true);
  await page.keyboard.press("Enter");
  await expect(page.locator("#feed-address-status")).toHaveText("You're offline. Adding a feed works again once you're back online.");
  await expect(field(page)).not.toHaveAttribute("aria-invalid", "true");
  await context.setOffline(false);
});

test("Escape while nine turtles is still looking leaves you where you were, with the feed in the sidebar", async ({ page }) => {
  await openApp(page, "/all");
  // A slow site: the answer comes after the reader has closed the sheet.
  let answer: () => void = () => {};
  const answered = new Promise<void>((resolve) => (answer = resolve));
  await page.route("**/api/feeds", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await answered;
    await route.continue();
  });
  const name = newBlog();
  await page.keyboard.press("a");
  await field(page).fill(`${FEED_SITE}/blog/${name}/`);
  await page.keyboard.press("Enter");
  await expect(page.locator("#feed-address-status")).toHaveText("Looking…");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/all$/);
  answer();
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`Blog ${name}`) })).toBeVisible();
  await expect(page).toHaveURL(/\/all$/);
});

test("Escape leaves Add for the list you were on", async ({ page }) => {
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
  await sidebar(page).getByRole("link", { name: /^Quiet Notes( unread)?$/ }).click();

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
  await expect(page.locator("#feed-address-status")).toHaveText("This site offers more than one feed. Choose which to follow:");

  // Tab reaches the first feed, ticked; Space unticks it, and the next is ticked the same way; Follow follows it.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("checkbox").first()).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByRole("checkbox").first()).not.toBeChecked();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("checkbox", { name: /^Comments/ })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByRole("checkbox", { name: /^Comments/ })).toBeChecked();
  await tabTo(page, page.getByRole("button", { name: "Follow", exact: true }));
  await page.keyboard.press("Enter");
  // A person or a publication: an arrow key changes the answer, and Done opens it.
  await expect(page.getByRole("radio", { name: "A person", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: "A publication", exact: true })).toBeChecked();
  await tabTo(page, page.getByRole("button", { name: "Done" }));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/publications\/[0-9]+$/);
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
  await expect(page.locator("#feed-address-status")).toHaveText("You already follow this.");
  await tabTo(page, page.getByRole("link", { name: /^Go to / }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 2, name: `Blog ${name}` })).toBeFocused();
});

test("with only the keyboard: Tab reaches Show older articles, and the keyboard's place stays in the list at the end", async ({ page }) => {
  await openApp(page, "/all");
  await follow(page, `${FEED_SITE}/`);
  await page.reload();
  await appReady(page);
  const feed = sidebar(page).getByRole("link", { name: /^Quiet Notes( unread)?$/ });
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
  await expect(page.getByRole("heading", { level: 2, name: "Not found" })).toBeVisible();
  await expect(page.getByText("You don't follow anyone at this address.")).toBeVisible();
});

// Adding from elsewhere (SPEC section 3, decisions 0104 and 0138): a share menu, an Apple
// Shortcuts shortcut or a bookmark opens /add-feed with the page's address, and nine turtles asks
// "Follow <name>?". Each test here looks once at the made-up publisher through the feed finder,
// which allows only a few lookups a site (six in half an hour: five are used here).

/** The reader's feeds as the server has them, signed in as the page is. */
async function followed(page: Page): Promise<string> {
  const answer = await page.request.get(`${FEEDS_APP}/api/feeds`);
  expect(answer.ok()).toBe(true);
  return answer.text();
}

/** The question's form: the site, the status line and its buttons. */
const question = (page: Page) => page.locator("form", { has: page.getByRole("button", { name: "Follow", exact: true }) });

test("a shared page asks \"Follow <name>?\", but follows only on Follow", async ({ page, isMobile }) => {
  const name = newBlog();
  const address = `${FEED_SITE}/blog/${name}/`;
  // Signed out at first: after signing in, the question opens with the address kept. On a computer
  // it's the sheet; on a phone (checked at a phone's width) the phone's page sheet.
  await page.setViewportSize(isMobile ? { width: 390, height: 800 } : { width: 1280, height: 800 });
  await page.goto(new URL(`/add-feed?url=${encodeURIComponent(address)}`, FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await expect(page).toHaveURL(/\/add$/);
  const title = page.getByRole("heading", { name: `Follow Blog ${name}?` });
  await expect(title).toBeVisible();
  await expect(page).toHaveTitle(`Follow Blog ${name}? · nine turtles`);
  // Screen readers hear the question with the name once it's known, and no word of feeds or RSS anywhere.
  await expect(question(page).getByRole("status")).toHaveText(`Follow Blog ${name}?`);
  await expect(question(page)).not.toContainText(/feed|rss/i);
  await expect(page.getByLabel("Their website's address")).toHaveCount(0);
  // What they wrote lately, so the reader knows who they're saying yes to.
  await expect(page.getByRole("region", { name: "Lately" }).getByRole("listitem")).toHaveCount(3);
  // Nothing is followed yet: not in the sidebar, not on the server.
  await expect(sidebar(page).getByRole("link", { name: `Blog ${name}` })).toHaveCount(0);
  expect(await followed(page)).not.toContain(name);
  if (isMobile) {
    // On a phone: Follow, the full width at the screen's foot.
    await page.getByRole("button", { name: "Follow", exact: true }).tap();
  } else {
    // With only the keyboard: the sheet opens on its question, Tab reaches Follow, and Enter follows.
    await expect(title).toBeFocused();
    await tabTo(page, page.getByRole("button", { name: "Follow", exact: true }), 5);
    await page.keyboard.press("Enter");
  }
  await expect(page).toHaveURL(/\/people\/[0-9]+$/);
  expect(await followed(page)).toContain(name);
});

test("a share menu's text with the address inside it works too, and Escape follows nothing", async ({ page, isMobile }) => {
  test.skip(isMobile, "a computer's sheet and keys; the phone's page sheet is checked at a phone's width by the test above");
  // Installed on Android, nine turtles is offered in the share menu.
  const manifest = await (await page.request.get(`${FEEDS_APP}/manifest.webmanifest`)).json();
  expect(manifest.share_target).toEqual({ action: "/add-feed", method: "GET", params: { title: "title", text: "text", url: "url" } });

  // A site naming two feeds: still one question, and Follow would follow its first.
  const name = newBlog("two");
  const address = `${FEED_SITE}/blog/${name}/`;
  const text = `Have a look at ${address}, it's lovely.`;
  await openApp(page, `/add-feed?title=${encodeURIComponent(`Blog ${name}`)}&text=${encodeURIComponent(text)}`);
  const sheet = page.getByRole("dialog", { name: `Follow Blog ${name}?` });
  await expect(sheet.getByRole("button", { name: "Follow", exact: true })).toHaveAttribute("aria-disabled", "false");
  await expect(sheet.getByRole("radio")).toHaveCount(0);
  // Escape leaves without following anything.
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(sidebar(page).getByRole("link", { name: `Blog ${name}` })).toHaveCount(0);
  expect(await followed(page)).not.toContain(name);
  // The shared address was for that one opening: Add opens empty again.
  await page.keyboard.press("a");
  await expect(field(page)).toHaveValue("");
});

test("a page that can't be followed says so plainly, keeps Follow locked, and Not now leaves", async ({ page, isMobile }) => {
  test.skip(isMobile, "the computer's sheet; the phone's page sheet is the same form");
  await openApp(page, `/add-feed?url=${encodeURIComponent(`${FEED_SITE}/no-such-page-${newBlog()}`)}`);
  const sheet = page.getByRole("dialog", { name: "Follow this person?" });
  await expect(sheet.getByRole("status")).toHaveText("Nothing was found at that address.");
  await expect(sheet.getByRole("button", { name: "Follow", exact: true })).toHaveAttribute("aria-disabled", "true");
  await sheet.getByRole("button", { name: "Not now" }).click();
  await expect(sheet).toHaveCount(0);
});

test("Follow on someone already followed takes you to them", async ({ page, isMobile }) => {
  test.skip(isMobile, "the computer's sheet; the phone's page sheet is the same form");
  const name = newBlog();
  await openApp(page, "/unread");
  const id = await follow(page, `${FEED_SITE}/blog/${name}/`);
  await page.goto(new URL(`/add?url=${encodeURIComponent(`${FEED_SITE}/blog/${name}/`)}`, FEEDS_APP).href);
  await appReady(page);
  const sheet = page.getByRole("dialog", { name: `Follow Blog ${name}?` });
  await sheet.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/people/${id}$`));
});

test("Settings gives a computer a bookmark button to drag, built from this nine turtles' own address", async ({ page }) => {
  await openApp(page, "/settings/install");
  const group = page.getByRole("region", { name: "Install the app on any device" });
  await group.getByText("Computer", { exact: true }).click();
  const button = group.getByRole("link", { name: "Add to nine turtles" });
  await expect(button).toHaveAttribute("href", `javascript:void(location.href='${FEEDS_APP}/add?url='+encodeURIComponent(location.href))`);
  // Pressed in the app, it says where it works instead of going anywhere.
  await button.click();
  await expect(group.getByRole("status").filter({ hasText: "Drag it" })).toHaveText("Drag it to your bookmarks bar: it works from there.");
  await expect(page).toHaveURL(/\/settings\/install$/);
  // No raw bookmark code and no Copy: the button is the one way on a computer.
  await expect(group.getByRole("button", { name: /Copy/ })).toHaveCount(0);
  await expect(group.getByText("javascript:")).toHaveCount(0);
  // Until the Shortcut's link exists, the iPhone tab says what to do instead, and no button leads nowhere.
  await group.getByText("iPhone & iPad", { exact: true }).click();
  await expect(group.getByRole("link", { name: /Get the Shortcut/ })).toHaveCount(0);
  await expect(group.getByText("Copy the blog's address, then paste it into + Add.")).toBeVisible();
});

test("a site with no feed offers to ask them for one: Write to finds their address on their site", async ({ page }) => {
  // Decision 0212: no dead ends.
  await openApp(page, "/add-feed");
  await field(page).fill(`${NO_FEED_SITE}/plain/`);
  await page.keyboard.press("Enter");
  await expect(page.locator("#feed-address-status")).toContainText("couldn't find a way to follow this site");
  const ask = page.getByRole("region", { name: "Ask them for a feed" });
  const write = ask.getByRole("button", { name: "Write to localhost" });
  // An everyday button: Add stays the sheet's one solid button.
  await expect(write).not.toHaveClass(/btn-primary/);
  await tabTo(page, write);
  await page.keyboard.press("Enter");
  const address = ask.getByLabel("Their email address");
  await expect(address).toHaveValue("june@june.example");
  await expect(ask).toContainText("Found on their site. Check it, then press Write.");
  await expect(ask.getByRole("button", { name: "Write", exact: true })).toBeVisible();
  // Not now puts it back, with the keyboard on Write to.
  await ask.getByRole("button", { name: "Not now" }).click();
  await expect(write).toBeFocused();
});
