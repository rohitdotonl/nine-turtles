import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn, tabTo } from "./screens";

// SPEC sections 5 (sidebar search), 15 (folders and managing feeds) and 16
// (OPML import and export), "How to check it", done by a browser. Each test
// uses blogs and folder names of its own, since every test shares the one
// slowfeed that has feeds.

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });
const line = (page: Page) => page.getByRole("status").filter({ hasText: /\S/ }).first();

test.skip(({ isMobile }) => isMobile, "the wide layout shows the sidebar beside the list");
// Unsubscribing ends the Undo of any earlier unsubscribe (only the last
// action can be undone), so the tests that unsubscribe run one at a time.
test.describe.configure({ mode: "serial" });

/**
 * Does `act` make slowfeed open the device's file chooser? It counts the
 * hidden file field being clicked, which is all slowfeed itself does. The
 * test browser's own "file chooser" event isn't used: under load, Chromium
 * sometimes doesn't show the chooser even though the field was clicked.
 */
async function opensFilePicker(page: Page, act: () => Promise<void>): Promise<void> {
  await page.locator('input[type="file"]').evaluate((input) => {
    input.addEventListener("click", (event) => {
      event.preventDefault();
      input.dataset.opened = "yes";
    }, { once: true });
  });
  await act();
  await expect(page.locator('input[type="file"]')).toHaveAttribute("data-opened", "yes");
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
  await page.goto(new URL(`/feeds/${ids[0]}`, FEEDS_APP).href);
  await appReady(page);
  await expect(page.getByRole("heading", { level: 2, name: `Blog ${names[0]}` })).toBeVisible();
  return ids;
}

test("a feed put in two folders appears under both, with its unread count in each", async ({ page }) => {
  const blog = unique("filed");
  const [first, second] = [unique("Essays"), unique("Letters")];
  await openBlogs(page, [blog]);

  await page.getByRole("link", { name: "Edit feed" }).click();
  await expect(page).toHaveURL(/\/feeds\/[0-9]+\/edit$/);
  await expect(page.getByRole("heading", { level: 2, name: "Edit feed" })).toBeFocused();
  // The X at the top closes it unchanged.
  await page.getByRole("button", { name: "Close without saving" }).click();
  await expect(page.getByRole("heading", { level: 2, name: `Blog ${blog}` })).toBeFocused();
  await page.getByRole("link", { name: "Edit feed" }).click();
  await page.getByLabel("New folder").fill(first);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { level: 2, name: `Blog ${blog}` })).toBeFocused();

  await page.getByRole("link", { name: "Edit feed" }).click();
  await expect(page.getByRole("checkbox", { name: first })).toBeChecked();
  await page.getByLabel("Name").fill(`Renamed ${blog}`);
  await page.getByLabel("New folder").fill(second);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { level: 2, name: `Renamed ${blog}` })).toBeVisible();

  // Folders are listed with their counts; their feeds show when opened.
  for (const folder of [first, second]) {
    await expect(sidebar(page).getByRole("link", { name: `${folder} 3 unread` })).toBeVisible();
    const toggle = sidebar(page).getByRole("button", { name: `Feeds in ${folder}` });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }
  // Under both, and nowhere else.
  await expect(sidebar(page).getByRole("link", { name: `Renamed ${blog} 3 unread` })).toHaveCount(2);

  // A folder's own list holds its feeds' articles.
  await sidebar(page).getByRole("link", { name: `${first} 3 unread` }).click();
  await expect(page).toHaveURL(/\/folders\/[0-9]+$/);
  await expect(page.getByRole("heading", { level: 2, name: first })).toBeFocused();
  await expect(page.getByRole("region", { name: first }).getByRole("listitem")).toHaveCount(3);
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
  await page.getByRole("link", { name: "Edit folder" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Edit folder" })).toBeFocused();
  // Escape goes back unchanged.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { level: 2, name: folder })).toBeFocused();
  // So does the X at the top.
  await page.getByRole("link", { name: "Edit folder" }).click();
  await page.getByRole("button", { name: "Close without saving" }).click();
  await expect(page.getByRole("heading", { level: 2, name: folder })).toBeFocused();

  await page.getByRole("link", { name: "Edit folder" }).click();
  await page.getByLabel("Name").fill(`Aa-${folder}`);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { level: 2, name: `Aa-${folder}` })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`^Aa-${folder}`) })).toBeVisible();

  await page.getByRole("link", { name: "Edit folder" }).click();
  await page.getByRole("button", { name: `Delete Aa-${folder}` }).click();
  await expect(page).toHaveURL(/\/unread$/);
  await expect(line(page)).toHaveText(`Deleted the folder Aa-${folder}`);
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`^Aa-${folder}`) })).toHaveCount(0);
  // The feed stays, now in no folder.
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`^Blog ${blog}`) })).toBeVisible();

  await page.keyboard.press("u");
  await expect(line(page)).toHaveText("Undone.");
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`^Aa-${folder}`) })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`^Blog ${blog}`) })).toHaveCount(0);
});

test("unsubscribe, then Undo: the feed is back with its read history; a star outlives unsubscribing", async ({ page }) => {
  const [blog, other] = [unique("leaving"), unique("starred")];
  await openBlogs(page, [blog, other]);
  await expect(page.getByRole("region", { name: `Blog ${blog}` }).getByRole("listitem")).toHaveCount(3);
  // One article read.
  await page.keyboard.press("j");
  await expect(sidebar(page).getByRole("link", { name: `Blog ${blog} 2 unread` })).toBeVisible();

  await page.getByRole("link", { name: "Edit feed" }).click();
  await page.getByRole("button", { name: `Unsubscribe from Blog ${blog}` }).click();
  await expect(page).toHaveURL(/\/unread$/);
  await expect(line(page)).toHaveText(`Unsubscribed from Blog ${blog}`);
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`^Blog ${blog}`) })).toHaveCount(0);
  await expect(page.getByRole("button", { name: new RegExp(`Blog ${blog} ·`) })).toHaveCount(0);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(line(page)).toHaveText("Undone.");
  await expect(sidebar(page).getByRole("link", { name: `Blog ${blog} 2 unread` })).toBeVisible();

  // The other blog: star its newest article, then unsubscribe.
  await sidebar(page).getByRole("link", { name: new RegExp(`^Blog ${other}`) }).click();
  await expect(page.getByRole("region", { name: `Blog ${other}` }).getByRole("listitem")).toHaveCount(3);
  await page.keyboard.press("j");
  await page.keyboard.press("s");
  await expect(line(page)).toHaveText("Starred");
  await page.getByRole("link", { name: "Edit feed" }).click();
  await page.getByRole("button", { name: `Unsubscribe from Blog ${other}` }).click();
  await expect(line(page)).toHaveText(`Unsubscribed from Blog ${other}`);
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
  const search = sidebar(page).getByRole("searchbox", { name: "Find a feed or folder" });
  await search.fill(blog.toUpperCase());
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`^Blog ${blog}`) })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: /^Quiet Notes/ })).toHaveCount(0);

  await search.fill(`${blog}-nothing`);
  await expect(sidebar(page).getByText("No feed or folder has that in its name.")).toBeVisible();

  await search.press("Escape");
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
});

test("import an OPML file from Settings: a plain summary, folders in the sidebar; export downloads them", async ({ page }) => {
  const [one, two] = [unique("imported"), unique("imported-too")];
  const folder = unique("From OPML");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/settings", FEEDS_APP).href);
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

  await expect(page.getByRole("heading", { level: 3, name: "Your data" })).toBeVisible();
  // The button opens the device's file chooser; the file is then handed
  // over the way a chosen file is.
  await opensFilePicker(page, () => page.getByRole("button", { name: "Import OPML" }).click());
  await page.locator('input[type="file"]').evaluate((input: HTMLInputElement, text) => {
    const chosen = new DataTransfer();
    chosen.items.add(new File([text], "made-up.opml", { type: "text/x-opml" }));
    input.files = chosen.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, file);
  await expect(page.getByText("Added 2 feeds and 1 folder. Their articles arrive over the next few minutes.")).toBeVisible();
  await expect(page.getByText("1 line couldn't be read: Broken line.")).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`^${folder}`) })).toBeVisible();

  const exportLink = page.getByRole("link", { name: "Export OPML" });
  await expect(exportLink).toHaveAttribute("download", "");
  const exported = await page.request.get(new URL((await exportLink.getAttribute("href")) ?? "", FEEDS_APP).href);
  expect(exported.headers()["content-disposition"]).toContain("attachment");
  const text = await exported.text();
  expect(text).toContain(`<outline text="${folder}"`);
  expect(text).toContain(`xmlUrl="${FEED_SITE}/blog/${one}/feed.xml"`);

  // Starred articles download as a JSON Feed file.
  const starredLink = page.getByRole("link", { name: "Export starred articles" });
  await expect(starredLink).toHaveAttribute("download", "");
  const starred = await page.request.get(new URL((await starredLink.getAttribute("href")) ?? "", FEEDS_APP).href);
  expect(starred.headers()["content-disposition"]).toContain("attachment");
  expect((await starred.json()).version).toBe("https://jsonfeed.org/version/1.1");
});

test("with only the keyboard: Edit feed, a new folder, opening it, Edit folder, Unsubscribe, Import OPML and the starred export", async ({ page }) => {
  const blog = unique("keys");
  const folder = unique("Keyboard");
  await openBlogs(page, [blog]);

  await tabTo(page, page.getByRole("link", { name: "Edit feed" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 2, name: "Edit feed" })).toBeFocused();
  await tabTo(page, page.getByLabel("New folder"));
  await page.keyboard.type(folder);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 2, name: `Blog ${blog}` })).toBeFocused();

  // The folder's button shows its feeds; Space or Enter works it.
  const toggle = sidebar(page).getByRole("button", { name: `Feeds in ${folder}` });
  await tabTo(page, toggle, 200);
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`^Blog ${blog}`) })).toBeVisible();

  // Untick the folder from Edit feed: Space on the checkbox, then Save.
  await tabTo(page, page.getByRole("link", { name: "Edit feed" }), 200);
  await page.keyboard.press("Enter");
  await tabTo(page, page.getByRole("checkbox", { name: folder }));
  await page.keyboard.press("Space");
  await expect(page.getByRole("checkbox", { name: folder })).not.toBeChecked();
  await tabTo(page, page.getByRole("button", { name: "Save" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 2, name: `Blog ${blog}` })).toBeFocused();

  // Edit folder, from the folder's own list.
  await tabTo(page, sidebar(page).getByRole("link", { name: new RegExp(`^${folder}`) }), 200);
  await page.keyboard.press("Enter");
  await tabTo(page, page.getByRole("link", { name: "Edit folder" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 2, name: "Edit folder" })).toBeFocused();
  await tabTo(page, page.getByRole("button", { name: `Delete ${folder}` }));
  await page.keyboard.press("Enter");
  await expect(line(page)).toHaveText(`Deleted the folder ${folder}`);

  // Unsubscribe, and u brings the feed back.
  await tabTo(page, sidebar(page).getByRole("link", { name: new RegExp(`^Blog ${blog}`) }), 200);
  await page.keyboard.press("Enter");
  await tabTo(page, page.getByRole("link", { name: "Edit feed" }));
  await page.keyboard.press("Enter");
  await tabTo(page, page.getByRole("button", { name: `Unsubscribe from Blog ${blog}` }));
  await page.keyboard.press("Enter");
  await expect(line(page)).toHaveText(`Unsubscribed from Blog ${blog}`);
  await page.keyboard.press("u");
  await expect(sidebar(page).getByRole("link", { name: new RegExp(`^Blog ${blog}`) })).toBeVisible();

  // Import OPML opens the device's file chooser from the keyboard too.
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  await tabTo(page, page.getByRole("button", { name: "Import OPML" }), 200);
  await opensFilePicker(page, () => page.keyboard.press("Enter"));

  // So does Export starred articles: Enter downloads the file.
  await tabTo(page, page.getByRole("link", { name: "Export starred articles" }));
  const download = page.waitForEvent("download");
  await page.keyboard.press("Enter");
  expect((await download).suggestedFilename()).toBe("slowfeed-starred.json");
});
