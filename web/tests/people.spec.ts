import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// SPEC section 36 (people), "How to check it", done by a browser: the person's
// page, Add another place, "Is this the same person?", "… isn't the same
// person" and "This is one person", each with its Undo, and the keyboard's
// way through them. Each test uses blogs of its own, since every test shares
// the one nine turtles that has feeds.

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });
const pane = (page: Page) => page.getByRole("region", { name: "Article" });
const line = (page: Page) => page.getByRole("status").filter({ hasText: /\S/ }).first();
const rowsNamed = (page: Page, name: string) => sidebar(page).getByRole("link", { name: new RegExp(`^${name}`) });

test.skip(({ isMobile }) => isMobile, "the person's page stands in the wide window's reading pane");
// Joining and its Undo change the sidebar the other tests read.
test.describe.configure({ mode: "serial" });

function unique(prefix: string): string {
  return `${prefix}-${test.info().workerIndex}-${Date.now()}`;
}

/** Signs in, follows each address under the test site, and opens the first one's list. */
async function openPlaces(page: Page, paths: string[], { signedIn = false } = {}): Promise<number[]> {
  if (!signedIn) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(new URL("/all", FEEDS_APP).href);
    await appReady(page);
    await signIn(page);
  }
  const ids = [];
  for (const path of paths) ids.push(await follow(page, `${FEED_SITE}${path}`));
  await page.goto(new URL(`/feeds/${ids[0]}`, FEEDS_APP).href);
  await appReady(page);
  return ids;
}

test("with only the keyboard: Add another place joins someone you follow, and Undo parts them again", async ({ page }) => {
  const ana = unique("pp-ana");
  const ben = unique("pp-ben");
  await openPlaces(page, [`/blog/${ana}/feed.xml`, `/blog/${ben}/feed.xml`]);

  // Their page: the name a step under the list's title, each place with its website.
  await expect(pane(page).getByRole("heading", { level: 3, name: `Blog ${ana}` })).toBeVisible();
  await expect(pane(page).getByRole("link", { name: `${ana}.example` })).toBeVisible();
  await expect(pane(page)).toContainText("Following");

  const add = pane(page).getByRole("button", { name: "Add another place" });
  await add.focus();
  await page.keyboard.press("Enter");
  // The keyboard lands on the first field; Not now puts it back on the button.
  const who = pane(page).getByRole("combobox", { name: "Someone you already follow" });
  await expect(who).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(pane(page).getByRole("textbox", { name: /address of their blog/ })).toBeFocused();
  await pane(page).getByRole("button", { name: "Not now" }).focus();
  await page.keyboard.press("Enter");
  await expect(add).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(who).toBeFocused();
  await who.selectOption({ label: `Blog ${ben}` });
  await page.keyboard.press("Tab");
  await expect(pane(page).getByRole("button", { name: "Join", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(line(page)).toContainText(`Blog ${ana} is one person now`);
  // One row under their name, their list holding both, each article saying where it's from.
  await expect(rowsNamed(page, `Blog ${ana}`)).toHaveCount(1);
  await expect(rowsNamed(page, `Blog ${ben}`)).toHaveCount(0);
  await expect(page.locator(".item-row").filter({ hasText: "Blog" })).toHaveCount(6);
  await expect(pane(page).getByRole("link", { name: `${ben}.example` })).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(line(page)).toHaveText("Undone.");
  await expect(rowsNamed(page, `Blog ${ana}`)).toHaveCount(1);
  await expect(rowsNamed(page, `Blog ${ben}`)).toHaveCount(1);
});

test("Is this the same person? is asked only for places on one website: No asks never again, Yes joins them", async ({ page }) => {
  const cara = unique("two-pp-cara");
  const [blog, comments] = await openPlaces(page, [`/blog/${cara}/feed.xml`, `/blog/${cara}/comments.xml`]);
  const question = pane(page).getByRole("group", { name: /same person/ });
  await expect(question).toContainText(`Is Blog ${cara} the same person as Blog ${cara}: comments?`);
  await question.getByRole("button", { name: "No" }).focus();
  await page.keyboard.press("Enter");
  await expect(question).toHaveCount(0);
  // The keyboard moves on, never to nowhere.
  await expect(pane(page).getByRole("button", { name: "Add another place" })).toBeFocused();
  for (const id of [blog, comments]) {
    await page.goto(new URL(`/feeds/${id}`, FEEDS_APP).href);
    await appReady(page);
    await expect(pane(page).getByRole("button", { name: "Add another place" })).toBeVisible();
    await expect(question).toHaveCount(0);
  }

  const dov = unique("two-pp-dov");
  await openPlaces(page, [`/blog/${dov}/feed.xml`, `/blog/${dov}/comments.xml`], { signedIn: true });
  await question.getByRole("button", { name: "Yes, they're one person" }).click();
  await expect(line(page)).toContainText("is one person now");
  await expect(rowsNamed(page, `Blog ${dov}`)).toHaveCount(1);
  await expect(question).toHaveCount(0);
});

test("in Edit person, a place that isn't the same person leaves, and Undo brings it back", async ({ page }) => {
  const eli = unique("pp-eli");
  const fay = unique("pp-fay");
  const [first, second] = await openPlaces(page, [`/blog/${eli}/feed.xml`, `/blog/${fay}/feed.xml`]);
  const joined = await page.request.post(new URL("/api/writers/join", FEEDS_APP).href, { data: { feeds: [first, second], name: `Eli ${eli}` } });
  expect(joined.ok()).toBe(true);
  await page.goto(new URL(`/feeds/${second}`, FEEDS_APP).href);
  await appReady(page);
  await expect(rowsNamed(page, `Eli ${eli}`)).toHaveCount(1);

  await pane(page).getByRole("button", { name: "Edit person…" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Edit person" })).toBeFocused();
  await page.getByRole("button", { name: `${fay}.example isn't the same person` }).click();
  await expect(line(page)).toHaveText(`${fay}.example is on its own again`);
  await expect(rowsNamed(page, `Blog ${fay}`)).toHaveCount(1);
  await expect(rowsNamed(page, `Eli ${eli}`)).toHaveCount(1);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(line(page)).toHaveText("Undone.");
  await expect(rowsNamed(page, `Blog ${fay}`)).toHaveCount(0);
  await expect(rowsNamed(page, `Eli ${eli}`)).toHaveCount(1);
});

test("This is one person: a folder becomes one row named as it, and Undo brings the folder back", async ({ page }) => {
  const gil = unique("pp-gil");
  const hal = unique("pp-hal");
  const folder = unique("Pp-folder");
  const ids = await openPlaces(page, [`/blog/${gil}/feed.xml`, `/blog/${hal}/feed.xml`]);
  const made = await page.request.post(new URL("/api/folders", FEEDS_APP).href, { data: { name: folder, feeds: ids } });
  expect(made.ok()).toBe(true);
  const id = (await made.json()).folder.id as number;
  await page.goto(new URL(`/folders/${id}`, FEEDS_APP).href);
  await appReady(page);

  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("menuitem", { name: "Edit folder" }).click();
  // Renamed and made one person in the same Save: the person takes the new name.
  await page.getByRole("textbox", { name: "Name" }).fill(`Hal ${hal}`);
  const tick = page.getByRole("checkbox", { name: "This is one person" });
  await tick.focus();
  await page.keyboard.press("Space");
  await expect(tick).toBeChecked();
  await page.getByRole("button", { name: "Save" }).click();

  await expect(line(page)).toContainText(`Hal ${hal} is one person now`);
  await expect(rowsNamed(page, `Hal ${hal}`)).toHaveCount(1);
  await expect(rowsNamed(page, `Blog ${gil}`)).toHaveCount(0);
  await expect(pane(page).getByRole("heading", { level: 3, name: `Hal ${hal}` })).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(line(page)).toHaveText("Undone.");
  // Each place on its own again, back in the folder, which has the name it was given.
  await expect(pane(page).getByRole("heading", { level: 3, name: `Blog ${gil}` })).toBeVisible();
  await expect(rowsNamed(page, `Hal ${hal}`)).toHaveCount(1);
  const back = await (await page.request.get(new URL("/api/feeds", FEEDS_APP).href)).json();
  const mine = (back.feeds as { id: number; person: number | null; folders: number[] }[]).filter((feed) => ids.includes(feed.id));
  expect(mine.map((feed) => feed.person)).toEqual([null, null]);
  expect(mine.every((feed) => feed.folders.length === 1)).toBe(true);
});
