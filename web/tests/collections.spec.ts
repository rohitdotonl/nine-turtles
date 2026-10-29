import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, settingsSaved, signIn, tabTo } from "./screens";

// SPEC section 34 (decision 0108), "How to check it", done by a browser with
// the keyboard only: an article goes on a new collection with l, another
// through the article's More menu; the collection opens from the sidebar with
// both, newest first; taking one off says so with Undo; Rename… refuses a
// name in use; then it's deleted from its own More menu, its articles stay,
// and Undo brings it back; Show in the sidebar hides them. Then, on a phone,
// the same sheet over the article.

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });
const line = (page: Page) => page.getByRole("status").filter({ hasText: /\S/ }).first();
const article = (page: Page) => page.getByRole("region", { name: "Article" });
const NEWEST = "On keeping a commonplace book (3)";
const MIDDLE = "Walking the long way home (2)";

test("articles go on a collection by l and by the menu; it opens, and deleting it can be undone", async ({ page, isMobile }) => {
  test.skip(isMobile, "the keyboard and the sidebar are the computer's; the phone has its own test below");
  const blog = `shelf-${test.info().workerIndex}-${Date.now()}`;
  const name = `Zz shelf ${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${blog}/`);
  await page.goto(new URL(`/feeds/${id}`, FEEDS_APP).href);
  await appReady(page);
  await expect(page.getByRole("button", { name: new RegExp(`Blog ${blog}`) }).first()).toBeVisible();

  // j opens the newest; l opens the sheet for it.
  await page.keyboard.press("j");
  await expect(article(page).getByRole("heading", { name: NEWEST })).toBeVisible();
  await page.keyboard.press("l");
  const sheet = page.getByRole("dialog", { name: "Add to collection" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("heading", { name: "Add to collection" })).toBeFocused();
  // A new collection, named in the list's last row; Enter saves.
  const newRow = sheet.getByRole("textbox", { name: "New collection" });
  await tabTo(page, newRow);
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await expect(sheet).toHaveCount(0);
  const link = sidebar(page).getByRole("link", { name: new RegExp(`^${name}`) });
  await expect(link).toBeVisible();

  // The next article, through the article's More menu, with the keyboard.
  await page.keyboard.press("j");
  await expect(article(page).getByRole("heading", { name: MIDDLE })).toBeVisible();
  const more = article(page).getByRole("button", { name: "More actions" });
  await tabTo(page, more);
  await page.keyboard.press("Enter");
  const item = page.getByRole("menuitem", { name: /Add to collection/ });
  await expect(item).toBeVisible();
  while (!(await item.evaluate((element) => element === document.activeElement))) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(sheet).toBeVisible();
  const box = sheet.getByRole("checkbox", { name });
  await expect(box).toBeEnabled();
  await expect(box).not.toBeChecked();
  await tabTo(page, box);
  await page.keyboard.press("Space");
  await expect(box).toBeChecked();
  await tabTo(page, sheet.getByRole("button", { name: "Save" }));
  await page.keyboard.press("Enter");
  await expect(sheet).toHaveCount(0);
  // The keyboard is back on More, where the sheet was opened from.
  await expect(more).toBeFocused();

  // The collection opens from the sidebar: both articles, newest first.
  await tabTo(page, link);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/collections\/\d+$/);
  const shelf = Number(/\/collections\/(\d+)$/.exec(page.url())?.[1]);
  await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  await expect(link).toHaveAttribute("aria-current", "page");
  const rows = page.getByRole("button", { name: new RegExp(`Blog ${blog}`) });
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveAccessibleName(new RegExp(NEWEST.replace(/[()]/g, "\\$&")));
  await expect(rows.nth(1)).toHaveAccessibleName(new RegExp(MIDDLE.replace(/[()]/g, "\\$&")));

  // Taking the older one off: its row stays, the line says so with Undo, and u puts it back.
  await page.keyboard.press("j");
  await expect(article(page).getByRole("heading", { name: NEWEST })).toBeVisible();
  await page.keyboard.press("j");
  await expect(article(page).getByRole("heading", { name: MIDDLE })).toBeVisible();
  await page.keyboard.press("l");
  await expect(sheet).toBeVisible();
  await expect(box).toBeChecked();
  await tabTo(page, box);
  await page.keyboard.press("Space");
  await expect(box).not.toBeChecked();
  await tabTo(page, sheet.getByRole("button", { name: "Save" }));
  await page.keyboard.press("Enter");
  await expect(sheet).toHaveCount(0);
  await expect(line(page)).toHaveText(`Took the article off ${name}`);
  await expect(rows).toHaveCount(2);
  await page.keyboard.press("u");
  await expect(line(page)).toHaveText("Undone.");
  const onShelf = async () => {
    const answer = await page.request.get(new URL(`/api/articles?collection=${shelf}`, FEEDS_APP).href);
    return ((await answer.json()) as { articles: unknown[] }).articles.length;
  };
  await expect.poll(onShelf).toBe(2);

  // Rename…, with the keyboard only: a name another collection has is refused in words; a new one is taken.
  const taken = `Zz taken ${Date.now()}`;
  expect((await page.request.post(new URL("/api/collections", FEEDS_APP).href, { data: { name: taken } })).status()).toBe(201);
  const listMore = page.getByRole("button", { name: "More", exact: true });
  const choose = async (name: string) => {
    await tabTo(page, listMore);
    await page.keyboard.press("Enter");
    const choice = page.getByRole("menuitem", { name });
    while (!(await choice.evaluate((element) => element === document.activeElement))) await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
  };
  await choose("Rename…");
  const renaming = page.getByRole("dialog", { name: "Rename collection" });
  await expect(renaming).toBeVisible();
  const field = renaming.getByRole("textbox", { name: "Name" });
  await tabTo(page, field);
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(taken.toUpperCase());
  await page.keyboard.press("Enter");
  await expect(renaming.getByRole("status")).toHaveText("There's already a collection with that name.");
  await page.keyboard.press("ControlOrMeta+a");
  const renamed = `${name} renamed`;
  await page.keyboard.type(renamed);
  await page.keyboard.press("Enter");
  await expect(renaming).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: renamed })).toBeVisible();
  await choose("Rename…");
  await expect(renaming).toBeVisible();
  await tabTo(page, field);
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await expect(renaming).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();

  // Delete, from its own More menu: only the collection goes, and Undo brings it back.
  await tabTo(page, listMore);
  await page.keyboard.press("Enter");
  const remove = page.getByRole("menuitem", { name: "Delete" });
  while (!(await remove.evaluate((element) => element === document.activeElement))) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/unread$/);
  await expect(line(page)).toHaveText(`Deleted the collection ${name}`);
  await expect(link).toHaveCount(0);
  await page.keyboard.press("u");
  await expect(line(page)).toHaveText("Undone.");
  await expect(link).toBeVisible();
  await link.click();
  await expect(rows).toHaveCount(2);
  // Made again, it has an address of its own.
  const again = page.url();

  // Its articles are still in their feed.
  await page.goto(new URL(`/feeds/${id}`, FEEDS_APP).href);
  await appReady(page);
  await expect(rows).toHaveCount(3);

  // Settings › Show in the sidebar: untick Collections, and they leave the sidebar; each still opens by its address.
  await page.goto(new URL("/settings/sidebar", FEEDS_APP).href);
  await appReady(page);
  const shown = page.getByRole("group", { name: "Show in the sidebar" }).getByRole("checkbox", { name: "Collections" });
  await expect(shown).toBeChecked();
  try {
    // Saved before the next page loads, or it could still show them.
    const hiding = settingsSaved(page);
    await shown.uncheck();
    await hiding;
    await expect(link).toHaveCount(0);
    await expect(sidebar(page).getByRole("heading", { name: "Collections" })).toHaveCount(0);
    await page.goto(again);
    await appReady(page);
    await expect(rows).toHaveCount(2);
    await expect(link).toHaveCount(0);
  } finally {
    // Shown again, as every other test expects.
    await page.goto(new URL("/settings/sidebar", FEEDS_APP).href);
    await appReady(page);
    // Wait for the save only when there's one to wait for (an earlier failure may have left it ticked).
    const showing = (await shown.isChecked()) ? undefined : settingsSaved(page);
    await shown.check();
    await showing;
    await expect(link).toBeVisible();
  }
});

test("on a phone, Add to collection is the same small sheet over the article, and the collection opens by its address", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the phone layout only");
  const blog = `shelf-phone-${test.info().workerIndex}-${Date.now()}`;
  const name = `Zz phone shelf ${Date.now()}`;
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${blog}/`);
  await page.goto(new URL(`/feeds/${id}`, FEEDS_APP).href);
  await appReady(page);
  const rows = page.getByRole("button", { name: new RegExp(`Blog ${blog}`) });
  await rows.first().tap();
  await expect(article(page).getByRole("heading", { name: NEWEST })).toBeVisible();

  await article(page).getByRole("button", { name: "More actions" }).tap();
  await page.getByRole("menuitem", { name: /Add to collection/ }).tap();
  const sheet = page.getByRole("dialog", { name: "Add to collection" });
  await expect(sheet).toBeVisible();
  // Inside the screen, with Cancel and Save (decision 0108), each at least 44px tall.
  const viewport = page.viewportSize()!;
  const card = (await sheet.boundingBox())!;
  expect(card.x).toBeGreaterThanOrEqual(0);
  expect(card.x + card.width).toBeLessThanOrEqual(viewport.width);
  for (const action of ["Cancel", "Save"]) {
    const button = (await sheet.getByRole("button", { name: action }).boundingBox())!;
    expect(button.height).toBeGreaterThanOrEqual(44);
  }
  await sheet.getByRole("textbox", { name: "New collection" }).fill(name);
  await sheet.getByRole("button", { name: "Save" }).tap();
  await expect(sheet).toHaveCount(0);

  const answer = await page.request.get(new URL("/api/collections", FEEDS_APP).href);
  const made = ((await answer.json()) as { collections: { id: number; name: string }[] }).collections.find((each) => each.name === name);
  expect(made).toBeTruthy();
  await page.goto(new URL(`/collections/${made!.id}`, FEEDS_APP).href);
  await appReady(page);
  await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  await expect(rows).toHaveCount(1);
});

test("an empty collection says what collections are for", async ({ page, isMobile }) => {
  test.skip(isMobile, "the words are the same on a phone");
  const name = `Zz empty ${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const made = await page.request.post(new URL("/api/collections", FEEDS_APP).href, { data: { name } });
  expect(made.status()).toBe(201);
  const { id } = ((await made.json()) as { collection: { id: number } }).collection;
  try {
    await page.goto(new URL(`/collections/${id}`, FEEDS_APP).href);
    await appReady(page);
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    await expect(page.getByText("Nothing in this collection yet. Articles you put here stay, even after a year. Add one from an article's More menu.")).toBeVisible();
  } finally {
    await page.request.post(new URL(`/api/collections/${id}/delete`, FEEDS_APP).href);
  }
});
