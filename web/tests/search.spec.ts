import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// SPEC section 14 (search), "How to check it", done by a browser, with the
// keyboard only. Each test uses blogs and a folder of its own, since every
// test shares the one slowfeed that has feeds.

test.skip(({ isMobile }) => isMobile, "the wide layout shows the list beside the sidebar");

const field = (page: Page) => page.getByRole("combobox", { name: "Search", exact: true });
const heading = (page: Page) => page.locator("#list-heading");
const results = (page: Page) => page.getByRole("region", { name: "Search results" }).getByRole("listitem");

function unique(prefix: string): string {
  return `${prefix}-${test.info().workerIndex}-${Date.now()}`;
}

/** Signs in and follows the blogs. Returns their feed numbers. */
async function start(page: Page, addresses: string[]): Promise<number[]> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const ids = [];
  for (const address of addresses) ids.push(await follow(page, address));
  return ids;
}

async function open(page: Page, path: string, name: string) {
  await page.goto(new URL(path, FEEDS_APP).href);
  await appReady(page);
  await expect(heading(page)).toHaveText(name);
  await expect(field(page)).toBeVisible();
}

test("a search starts where you are, finds words in bold, and Escape brings you back", async ({ page }) => {
  const [filed, loose] = [unique("filed"), unique("loose")];
  const folder = unique("Shelf");
  const [filedId] = await start(page, [`${FEED_SITE}/blog/${filed}/`, `${FEED_SITE}/blog/${loose}/`]);
  await page.request.post(new URL(`/api/feeds/${filedId}`, FEEDS_APP).href, {
    data: { title: `Blog ${filed}`, folders: [], new_folder: folder },
  });
  const library = await (await page.request.get(new URL("/api/feeds", FEEDS_APP).href)).json();
  const folderId = library.folders.find((each: { name: string }) => each.name === folder).id;
  await open(page, `/folders/${folderId}`, folder);
  await heading(page).focus();

  // 1. In a folder, `/` and a word: the chip shows the folder; the word is bold.
  await page.keyboard.press("/");
  await expect(field(page)).toBeFocused();
  await expect(page.getByRole("button", { name: `Remove in: ${folder}` })).toBeVisible();
  await page.keyboard.type("walking");
  await expect(heading(page)).toHaveText("Search results");
  await expect(results(page)).toHaveCount(1);
  await expect(results(page).first()).toContainText(`Walking the long way home`);
  await expect(results(page).first()).toContainText(`Blog ${filed}`);
  await expect(results(page).first().locator("strong")).toHaveText("Walking");

  // 2. Without the chip (Backspace at the start of the field removes it), results come from every feed.
  await page.keyboard.press("Home");
  await page.keyboard.press("Backspace");
  await expect(page.getByRole("button", { name: `Remove in: ${folder}` })).toHaveCount(0);
  await expect(results(page).filter({ hasText: `Blog ${loose}` })).toHaveCount(1);
  await expect(results(page).filter({ hasText: `Blog ${filed}` })).toHaveCount(1);

  // A typed filter is suggested, and becomes a chip.
  await page.keyboard.press("End");
  await page.keyboard.type(" feed:");
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.type(loose);
  await expect(page.getByRole("option", { name: `feed:Blog ${loose}` })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: `Remove in: Blog ${loose}` })).toBeVisible();
  await expect(field(page)).toHaveValue("walking");
  await expect(results(page)).toHaveCount(1);
  await expect(results(page).first()).toContainText(`Blog ${loose}`);

  // Results behave like the list: j and s star the result.
  await results(page).first().getByRole("button").focus();
  await page.keyboard.press("j");
  await page.keyboard.press("s");
  await expect(results(page).first()).toContainText("Starred");

  // 3. is:starred becomes a chip; only starred articles are listed.
  await field(page).focus();
  await page.keyboard.press("End");
  await page.keyboard.press("Control+a");
  await page.keyboard.type("is:starred ");
  await expect(page.getByRole("button", { name: "Remove is:starred" })).toBeVisible();
  await expect(field(page)).toHaveValue("");
  await expect(results(page)).toHaveCount(1);
  await expect(results(page).first()).toContainText("Walking the long way home");

  // 4. The options panel writes the same filters: a date makes a chip.
  await page.getByRole("button", { name: "Search options" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Search options" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("checkbox", { name: "Starred only" })).toBeChecked();
  await field(page).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("combobox", { name: "Search in" })).toBeFocused();
  await page.getByLabel("Published after").fill("2030-01-01");
  await expect(page.getByRole("button", { name: "Remove after:2030-01-01" })).toBeVisible();
  await expect(page.getByText("Nothing found.")).toBeVisible();
  await page.getByRole("checkbox", { name: "Unread only" }).press("Space");
  await expect(page.getByRole("button", { name: "Remove is:unread" })).toBeVisible();

  // 5 is the Hindi test below. 6. Escape: back exactly where you were, the search gone.
  await page.keyboard.press("Escape");
  await expect(heading(page)).toHaveText(folder);
  await expect(heading(page)).toBeFocused();
  await expect(field(page)).toHaveValue("");
  await expect(page.getByRole("button", { name: `Remove in: ${folder}` })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove is:starred" })).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/folders/${folderId}$`));
});

test("Mark all as read marks only the results, and u undoes it", async ({ page }) => {
  const name = unique("marked");
  const [id] = await start(page, [`${FEED_SITE}/blog/${name}/`]);
  await open(page, `/feeds/${id}`, `Blog ${name}`);
  const count = (unread: number) =>
    page.getByRole("navigation", { name: "Sidebar" }).getByRole("link", { name: `Blog ${name} ${unread} unread` });
  await expect(count(3)).toBeVisible();

  await page.keyboard.press("/");
  await page.keyboard.type("walking");
  await page.keyboard.press("Enter");
  await expect(results(page)).toHaveCount(1);
  await results(page).first().getByRole("button").focus();
  await page.keyboard.press("Shift+A");
  await expect(page.getByText("Marked 1 item as read")).toBeVisible();
  await expect(count(2)).toBeVisible();
  await page.keyboard.press("u");
  await expect(page.getByText("Undone.")).toBeVisible();
  await expect(count(3)).toBeVisible();
});

test("Hindi words are found whole", async ({ page }) => {
  const name = unique("kavita");
  const [id] = await start(page, [`${FEED_SITE}/hindi/${name}/`]);
  await open(page, `/feeds/${id}`, `Kavita ${name}`);
  await page.keyboard.press("/");
  await page.keyboard.type("किताबें");
  await page.keyboard.press("Enter");
  await expect(results(page)).toHaveCount(1);
  await expect(results(page).first()).toContainText("पुस्तकालय की एक शाम");
  await field(page).fill("पुस्तकालय");
  await expect(results(page).first().locator("strong")).toHaveText("पुस्तकालय");
});
