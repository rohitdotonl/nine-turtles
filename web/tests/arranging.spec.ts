import { expect, test, type Locator, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn, tabTo } from "./screens";

// SPEC section 5 ("Arranging the sidebar", decision 0207), done by a browser:
// folders in the reader's own order, by dragging or by Edit's handles, and
// people filed into folders by dragging. Each test makes blogs and folders
// of its own, since every test shares the one nine turtles that has feeds.

test.skip(({ isMobile }) => isMobile, "the wide layout shows the sidebar beside the list");
test.describe.configure({ mode: "serial" });

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });
const note = (page: Page) => sidebar(page).getByRole("status").filter({ hasText: /\S/ });
const folderRow = (page: Page, name: string) => sidebar(page).locator("[data-folder-item]").filter({ has: page.getByRole("link", { name: new RegExp(`^${name}`) }) });
/** The folders' names, top to bottom (without the "unread" screen readers hear). */
const folderNames = async (page: Page) =>
  (await sidebar(page).locator("[data-folder-item] > .folder-row a").allInnerTexts()).map((text) => text.replace(/\s*unread$/, "").trim());

function unique(prefix: string): string {
  return `${prefix}-${test.info().workerIndex}-${Date.now()}`;
}

/** Follows a blog for each folder name and files it there, so each folder is made in turn (each new one goes last). */
async function blogsInFolders(page: Page, folders: string[]): Promise<string[]> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const blogs = [];
  for (const folder of folders) {
    const blog = unique(`arr-${folder.toLowerCase()}`);
    const id = await follow(page, `${FEED_SITE}/blog/${blog}/`);
    await page.request.post(new URL(`/api/feeds/${id}`, FEEDS_APP).href, { data: { title: `Blog ${blog}`, folders: [], new_folder: folder } });
    blogs.push(`Blog ${blog}`);
  }
  await page.goto(new URL("/unread", FEEDS_APP).href);
  await appReady(page);
  return blogs;
}

/** Presses on `from`, moves a few steps to `to`, and lets go: a mouse's drag. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, held?: "Control") {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y + 6, { steps: 2 });
  if (held) await page.keyboard.down(held);
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  if (held) await page.keyboard.up(held);
}

/** A point inside a row, brought to the sidebar's middle first (unless `stay`), as other tests' folders may push it out of sight. */
async function middleOf(locator: Locator, stay = false) {
  // In the middle of the sidebar, well away from its edges, where holding a row scrolls it.
  if (!stay) await locator.evaluate((element) => element.scrollIntoView({ block: "center" }));
  const box = (await locator.boundingBox())!;
  return { x: box.x + 40, y: box.y + box.height / 2 };
}

test("a folder dragged above another stays there, after a reload too, and Undo puts it back", async ({ page }) => {
  const [first, second] = [unique("Aaa"), unique("Bbb")];
  await blogsInFolders(page, [first, second]);
  const names = await folderNames(page);
  expect(names.indexOf(second)).toBe(names.indexOf(first) + 1);

  const from = await middleOf(folderRow(page, second).locator(".folder-row"));
  const top = (await folderRow(page, first).locator(".folder-row").boundingBox())!;
  await drag(page, from, { x: top.x + 40, y: top.y + 4 });
  await expect(note(page)).toContainText(`Moved the folder ${second}.`);
  // Nothing opened: the click that follows letting go of a link is dropped.
  await expect(page).toHaveURL(/\/unread$/);
  await page.reload();
  await appReady(page);
  let after = await folderNames(page);
  expect(after.indexOf(second)).toBe(after.indexOf(first) - 1);

  const back = await middleOf(folderRow(page, first).locator(".folder-row"));
  await drag(page, back, { x: back.x, y: (await folderRow(page, second).boundingBox())!.y + 4 });
  await expect(note(page)).toContainText(`Moved the folder ${first}.`);
  await sidebar(page).getByRole("button", { name: "Undo" }).click();
  await expect(note(page)).toContainText("Undone.");
  after = await folderNames(page);
  expect(after.indexOf(second)).toBe(after.indexOf(first) - 1);
});

test("Escape while dragging changes nothing", async ({ page }) => {
  const [first, second] = [unique("Esc"), unique("Esd")];
  await blogsInFolders(page, [first, second]);
  const from = await middleOf(folderRow(page, second).locator(".folder-row"));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y - 60, { steps: 6 });
  await expect(sidebar(page).locator(".drop-line")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sidebar(page).locator(".drop-line")).toHaveCount(0);
  await page.mouse.up();
  await expect(note(page)).toHaveCount(0);
  const names = await folderNames(page);
  expect(names.indexOf(second)).toBe(names.indexOf(first) + 1);
});

test("someone dragged onto another folder moves there; their old folder, left empty, goes too and comes back on Undo", async ({ page }) => {
  const [from, to] = [unique("Old"), unique("New")];
  const [blog] = await blogsInFolders(page, [from, to]);
  await sidebar(page).getByRole("button", { name: `What's in ${from}` }).click();
  const person = folderRow(page, from).getByRole("link", { name: new RegExp(`^${blog}`) });
  const start = await middleOf(person);
  await drag(page, start, await middleOf(folderRow(page, to).locator(".folder-row"), true));
  await expect(note(page)).toContainText(`Moved ${blog} to ${to}. ${from} went too, as it's empty.`);
  await expect(folderRow(page, from)).toHaveCount(0);
  await expect(folderRow(page, to).getByRole("link", { name: new RegExp(`^${blog}`) })).toBeVisible();

  await sidebar(page).getByRole("button", { name: "Undo" }).click();
  await expect(note(page)).toContainText("Undone.");
  await expect(folderRow(page, from)).toHaveCount(1);
  const names = await folderNames(page);
  expect(names.indexOf(to)).toBe(names.indexOf(from) + 1);
});

test("Ctrl held while dragging keeps someone in both folders", async ({ page }) => {
  const [from, to] = [unique("Keep"), unique("Kept")];
  const [blog] = await blogsInFolders(page, [from, to]);
  await sidebar(page).getByRole("button", { name: `What's in ${from}` }).click();
  const person = folderRow(page, from).getByRole("link", { name: new RegExp(`^${blog}`) });
  const start = await middleOf(person);
  await drag(page, start, await middleOf(folderRow(page, to).locator(".folder-row"), true), "Control");
  await expect(note(page)).toContainText(`Added ${blog} to ${to}.`);
  await expect(folderRow(page, from).getByRole("link", { name: new RegExp(`^${blog}`) })).toBeVisible();
  await expect(folderRow(page, to).getByRole("link", { name: new RegExp(`^${blog}`) })).toBeVisible();
});

test("with only the keyboard: Edit, a folder's handle, Move to the top, then Done", async ({ page }) => {
  const [first, second] = [unique("Kbd"), unique("Kbe")];
  await blogsInFolders(page, [first, second]);
  const edit = sidebar(page).getByRole("button", { name: "Edit", exact: true });
  await tabTo(page, edit);
  await expect(edit).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(sidebar(page).getByRole("button", { name: "Done", exact: true })).toHaveAttribute("aria-pressed", "true");

  const handle = sidebar(page).getByRole("button", { name: `Move ${second}`, exact: true });
  await tabTo(page, handle);
  await page.keyboard.press("Enter");
  const top = page.getByRole("menuitem", { name: "Move to the top" });
  await page.keyboard.press("Home");
  await expect(top).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(note(page)).toContainText(`Moved the folder ${second}.`);
  // The keyboard stays on the handle, and screen readers hear where the folder is now.
  await expect(handle).toBeFocused();
  await expect(note(page)).toContainText(`${second} is 1 of`);
  expect((await folderNames(page))[0]).toBe(second);
});

test("in Edit, a person's handle opens Move to a folder", async ({ page }) => {
  const [from, to] = [unique("Hold"), unique("Hole")];
  const [blog] = await blogsInFolders(page, [from, to]);
  await sidebar(page).getByRole("button", { name: `What's in ${from}` }).click();
  await sidebar(page).getByRole("button", { name: "Edit", exact: true }).click();
  await sidebar(page).getByRole("button", { name: `Move ${blog}`, exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Move to a folder" });
  await sheet.getByRole("radio", { name: to }).check();
  await sheet.getByRole("button", { name: "Move", exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await expect(note(page)).toContainText(`${from} went too, as it's empty.`);
  await expect(folderRow(page, to)).toHaveCount(1);
});

test("the headings are bold words in full ink, and Edit is quiet until the pointer is on the sidebar", async ({ page }) => {
  await blogsInFolders(page, [unique("Look")]);
  const heading = sidebar(page).getByRole("heading", { level: 2, name: "Folders" });
  await expect(heading).toHaveCSS("text-transform", "none");
  await expect(heading).toHaveCSS("font-weight", "600");
  const ink = await page.locator("body").evaluate((body) => getComputedStyle(body).color);
  await expect(heading).toHaveCSS("color", ink);
  const edit = sidebar(page).getByRole("button", { name: "Edit", exact: true });
  await page.mouse.move(900, 400);
  await expect(edit).toHaveCSS("opacity", "0");
  await sidebar(page).hover();
  await expect(edit).toHaveCSS("opacity", "1");
});

/**
 * Presses on `start` and carries it to `target`, holding it near the sidebar's edge first, to
 * scroll there, if `target` is out of sight. The button is still down: the caller lets go.
 */
async function carry(page: Page, start: { x: number; y: number }, target: Locator) {
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x, start.y + 6, { steps: 2 });
  const area = (await sidebar(page).locator(".scroller").boundingBox())!;
  for (let tries = 0; tries < 300; tries++) {
    const box = await target.boundingBox();
    if (box && box.y > area.y + 50 && box.y + box.height < area.y + area.height - 50) break;
    const below = !box || box.y > area.y;
    await page.mouse.move(start.x, below ? area.y + area.height - 10 : area.y + 10);
    await page.waitForTimeout(20);
  }
  await page.mouse.move(start.x, area.y + area.height / 2, { steps: 2 });
  const box = (await target.boundingBox())!;
  await page.mouse.move(start.x, box.y + Math.min(box.height / 2, 16), { steps: 4 });
}

/** Follows a blog of its own, in no folder: one row under People. */
async function looseBlog(page: Page, name: string): Promise<number> {
  return follow(page, `${FEED_SITE}/blog/${name}/`);
}

test("someone in no folder dragged onto Publications becomes one, and Undo makes them a person again", async ({ page }) => {
  await blogsInFolders(page, [unique("Pub")]);
  const blog = unique("arr-pub");
  await looseBlog(page, blog);
  await page.reload();
  await appReady(page);
  const row = sidebar(page).locator("[data-drop-loose='person']").getByRole("link", { name: new RegExp(`^Blog ${blog}`) });
  await carry(page, await middleOf(row), sidebar(page).locator("[data-drop-loose='publication'] h2"));
  await page.mouse.up();
  await expect(note(page)).toContainText(`Blog ${blog} is now a publication.`);
  await expect(sidebar(page).locator("[data-drop-loose='publication']").getByRole("link", { name: new RegExp(`^Blog ${blog}`) })).toBeVisible();
  await sidebar(page).getByRole("button", { name: "Undo" }).click();
  await expect(note(page)).toContainText("Undone.");
  await expect(sidebar(page).locator("[data-drop-loose='person']").getByRole("link", { name: new RegExp(`^Blog ${blog}`) })).toBeVisible();
});

test("someone writing in several places, held over Publications, is told why they stay a person", async ({ page }) => {
  await blogsInFolders(page, [unique("Sev")]);
  const [one, two] = [unique("arr-sev"), unique("arr-sew")];
  const ids = [await looseBlog(page, one), await looseBlog(page, two)];
  const name = `Sev ${one}`;
  expect((await page.request.post(new URL("/api/writers/join", FEEDS_APP).href, { data: { feeds: ids, name } })).ok()).toBe(true);
  await page.reload();
  await appReady(page);
  const row = sidebar(page).getByRole("link", { name: new RegExp(`^${name}`) });
  await carry(page, await middleOf(row), sidebar(page).locator("[data-drop-loose='publication'] h2"));
  const why = `${name} writes in more than one place, so stays under People.`;
  await expect(sidebar(page).locator("[data-drop-loose='publication']")).toContainText(why);
  await expect(sidebar(page).locator("[data-drop-loose='publication'][data-drop]")).toHaveCount(0);
  await page.mouse.up();
  await expect(note(page)).toContainText(why);
  await expect(sidebar(page).locator("[data-drop-loose='person']").getByRole("link", { name: new RegExp(`^${name}`) })).toBeVisible();
});

test.describe("with a finger", () => {
  test.use({ hasTouch: true });

  test("pressing and holding a folder lifts it; a quick swipe only scrolls", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "touches are sent through Chromium's own protocol");
    const [first, second] = [unique("Tch"), unique("Tci")];
    await blogsInFolders(page, [first, second]);
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
    let from = await middleOf(folderRow(page, second).locator(".folder-row"));

    // A quick move: no lift, nothing moves.
    await touch("touchStart", from.x, from.y);
    await touch("touchMove", from.x, from.y - 30);
    await touch("touchEnd", 0, 0);
    await expect(note(page)).toHaveCount(0);
    // The swipe may have flung the sidebar: it's let come to rest, as a touch during a fling only stops it.
    const resting = sidebar(page).locator(".scroller");
    let at = -1;
    await expect(async () => {
      const now = await resting.evaluate((element) => element.scrollTop);
      const settled = now === at;
      at = now;
      expect(settled).toBe(true);
    }).toPass({ intervals: [150] });

    // Held for over half a second, then moved: the folder lifts and lands.
    from = await middleOf(folderRow(page, second).locator(".folder-row"));
    const top = (await folderRow(page, first).boundingBox())!;
    await touch("touchStart", from.x, from.y);
    await page.waitForTimeout(700);
    await expect(folderRow(page, second).locator("[data-dragging]")).toHaveCount(1);
    for (let y = from.y; y > top.y + 4; y -= 8) await touch("touchMove", from.x, y);
    await touch("touchMove", from.x, top.y + 4);
    await touch("touchEnd", 0, 0);
    await expect(note(page)).toContainText(`Moved the folder ${second}.`);
    const names = await folderNames(page);
    expect(names.indexOf(second)).toBe(names.indexOf(first) - 1);
  });
});

test("an indent means inside a folder: people in none line up with the folders (decision 0219)", async ({ page }) => {
  const folder = unique("Indent");
  const [inside] = await blogsInFolders(page, [folder]);
  const loose = `Blog ${unique("arr-loose")}`;
  const id = await follow(page, `${FEED_SITE}/blog/${loose.slice(5)}/`);
  await page.request.post(new URL(`/api/feeds/${id}`, FEEDS_APP).href, { data: { title: loose } });
  await page.reload();
  await appReady(page);
  await sidebar(page).getByRole("button", { name: `What's in ${folder}` }).click();
  // Where a row's name starts: its box plus its padding.
  const nameStart = (link: Locator) => link.evaluate((element) => element.getBoundingClientRect().x + parseFloat(getComputedStyle(element).paddingLeft));
  const folderAt = await nameStart(sidebar(page).getByRole("link", { name: new RegExp(`^${folder}`) }));
  const insideAt = await nameStart(sidebar(page).getByRole("link", { name: new RegExp(`^${inside}`) }));
  const looseAt = await nameStart(sidebar(page).getByRole("link", { name: new RegExp(`^${loose}`) }));
  expect(Math.abs(looseAt - folderAt)).toBeLessThanOrEqual(1);
  expect(insideAt - folderAt).toBeGreaterThanOrEqual(20);
});
