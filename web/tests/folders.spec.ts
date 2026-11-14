import { expect, test, type Locator, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn, tabTo } from "./screens";

// SPEC sections 5 (sidebar search), 15 (folders and managing feeds) and 16
// (OPML import and export), "How to check it", done by a browser. Each test
// uses blogs and folder names of its own, since every test shares the one
// nine turtles that has feeds.

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });
const line = (page: Page) => page.getByRole("status").filter({ hasText: /\S/ }).first();
/** The list's More (…) button; "Info about …" and Edit folder are in its menu (decision 0038). */
const more = (page: Page) => page.getByRole("button", { name: "More", exact: true });
/** Their page, beside the list: "About Alpha" to screen readers, never the list's own name. */
const whoPage = (page: Page, name: string) => page.getByRole("region", { name: `About ${name}`, exact: true });

async function openEdit(page: Page, name: "Edit folder") {
  await more(page).click();
  await page.getByRole("menuitem", { name }).click();
}

/** Their settings, a page of its own one row on from their page (decision 0267). */
const settingsOf = (page: Page, name: string) => page.getByRole("region", { name: `Settings for ${name}`, exact: true });

/** Their settings, from the list's More (Info about …) and the Settings row on their page, with Folders opened (decisions 0254, 0267). */
async function editWho(page: Page, name: string) {
  await more(page).click();
  await page.getByRole("menuitem", { name: `Info about ${name}` }).click();
  await whoPage(page, name).getByRole("link", { name: `Settings for ${name}`, exact: true }).click();
  await settingsOf(page, name).getByRole("button", { name: /^Folders/ }).click();
  await expect(page.getByLabel("New folder")).toBeVisible();
}

/** The same with only the keyboard: More, its last item (Info about …), Tab to the Settings row and Enter, then Tab to Folders and Enter. */
async function editWhoByKeys(page: Page, name: string) {
  await tabTo(page, more(page));
  await page.keyboard.press("Enter");
  await page.keyboard.press("End");
  await expect(page.getByRole("menuitem", { name: `Info about ${name}` })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(whoPage(page, name).getByRole("heading", { level: 2, name })).toBeFocused();
  await tabTo(page, whoPage(page, name).getByRole("link", { name: `Settings for ${name}`, exact: true }));
  await page.keyboard.press("Enter");
  await expect(settingsOf(page, name).getByRole("heading", { level: 2, name: "Settings" })).toBeFocused();
  await tabTo(page, settingsOf(page, name).getByRole("button", { name: /^Folders/ }));
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("New folder")).toBeVisible();
}

test.skip(({ isMobile }) => isMobile, "the wide layout shows the sidebar beside the list");
// Unsubscribing ends the Undo of any earlier unsubscribe (only the last
// action can be undone), so the tests that unsubscribe run one at a time.
test.describe.configure({ mode: "serial" });

/**
 * Does `act` make nine turtles open the device's file chooser? It counts the
 * hidden file field being clicked, which is all nine turtles itself does. The
 * test browser's own "file chooser" event isn't used: under load, Chromium
 * sometimes doesn't show the chooser even though the field was clicked.
 */
async function opensFilePicker(page: Page, act: () => Promise<void>, accepts = "opml"): Promise<void> {
  const field = page.locator(`input[type="file"][accept*="${accepts}"]`);
  await field.evaluate((input) => {
    input.addEventListener("click", (event) => {
      event.preventDefault();
      input.dataset.opened = "yes";
    }, { once: true });
  });
  await act();
  await expect(field).toHaveAttribute("data-opened", "yes");
}

/** A name no other test uses. */
function unique(prefix: string): string {
  return `${prefix}-${test.info().workerIndex}-${Date.now()}`;
}

/** Signs in, follows new blogs, and opens the first one's list. Returns their feed numbers. */
async function openBlogs(page: Page, names: string[]): Promise<number[]> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const ids = [];
  for (const name of names) ids.push(await follow(page, `${FEED_SITE}/blog/${name}/`));
  await page.goto(new URL(`/people/${ids[0]}`, FEEDS_APP).href);
  await appReady(page);
  await expect(page.getByRole("heading", { level: 2, name: `Blog ${names[0]}` })).toBeVisible();
  return ids;
}

test("a feed put in two folders appears under both", async ({ page }) => {
  const blog = unique("filed");
  const [first, second] = [unique("Essays"), unique("Letters")];
  await openBlogs(page, [blog]);

  await editWho(page, `Blog ${blog}`);
  // Their settings, a page of their own beside their list: no Edit mode, and nothing waits for a Done.
  await expect(page).toHaveURL(/\/people\/[0-9]+\/settings$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".item-row")).toHaveCount(3);
  await expect(page.getByRole("button", { name: /^(Done|Cancel)$/ })).toHaveCount(0);
  await page.getByLabel("New folder").fill(first);
  await page.getByLabel("New folder").press("Enter");
  await expect(page.getByRole("checkbox", { name: first })).toBeChecked();
  // The folders are a checklist whose first row is "New folder…" (decision 0261), one grouped list (decision 0042).
  // Each folder's mark is a tick box (a rounded square, not a ring, since several can be ticked):
  // filled with a check when the feed is in it, empty when it isn't, and each row is 44px (decision 0045).
  const newFolder = page.getByLabel("New folder");
  await expect(newFolder).toHaveAttribute("placeholder", "New folder…");
  expect(await newFolder.evaluate((element) => element.closest(".inset-group")?.querySelectorAll(".check-row").length)).toBeGreaterThanOrEqual(1);
  // New folder… comes before every folder, found without scrolling past them (decision 0261).
  expect(await newFolder.evaluate((element) => !!(element.closest("form")!.compareDocumentPosition(element.closest(".inset-group")!.querySelector(".check-row")!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  const mark = page.locator(".check-row").filter({ hasText: first }).locator(".check-mark");
  const ink = await page.locator("body").evaluate((body) => getComputedStyle(body).color);
  await expect(mark).toHaveCSS("background-color", ink);
  await expect(mark).not.toHaveCSS("border-top-left-radius", "9999px");
  expect((await page.locator(".check-row").filter({ hasText: first }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.getByRole("checkbox", { name: first }).uncheck();
  await expect(mark).toBeVisible();
  await expect(mark).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await page.getByRole("checkbox", { name: first }).check();
  await page.getByRole("textbox", { name: "Name" }).fill(`Renamed ${blog}`);
  await page.getByRole("textbox", { name: "Name" }).press("Enter");
  await page.getByLabel("New folder").fill(second);
  await page.getByLabel("New folder").press("Enter");
  await expect(page.locator("#list-heading")).toContainText(`Renamed ${blog}`);

  // Folders are listed (their unread kept only for the tests). Each one made or chose on their page opened, to show them in it
  // (the owner's core path, point 14); its arrow closes and opens it again.
  for (const folder of [first, second]) {
    await expect(sidebar(page).getByRole("link", { name: `${folder}`, exact: true }).and(page.locator(`[data-unread="3"]`))).toBeVisible();
    const toggle = sidebar(page).getByRole("button", { name: `What's in ${folder}` });
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }
  // Under both, and nowhere else.
  await expect(sidebar(page).getByRole("link", { name: `Renamed ${blog}`, exact: true }).and(page.locator(`[data-unread="3"]`))).toHaveCount(2);
  // A folder's arrow sits at the row's right end, so the name starts on the
  // margin with nothing before it (decisions 0041, 0123).
  const folderLink = sidebar(page).getByRole("link", { name: `${first}`, exact: true }).and(page.locator(`[data-unread="3"]`));
  const arrow = (await sidebar(page).getByRole("button", { name: `What's in ${first}` }).boundingBox())!;
  const folderBox = (await folderLink.boundingBox())!;
  expect(Math.abs(arrow.x + arrow.width - (folderBox.x + folderBox.width))).toBeLessThan(1);
  // A folder's name starts where the icons do; its feeds, like every other name, on Unread's edge (decision 0123).
  const nameStart = (link: Locator) =>
    link.evaluate((element) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, (node) => (node.textContent!.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP));
      const range = document.createRange();
      range.selectNodeContents(walker.nextNode()!);
      return range.getBoundingClientRect().left;
    });
  const labelEdge = await nameStart(sidebar(page).getByRole("link", { name: "Unread", exact: true }));
  expect(Math.abs((await nameStart(folderLink)) - labelEdge + 28)).toBeLessThan(1);
  expect(Math.abs((await nameStart(sidebar(page).getByRole("link", { name: `Renamed ${blog}`, exact: true }).and(page.locator(`[data-unread="3"]`)).first())) - labelEdge)).toBeLessThan(1);
  // No dots on folders or people: only Unread carries one (decision 0242).
  await expect(sidebar(page).locator("[data-folder-link] .sidebar-dot, [data-unread] .sidebar-dot")).toHaveCount(0);

  // A folder's own list holds its feeds' articles.
  await sidebar(page).getByRole("link", { name: `${first}`, exact: true }).and(page.locator(`[data-unread="3"]`)).click();
  await expect(page).toHaveURL(/\/folders\/[0-9]+$/);
  await expect(page.getByRole("heading", { level: 2, name: first })).toBeFocused();
  await expect(page.getByRole("region", { name: first }).getByRole("listitem")).toHaveCount(3);
  // The whole row is its toggle: choosing the folder you're in folds it, and again unfolds it (decision 0123).
  const firstToggle = sidebar(page).getByRole("button", { name: `What's in ${first}` });
  await expect(firstToggle).toHaveAttribute("aria-expanded", "true");
  const firstRow = sidebar(page).locator(`[data-folder-link]`, { hasText: first }).first();
  await expect(firstRow).toHaveAttribute("aria-expanded", "true");
  await firstRow.click();
  await expect(firstToggle).toHaveAttribute("aria-expanded", "false");
  // A screen reader hears the change on the name too.
  await expect(firstRow).toHaveAttribute("aria-expanded", "false");
  await expect(page).toHaveURL(/\/folders\/[0-9]+$/);
  await firstRow.click();
  await expect(firstToggle).toHaveAttribute("aria-expanded", "true");
  // With the keyboard too: Enter on the folder you're in folds it.
  await firstRow.focus();
  await page.keyboard.press("Enter");
  await expect(firstToggle).toHaveAttribute("aria-expanded", "false");
  // The arrow waits unseen at the row's end (the pointer moved away), and shows once the keyboard reaches it.
  await page.mouse.move(700, 500);
  await expect(firstToggle).toHaveCSS("opacity", "0");
  await page.keyboard.press("Tab");
  await expect(firstToggle).toBeFocused();
  await expect(firstToggle).toHaveCSS("opacity", "1");
  await page.keyboard.press("Enter");
  await expect(firstToggle).toHaveAttribute("aria-expanded", "true");
});

test("rename a folder; delete it, its feeds stay, and Undo brings it back", async ({ page }) => {
  const blog = unique("kept");
  const folder = unique("Zz-folder");
  const ids = await openBlogs(page, [blog]);
  await page.request.post(new URL(`/api/feeds/${ids[0]}`, FEEDS_APP).href, {
    data: { title: `Blog ${blog}`, folders: [], new_folder: folder },
  });
  await page.reload();
  await appReady(page);

  await sidebar(page).getByRole("link", { name: new RegExp(`^${folder}`) }).click();
  await openEdit(page, "Edit folder");
  await expect(page.getByRole("heading", { level: 2, name: "Edit folder" })).toBeFocused();
  // Escape goes back unchanged, the keyboard back on More, where Edit folder was chosen.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { level: 2, name: folder })).toBeVisible();
  await expect(more(page)).toBeFocused();
  // So does Cancel.
  await openEdit(page, "Edit folder");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(more(page)).toBeFocused();

  await openEdit(page, "Edit folder");
  await page.getByRole("textbox", { name: "Name" }).fill(`Aa-${folder}`);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { level: 2, name: `Aa-${folder}` })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`^Aa-${folder}`) })).toBeVisible();

  await openEdit(page, "Edit folder");
  await page.getByRole("button", { name: `Delete Aa-${folder}` }).click();
  await expect(page).toHaveURL(/\/unread$/);
  await expect(line(page)).toHaveText(`Deleted the folder Aa-${folder}.`);
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`^Aa-${folder}`) })).toHaveCount(0);
  // The feed stays, now in no folder.
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`^Blog ${blog}`) })).toBeVisible();

  await page.keyboard.press("u");
  await expect(line(page)).toHaveText("Undone.");
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`^Aa-${folder}`) })).toBeVisible();
  // The feed is back in its folder, open since choosing it opened it (decision 0123), and in no other place.
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`^Blog ${blog}`) })).toHaveCount(1);
  await expect(sidebar(page).locator('ul[id^="folder-"]').getByRole("link", { name: new RegExp(`^Blog ${blog}`) })).toBeVisible();
});

test("unsubscribe, then Undo: the feed is back with its read history; a star outlives unsubscribing", async ({ page }) => {
  const [blog, other] = [unique("leaving"), unique("starred")];
  await openBlogs(page, [blog, other]);
  await expect(page.getByRole("region", { name: `Blog ${blog}` }).getByRole("listitem")).toHaveCount(3);
  // One article read.
  await page.keyboard.press("j");
  await expect(sidebar(page).getByRole("link", { name: `Blog ${blog}`, exact: true }).and(page.locator(`[data-unread="2"]`))).toBeVisible();

  await editWho(page, `Blog ${blog}`);
  // At the foot of their settings, in red words that say what it does, a full row to press.
  const edit = settingsOf(page, `Blog ${blog}`);
  const leave = edit.getByRole("button", { name: `Unsubscribe from Blog ${blog}` });
  await expect(leave).toHaveText(`Unsubscribe from Blog ${blog}`);
  const [red, ink] = await Promise.all([leave.evaluate((e) => getComputedStyle(e).color), edit.evaluate((e) => getComputedStyle(e).color)]);
  expect(red).not.toBe(ink);
  const [leaveBox, settingsBox] = await Promise.all([leave.boundingBox(), edit.getByRole("textbox", { name: "Name" }).boundingBox()]);
  expect(leaveBox!.y).toBeGreaterThan(settingsBox!.y);
  expect(leaveBox!.height).toBeGreaterThanOrEqual(44);
  await leave.click();
  await expect(page).toHaveURL(/\/unread$/);
  await expect(line(page)).toHaveText(`Unsubscribed from Blog ${blog}.`);
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`^Blog ${blog}`) })).toHaveCount(0);
  await expect(page.getByRole("button", { name: new RegExp(`Blog ${blog} ·`) })).toHaveCount(0);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(line(page)).toHaveText("Undone.");
  await expect(sidebar(page).getByRole("link", { name: `Blog ${blog}`, exact: true }).and(page.locator(`[data-unread="2"]`))).toBeVisible();

  // The other blog: star its newest article, then unsubscribe.
  await sidebar(page).getByRole("link", { name: new RegExp(`^Blog ${other}`) }).click();
  await expect(page.getByRole("region", { name: `Blog ${other}` }).getByRole("listitem")).toHaveCount(3);
  await page.keyboard.press("j");
  await page.keyboard.press("s");
  await expect(line(page)).toHaveText("Starred.");
  await editWho(page, `Blog ${other}`);
  await page.getByRole("button", { name: `Unsubscribe from Blog ${other}` }).click();
  // With a star there, it asks first whether to keep it (SPEC section 42).
  const keep = page.getByRole("group", { name: `Keep what you saved from Blog ${other}?` });
  await expect(keep).toContainText("You starred 1 of their articles.");
  await keep.getByRole("button", { name: "Keep them" }).click();
  await expect(line(page)).toHaveText(`Unsubscribed from Blog ${other}.`);
  // Other tests star articles too, so look through every page of Starred.
  const starredFrom: string[] = [];
  for (let after: string | null = null, first = true; first || after; first = false) {
    const query: string = after ? `view=starred&after=${after}` : "view=starred";
    const body = await (await page.request.get(new URL(`/api/articles?${query}`, FEEDS_APP).href)).json();
    starredFrom.push(...body.articles.map((each: { feed_title: string }) => each.feed_title));
    after = body.next;
  }
  expect(starredFrom).toContain(`Blog ${other}`);
});

test("the sidebar search finds feeds and folders by name, and Escape empties it", async ({ page }) => {
  const blog = unique("findable");
  await openBlogs(page, [blog]);
  const search = sidebar(page).getByRole("searchbox", { name: "Find a person or folder" });
  // The same faintly filled capsule as the list's search, at rest and in use (decision 0051).
  await expect(search).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await search.fill(blog.toUpperCase());
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`^Blog ${blog}`) })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: /^Quiet Notes/ })).toHaveCount(0);

  await search.fill(`${blog}-nothing`);
  await expect(sidebar(page).getByText(`No person or folder is called “${blog}-nothing”.`)).toBeVisible();

  await search.press("Escape");
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
});

test("the sidebar search also searches articles: its row, or Enter, searches All articles for the same words (decision 0231)", async ({ page }) => {
  const blog = unique("words-in-articles");
  await openBlogs(page, [blog]);
  const search = sidebar(page).getByRole("searchbox", { name: "Find a person or folder" });
  await search.fill("allotment");
  await expect(sidebar(page).getByText("No person or folder is called “allotment”.")).toBeVisible();
  await sidebar(page).getByRole("button", { name: "Search articles for “allotment”" }).click();
  await expect(page).toHaveURL(/\/all$/);
  await expect(search).toHaveValue("");
  const field = page.getByRole("textbox", { name: "Search articles", exact: true });
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("allotment");
  await expect(page.getByRole("region", { name: /^Results in / })).toBeVisible();

  // Enter in the sidebar's field does the same, even when a name matched.
  await search.fill(blog);
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`^Blog ${blog}`) })).toBeVisible();
  await search.press("Enter");
  await expect(field).toHaveValue(blog);
});

test("import an OPML file from Settings: a plain summary, folders in the sidebar, Undo; export downloads them", async ({ page }) => {
  const [one, two] = [unique("imported"), unique("imported-too")];
  const folder = unique("From OPML");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/settings/data", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const file = `<?xml version="1.0"?>
<opml version="2.0"><head><title>Made-up feeds</title></head><body>
  <outline text="${folder}">
    <outline type="rss" text="Blog ${one}" xmlUrl="${FEED_SITE}/blog/${one}/feed.xml"/>
    <outline type="rss" text="Blog ${two}" xmlUrl="${FEED_SITE}/blog/${two}/feed.xml"/>
  </outline>
  <outline type="rss" text="Broken line" xmlUrl="nowhere"/>
</body></opml>`;

  await expect(page.getByRole("heading", { level: 2, name: "Your data" })).toBeVisible();
  // The button opens the device's file chooser; the file is then handed
  // over the way a chosen file is.
  await opensFilePicker(page, () => page.getByRole("button", { name: "Import OPML" }).click());
  await page.locator('input[type="file"][accept*="opml"]').evaluate((input: HTMLInputElement, text) => {
    const chosen = new DataTransfer();
    chosen.items.add(new File([text], "made-up.opml", { type: "text/x-opml" }));
    input.files = chosen.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, file);
  await expect(page.getByText("Added 2 feeds and 1 folder. Their articles arrive over the next few minutes.")).toBeVisible();
  await expect(page.getByText("1 line couldn't be read: Broken line.")).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`^${folder}`) })).toBeVisible();

  // Download everything holds them, in an OPML file beside its pages (decision 0251).
  const everything = page.getByRole("link", { name: "Download everything" });
  await expect(everything).toHaveAttribute("download", "");
  const exported = await page.request.get(new URL((await everything.getAttribute("href")) ?? "", FEEDS_APP).href);
  expect(exported.headers()["content-type"]).toBe("application/zip");
  expect(exported.headers()["content-disposition"]).toMatch(/^attachment; filename="nine-turtles-\d{4}-\d{2}-\d{2}\.zip"$/);
  // The zip stores its files as they are, so the OPML file's words are in it as written.
  const text = (await exported.body()).toString("utf8");
  expect(text).toContain("/index.html");
  expect(text).toContain(`<outline text="${folder}"`);
  expect(text).toContain(`xmlUrl="${FEED_SITE}/blog/${one}/feed.xml"`);

  // Wrong file? Undo the import takes away exactly what it added (decision 0238).
  await expect(page.getByText("Wrong file?")).toBeVisible();
  // From the keyboard: then the keyboard's place waits on the page's heading.
  await tabTo(page, page.getByRole("button", { name: "Undo the import" }));
  await page.keyboard.press("Enter");
  await expect(page.getByText("Undone.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Your data" })).toBeFocused();
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`^${folder}`) })).toHaveCount(0);

  // Stars come over from another feed reader's export, into Starred.
  const title = unique("Brought over");
  const stars = JSON.stringify({
    items: [
      {
        title,
        published: 1_700_000_000,
        alternate: [{ href: "https://elsewhere.example/post" }],
        summary: { content: "<p>From another app.</p>" },
        origin: { streamId: "feed/https://elsewhere.example/feed.xml", title: "Elsewhere" },
      },
      { title: "No link" },
    ],
  });
  await opensFilePicker(page, () => page.getByRole("button", { name: "Import starred articles" }).click(), "json");
  await page.locator('input[type="file"][accept*="json"]').evaluate((input: HTMLInputElement, text) => {
    const chosen = new DataTransfer();
    chosen.items.add(new File([text], "starred.json", { type: "application/json" }));
    input.files = chosen.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, stars);
  await expect(page.getByText("Starred 1 article. It's in Starred, with a link to the original.")).toBeVisible();
  await expect(page.getByText("1 article couldn't be brought over, as the file gives no link to the original.")).toBeVisible();
  await sidebar(page).getByRole("link", { name: /^Starred/ }).click();
  await expect(page.getByText(title)).toBeVisible();
});

test("with only the keyboard: their settings, a new folder, opening it, Edit folder, Unsubscribe, Import OPML, importing stars and the starred export", async ({ page }) => {
  const blog = unique("keys");
  const folder = unique("Keyboard");
  await openBlogs(page, [blog]);

  await editWhoByKeys(page, `Blog ${blog}`);
  await tabTo(page, page.getByLabel("New folder"));
  await page.keyboard.type(folder);
  await page.keyboard.press("Enter");
  // Enter makes it and puts them in it, at once, in their settings.
  await expect(page).toHaveURL(/\/people\/[0-9]+\/settings$/);
  await expect(page.getByRole("checkbox", { name: folder })).toBeChecked();

  // The folder just made opens (the core path); its button closes and opens it, by Enter.
  const toggle = sidebar(page).getByRole("button", { name: `What's in ${folder}` });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`^Blog ${blog}`) })).toBeVisible();
  await tabTo(page, toggle);
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  // Untick the folder in their settings: Space on the checkbox, and it counts at once.
  await tabTo(page, page.getByRole("checkbox", { name: folder }));
  await page.keyboard.press("Space");
  await expect(page.getByRole("checkbox", { name: folder })).not.toBeChecked();
  await expect(page.getByRole("button", { name: /^Folders/ })).toContainText("None");

  // Edit folder, from the folder's own list.
  await tabTo(page, sidebar(page).getByRole("link", { name: new RegExp(`^${folder}`) }));
  await page.keyboard.press("Enter");
  await tabTo(page, more(page));
  await page.keyboard.press("Enter");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 2, name: "Edit folder" })).toBeFocused();
  await tabTo(page, page.getByRole("button", { name: `Delete ${folder}` }));
  await page.keyboard.press("Enter");
  await expect(line(page)).toHaveText(`Deleted the folder ${folder}.`);

  // Unsubscribe, and u brings the feed back. The feed leaves the deleted folder for the sidebar's top level; wait for it there before tabbing.
  const feedLink = sidebar(page).getByRole("link", { name: new RegExp(`^Blog ${blog}`) });
  await expect(feedLink).toBeVisible();
  await tabTo(page, feedLink);
  await page.keyboard.press("Enter");
  await editWhoByKeys(page, `Blog ${blog}`);
  await tabTo(page, page.getByRole("button", { name: `Unsubscribe from Blog ${blog}` }));
  await page.keyboard.press("Enter");
  await expect(line(page)).toHaveText(`Unsubscribed from Blog ${blog}.`);
  await page.keyboard.press("u");
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`^Blog ${blog}`) })).toBeVisible();

  // Import OPML opens the device's file chooser from the keyboard too.
  await page.goto(new URL("/settings/data", FEEDS_APP).href);
  await appReady(page);
  await tabTo(page, page.getByRole("button", { name: "Import OPML" }));
  await opensFilePicker(page, () => page.keyboard.press("Enter"));

  // So does Import starred articles.
  await opensFilePicker(
    page,
    async () => {
      await tabTo(page, page.getByRole("button", { name: "Import starred articles" }));
      await page.keyboard.press("Enter");
    },
    "json",
  );
  // So does Download everything: Enter downloads the file.
  await tabTo(page, page.getByRole("link", { name: "Download everything" }));
  const download = page.waitForEvent("download");
  await page.keyboard.press("Enter");
  expect((await download).suggestedFilename()).toMatch(/^nine-turtles-\d{4}-\d{2}-\d{2}\.zip$/);
});

test("their page opens in the reading area in the article's place; Escape gives the keyboard back to the list", async ({ page }) => {
  const blog = unique("behind");
  await openBlogs(page, [blog]);
  await page.locator("#list-heading").focus();
  await page.keyboard.press("j");
  const title = page.getByRole("region", { name: "Article", exact: true }).locator(".article-title");
  await expect(title).toBeVisible();
  const menu = more(page);
  await menu.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("End");
  await expect(page.getByRole("menuitem", { name: `Info about Blog ${blog}` })).toBeFocused();
  await page.keyboard.press("Enter");
  const about = whoPage(page, `Blog ${blog}`);
  await expect(about.getByRole("heading", { level: 2, name: `Blog ${blog}` })).toBeFocused();
  // It stands where the article was, beside the list.
  await expect(title).toHaveCount(0);
  await expect(page.locator(".item-row")).toHaveCount(3);
  await page.keyboard.press("Escape");
  await expect(about).toHaveCount(0);
  // Back to the list, with its open article's address (decision 0233).
  await expect(page).toHaveURL(/\/people\/[0-9]+\/articles\/[0-9]+$/);
});

test.describe("on a touch screen beside the list", () => {
  test.use({ hasTouch: true });

  test("a folder's arrow shows on a touch screen, with a 44px target for a finger", async ({ page }) => {
    const blog = unique("touched");
    const folder = unique("Drawer");
    await openBlogs(page, [blog]);
    await editWho(page, `Blog ${blog}`);
    await page.getByLabel("New folder").fill(folder);
    await page.getByLabel("New folder").press("Enter");
    const arrow = sidebar(page).getByRole("button", { name: `What's in ${folder}` });
    await expect(arrow).toBeVisible();
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
    // With a long sidebar (other tests' folders) the arrow may sit under the top line: bring it into view.
    await arrow.evaluate((element) => element.scrollIntoView({ block: "center" }));
    // On a touch screen the arrow always shows, at the row's right end, a full 44px to press (decision 0123).
    const box = (await arrow.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await expect(arrow).toHaveCSS("opacity", "1");
  });
});

test("their settings are only Name, This is, Folders, Pause and Hide articles about…, then Unsubscribe", async ({ page }) => {
  const blog = unique("fewer");
  await openBlogs(page, [blog]);
  await editWhoByKeys(page, `Blog ${blog}`);
  const sheet = settingsOf(page, `Blog ${blog}`);
  // The four settings that went (the owner's core path, point 11, decision 0183).
  await expect(sheet.getByRole("combobox", { name: "Kind of source" })).toHaveCount(0);
  await expect(sheet.getByRole("radio", { name: "Automatic" })).toHaveCount(0);
  await expect(sheet.getByRole("checkbox", { name: "Open articles on the website" })).toHaveCount(0);
  await expect(sheet.getByText(/^(Posts about|Posts less|Hasn't posted in|Too new to tell)/)).toHaveCount(0);
  // One source: no Sources heading, and a quiet line under the settings to add another place (point 12).
  await expect(sheet.getByText("Sources", { exact: true })).toHaveCount(0);
  // One link that says what it adds; no line repeats what a control already says (decision 0241).
  await expect(sheet.getByRole("button", { name: "+ Add their newsletter, videos or podcast" })).toBeVisible();
  await expect(sheet.getByText(/also write a newsletter|Listed under/)).toHaveCount(0);
  // The new-folder field keeps its line: a placeholder vanishes once you type (the first floor).
  await expect(sheet.getByText("Type a name and press Enter to make a folder.")).toBeVisible();
  // No Email address field: the address is changed under Write to (decision 0254).
  await expect(sheet.getByRole("textbox", { name: "Email address" })).toHaveCount(0);
  // In that order, top to bottom.
  const tops = await Promise.all(
    [sheet.getByRole("textbox", { name: "Name" }), sheet.getByRole("radiogroup", { name: "This is" }), sheet.getByRole("button", { name: /^Folders/ }), sheet.getByRole("switch", { name: "Pause for a while" }), sheet.getByRole("button", { name: "Hide articles about…" }), sheet.getByRole("button", { name: `Unsubscribe from Blog ${blog}` })].map(
      async (each) => (await each.boundingBox())!.y,
    ),
  );
  expect([...tops].sort((one, other) => one - other)).toEqual(tops);
});

test("with only the keyboard: pausing someone in their settings is remembered, with since when", async ({ page }) => {
  const blog = unique("pause");
  const [paused] = await openBlogs(page, [blog]);
  await editWhoByKeys(page, `Blog ${blog}`);
  const sheet = settingsOf(page, `Blog ${blog}`);
  const theirs = whoPage(page, `Blog ${blog}`);
  const pause = sheet.getByRole("switch", { name: "Pause for a while" });
  await expect(pause).not.toBeChecked();
  await expect(page.getByText(/Paused today\./)).toHaveCount(0);
  await tabTo(page, pause);
  await page.keyboard.press("Space");
  // The switch is on, and their list beside it says so, with Resume (decision 0239). (Their page, hidden while their settings show, says it too.)
  await expect(pause).toBeChecked();
  await expect(page.getByText("Paused today. Their new articles arrive already read.").filter({ visible: true })).toHaveCount(1);
  // Escape, back on their page: it says so there too, under their name.
  await page.keyboard.press("Escape");
  await expect(theirs.getByText("Paused today. Their new articles arrive already read.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toHaveCount(2);

  await page.goto(new URL(`/people/${paused}/edit`, FEEDS_APP).href);
  await appReady(page);
  await expect(pause).toBeChecked();
  await page.goto(new URL(`/people/${paused}/about`, FEEDS_APP).href);
  await appReady(page);
  await expect(theirs.getByText(/Paused today\./)).toBeVisible();
});

test("Resume above a paused list unticks Pause for a while", async ({ page }) => {
  const blog = unique("resume");
  const [paused] = await openBlogs(page, [blog]);
  await page.goto(new URL(`/people/${paused}/edit`, FEEDS_APP).href);
  await appReady(page);
  const sheet = settingsOf(page, `Blog ${blog}`);
  await sheet.getByRole("switch", { name: "Pause for a while" }).check();
  // Saved as it's switched: their list, beside their settings, says so.
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toHaveCount(1);
  await page.goto(new URL(`/people/${paused}`, FEEDS_APP).href);
  await appReady(page);
  // With only the keyboard: Tab to Resume, Enter, and the keyboard lands on what happened.
  await tabTo(page, page.getByRole("button", { name: "Resume", exact: true }));
  await page.keyboard.press("Enter");
  await expect(page.getByText("Resumed.", { exact: true })).toBeFocused();
  await expect(page.getByText(/Their new articles arrive already read/)).toHaveCount(0);
  await page.goto(new URL(`/people/${paused}/edit`, FEEDS_APP).href);
  await appReady(page);
  await expect(sheet.getByRole("switch", { name: "Pause for a while" })).not.toBeChecked();
});

test("+ Add over a folder files them there, and New folder… makes one with them in it (decision 0261)", async ({ page }) => {
  const [first, filed, made] = [unique("into"), unique("filed"), unique("made")];
  const folder = unique("Zz-into");
  const fresh = unique("Zz-fresh");
  const ids = await openBlogs(page, [first]);
  await page.request.post(new URL(`/api/feeds/${ids[0]}`, FEEDS_APP).href, { data: { title: `Blog ${first}`, folders: [], new_folder: folder } });
  await page.reload();
  await appReady(page);
  const inFolders = async (title: string) => {
    const body = (await (await page.request.get(new URL("/api/feeds", FEEDS_APP).href)).json()) as { feeds: { title: string; folders: number[] }[]; folders: { id: number; name: string }[] };
    const ids = body.feeds.find((feed) => feed.title === title)?.folders ?? [];
    return body.folders.filter((each) => ids.includes(each.id)).map((each) => each.name);
  };

  // Over the folder, "Folder" starts on it.
  await sidebar(page).getByRole("link", { name: new RegExp(`^${folder}`) }).click();
  await sidebar(page).getByRole("link", { name: "Add a person or publication" }).click();
  await page.getByLabel("Their website's address").fill(`${FEED_SITE}/blog/${filed}/`);
  await page.keyboard.press("Enter");
  const into = page.getByLabel("Folder", { exact: true });
  await expect(into.locator("option:checked")).toHaveText(folder);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("heading", { level: 2, name: `Blog ${filed}`, exact: true })).toBeVisible();
  expect(await inFolders(`Blog ${filed}`)).toEqual([folder]);
  // The folder opened in the sidebar, so the reader sees where they went.
  await expect(sidebar(page).getByRole("link", { name: `Blog ${filed}` })).toBeVisible();

  // New folder…: a name is asked for first, then the folder is made with them in it.
  await sidebar(page).getByRole("link", { name: "Add a person or publication" }).click();
  await page.getByLabel("Their website's address").fill(`${FEED_SITE}/blog/${made}/`);
  await page.keyboard.press("Enter");
  // With only the keyboard: New folder… sits right under No folder, and choosing it leaves the keyboard on the list
  // (arrow keys choose as they move on some systems); Tab reaches the name.
  await expect(into.locator("option").nth(1)).toHaveText("New folder…");
  await into.focus();
  await into.selectOption({ label: "New folder…" });
  await expect(into).toBeFocused();
  const name = page.getByLabel("The new folder's name");
  await page.keyboard.press("Tab");
  await expect(name).toBeFocused();
  await page.getByRole("button", { name: "Done" }).click();
  // Said under the field it's about, which is marked, and the keyboard goes back to it.
  await expect(page.locator("#feed-into-problem")).toHaveText("Name the new folder first.");
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toBeFocused();
  await name.fill(fresh);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("heading", { level: 2, name: `Blog ${made}`, exact: true })).toBeVisible();
  expect(await inFolders(`Blog ${made}`)).toEqual([fresh]);
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`^${fresh}`) })).toBeVisible();
});

test("closing + Add while it asks keeps the folder it showed (decision 0261)", async ({ page }) => {
  const [first, kept] = [unique("first"), unique("kept")];
  const folder = unique("Zz-kept");
  const ids = await openBlogs(page, [first]);
  await page.request.post(new URL(`/api/feeds/${ids[0]}`, FEEDS_APP).href, { data: { title: `Blog ${first}`, folders: [], new_folder: folder } });
  await page.reload();
  await appReady(page);
  await sidebar(page).getByRole("link", { name: new RegExp(`^${folder}`) }).click();
  await sidebar(page).getByRole("link", { name: "Add a person or publication" }).click();
  await page.getByLabel("Their website's address").fill(`${FEED_SITE}/blog/${kept}/`);
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Folder", { exact: true }).locator("option:checked")).toHaveText(folder);
  await page.keyboard.press("Escape");
  await expect.poll(async () => {
    const body = (await (await page.request.get(new URL("/api/feeds", FEEDS_APP).href)).json()) as { feeds: { title: string; folders: number[] }[]; folders: { id: number; name: string }[] };
    const into = body.feeds.find((feed) => feed.title === `Blog ${kept}`)?.folders ?? [];
    return body.folders.filter((each) => into.includes(each.id)).map((each) => each.name);
  }).toEqual([folder]);
});
