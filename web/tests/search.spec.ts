import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, nothingToPickUp, signIn, tabTo } from "./screens";

// SPEC section 14 (search), "How to check it", done by a browser, with the
// keyboard only. Each test uses blogs and a folder of its own, since every
// test shares the one nine turtles that has feeds.

test.skip(({ isMobile }) => isMobile, "the wide layout shows the list beside the sidebar");

const field = (page: Page) => page.getByRole("textbox", { name: "Search articles", exact: true });
const heading = (page: Page) => page.locator("#list-heading");
const results = (page: Page) => page.getByRole("region", { name: /^Results in / }).getByRole("listitem");

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
  // A person's list title is their name, a button ending in a "›" that screen readers don't hear.
  await expect(heading(page)).toHaveAccessibleName(name);
  await expect(field(page)).toBeVisible();
}

test("a search starts where you are, marks the words it found, and Escape brings you back", async ({ page }) => {
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

  // 1. In a folder, `/` and a word: the chip shows the folder; the word is marked with a faint
  // accent tone behind it (decision 0037), in the text's own color and weight, with a fine underline so it isn't tone alone.
  await page.keyboard.press("/");
  await expect(field(page)).toBeFocused();
  await expect(page.getByRole("button", { name: `Remove in: ${folder}` })).toBeVisible();
  // With a chip in it, the box still stays one line.
  expect((await page.locator(".search-box").boundingBox())!.height).toBeLessThan(50);
  await page.keyboard.type("walking");
  await expect(heading(page)).toHaveText(`Results in ${folder}`);
  await expect(results(page)).toHaveCount(1);
  await expect(results(page).first()).toContainText(`Walking the long way home`);
  await expect(results(page).first()).toContainText(`Blog ${filed}`);
  const found = results(page).first().locator(".title mark");
  await expect(found).toHaveText("Walking");
  await expect(found).toHaveCSS("text-decoration-line", "underline");
  await expect(found).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(found).toHaveCSS("border-top-left-radius", "3px");
  const [wordColor, titleColor, wordWeight, titleWeight] = await Promise.all([
    found.evaluate((e) => getComputedStyle(e).color),
    found.evaluate((e) => getComputedStyle(e.parentElement!).color),
    found.evaluate((e) => getComputedStyle(e).fontWeight),
    found.evaluate((e) => getComputedStyle(e.parentElement!).fontWeight),
  ]);
  expect(wordColor).toBe(titleColor);
  expect(wordWeight).toBe(titleWeight);
  // A quiet line above the results says how many; there's nothing new to fetch, so Refresh steps aside.
  await expect(page.getByRole("status").filter({ hasText: /^1 result$/ })).toBeVisible();
  await expect(page.getByRole("region", { name: /^Results in / }).getByRole("button", { name: "Refresh" })).toHaveCount(0);

  // 2. Without the chip (Backspace at the start of the field removes it), results come from every feed.
  await page.keyboard.press("Home");
  await page.keyboard.press("Backspace");
  await expect(page.getByRole("button", { name: `Remove in: ${folder}` })).toHaveCount(0);
  await expect(results(page).filter({ hasText: `Blog ${loose}` })).toHaveCount(1);
  await expect(results(page).filter({ hasText: `Blog ${filed}` })).toHaveCount(1);

  // Nothing else to choose: no options button (decision 0241).
  await expect(page.getByRole("button", { name: "Search options" })).toHaveCount(0);

  // Results behave like the list: j and s star the result.
  await results(page).first().getByRole("button").focus();
  await page.keyboard.press("j");
  await page.keyboard.press("s");
  await expect(results(page).first()).toContainText("Starred");

  // 3. Typing a filter is gone (decision 0180): "is:starred" is searched as words.
  await field(page).fill("is:starred");
  await expect(page.getByRole("button", { name: "Remove Starred", exact: true })).toHaveCount(0);
  await field(page).fill("walking");

  // 5 is the Hindi test below. 6. Escape: back exactly where you were, the search gone.
  await page.keyboard.press("Escape");
  await expect(heading(page)).toHaveText(folder);
  await expect(heading(page)).toBeFocused();
  await expect(field(page)).toHaveValue("");
  // At rest the field says "Search articles"; back in it, the search starts in the folder again.
  await expect(field(page)).toHaveAttribute("placeholder", "Search articles");
  await field(page).focus();
  await expect(page.getByRole("button", { name: `Remove in: ${folder}` })).toBeVisible();
  // The folder, with the article still open in it (decision 0233).
  await expect(page).toHaveURL(new RegExp(`/folders/${folderId}/articles/[0-9]+$`));
});

test("Mark all as read marks only the results, and u undoes it", async ({ page }) => {
  const name = unique("marked");
  const [id] = await start(page, [`${FEED_SITE}/blog/${name}/`]);
  await open(page, `/people/${id}`, `Blog ${name}`);
  const count = (unread: number) =>
    page.getByRole("navigation", { name: "Sidebar" }).getByRole("link", { name: `Blog ${name} unread` }).and(page.locator(`[data-unread="${unread}"]`));
  await expect(count(3)).toBeVisible();

  await page.keyboard.press("/");
  await page.keyboard.type("walking");
  await page.keyboard.press("Enter");
  await expect(results(page)).toHaveCount(1);
  await results(page).first().getByRole("button").focus();
  await page.keyboard.press("Shift+A");
  await expect(page.getByText("Marked 1 article as read.")).toBeVisible();
  await expect(count(2)).toBeVisible();
  await page.keyboard.press("u");
  await expect(page.getByText("Undone.")).toBeVisible();
  await expect(count(3)).toBeVisible();
});

test("Hindi words are found whole", async ({ page }) => {
  const name = unique("kavita");
  const [id] = await start(page, [`${FEED_SITE}/hindi/${name}/`]);
  await open(page, `/people/${id}`, `Kavita ${name}`);
  await page.keyboard.press("/");
  await page.keyboard.type("किताबें");
  await page.keyboard.press("Enter");
  await expect(results(page)).toHaveCount(1);
  await expect(results(page).first()).toContainText("पुस्तकालय की एक शाम");
  await field(page).fill("पुस्तकालय");
  await expect(results(page).first().locator(".title mark")).toHaveText("पुस्तकालय");
  // The word is in the text too: the excerpt shows it there, whole.
  await expect(results(page).first().locator(".excerpt mark")).toHaveText("पुस्तकालय");
});

test("each result shows its text around the match under the title, and × clears the field", async ({ page, isMobile }) => {
  const blog = unique("excerpt");
  const [id] = await start(page, [`${FEED_SITE}/blog/${blog}/`]);
  await open(page, `/people/${id}`, `Blog ${blog}`);
  await page.keyboard.press("/");
  // No × until there's something to clear.
  await expect(page.getByRole("button", { name: "Clear search" })).toHaveCount(0);
  await page.keyboard.type("summary");
  await page.keyboard.press("Enter");
  await expect(results(page)).toHaveCount(3);

  // The word is only in each article's text: up to two quiet lines show it there, right under the title,
  // the word itself marked as in a title (the same faint accent tone, same weight) and in full ink.
  const excerpt = results(page).first().locator(".excerpt");
  await expect(excerpt).toHaveText("A short made-up summary for article 3.");
  const word = excerpt.locator("mark");
  await expect(word).toHaveText("summary");
  await expect(word).toHaveCSS("font-weight", "400");
  const [wordFill, wordCorner] = await word.evaluate((e) => [getComputedStyle(e).backgroundColor, getComputedStyle(e).borderTopLeftRadius]);
  expect(wordFill).not.toBe("rgba(0, 0, 0, 0)");
  expect(wordCorner).toBe("3px");
  const [wordColor, lineColor, titleColor] = await Promise.all([
    word.evaluate((e) => getComputedStyle(e).color),
    excerpt.evaluate((e) => getComputedStyle(e).color),
    results(page).first().locator(".title").evaluate((e) => getComputedStyle(e).color),
  ]);
  expect(wordColor).not.toBe(lineColor);
  expect(wordColor).toBe(titleColor);
  // At most two lines, however long the text.
  const lineHeight = parseFloat(await excerpt.evaluate((e) => getComputedStyle(e).lineHeight));
  expect((await excerpt.boundingBox())!.height).toBeLessThanOrEqual(2 * lineHeight + 1);
  expect(await excerpt.evaluate((e) => getComputedStyle(e).getPropertyValue("-webkit-line-clamp"))).toBe("2");
  // As Apple Books orders a result: the title, then the text, then the meta line (decision 0040).
  const order = await results(page)
    .first()
    .evaluate((element) => [...element.querySelector("button")!.children].map((child) => (child.classList.contains("title") ? "title" : child.classList.contains("excerpt") ? "excerpt" : child.querySelector("time") ? "meta" : "")).filter(Boolean));
  expect(order).toEqual(["title", "excerpt", "meta"]);

  // The × in the field: the field's height square (44px on a phone, 36px with a mouse, decision 0051),
  // named for screen readers; it empties the field and keeps the keyboard there.
  const clear = page.getByRole("button", { name: "Clear search" });
  const box = (await clear.boundingBox())!;
  const least = isMobile ? 44 : 36;
  expect(box.width).toBeGreaterThanOrEqual(least);
  expect(box.height).toBeGreaterThanOrEqual(least);
  await clear.click();
  await expect(field(page)).toHaveValue("");
  await expect(field(page)).toBeFocused();
  await expect(clear).toHaveCount(0);
});

test("with nothing found, the reading area doesn't offer j", async ({ page }) => {
  await nothingToPickUp(page);
  const blog = unique("nothing");
  const [id] = await start(page, [`${FEED_SITE}/blog/${blog}/`]);
  await open(page, `/people/${id}`, `Blog ${blog}`);
  const reading = page.getByRole("region", { name: "Article", exact: true });
  await expect(reading).toContainText("Time to read something beautiful.");
  await page.keyboard.press("/");
  await page.keyboard.type("zzyzxquux");
  await page.keyboard.press("Enter");
  await expect(page.getByText(`Nothing found for “zzyzxquux” in Blog ${blog}.`)).toBeVisible();
  await expect(reading).toContainText("Time to read something beautiful.");
  await expect(reading).not.toContainText(/press j/i);
});

test("a search from Starred finds only starred ones: the place is the filter (decision 0241)", async ({ page }) => {
  const blog = unique("starred-search");
  const [id] = await start(page, [`${FEED_SITE}/blog/${blog}/`]);
  await open(page, `/people/${id}`, `Blog ${blog}`);
  await field(page).focus();
  await page.keyboard.type("walking");
  await page.keyboard.press("Enter");
  await expect(results(page)).toHaveCount(1);
  await results(page).first().getByRole("button").focus();
  await page.keyboard.press("j");
  await page.keyboard.press("s");
  await expect(results(page).first()).toContainText("Starred");
  await page.keyboard.press("Escape");
  await page.getByRole("navigation", { name: "Sidebar" }).getByRole("link", { name: "Starred", exact: true }).click();
  await expect(heading(page)).toHaveText("Starred");
  await field(page).focus();
  await expect(page.getByRole("button", { name: "Remove in: Starred" })).toBeVisible();
  await page.keyboard.type("walking");
  await page.keyboard.press("Enter");
  // Other tests star articles here too, so: this blog's one starred match, and nothing unstarred.
  await expect(results(page).filter({ hasText: `Blog ${blog}` })).toHaveCount(1);
  await expect(results(page).filter({ hasText: `Blog ${blog}` })).toContainText("Walking the long way home");
  await expect(results(page).filter({ hasNotText: "Starred" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Search options" })).toHaveCount(0);
});

test("a search that found nothing in one place offers Search all articles, which looks everywhere", async ({ page }) => {
  // Decision 0212: no dead ends.
  const blog = unique("wider");
  const [id] = await start(page, [`${FEED_SITE}/blog/${blog}/`]);
  await open(page, `/people/${id}`, `Blog ${blog}`);
  await page.keyboard.press("/");
  await page.keyboard.type("zzyzxquux");
  await page.keyboard.press("Enter");
  await expect(page.getByText(`Nothing found for “zzyzxquux” in Blog ${blog}.`)).toBeVisible();
  const wider = page.getByRole("button", { name: "Search all articles" });
  await expect(wider).toBeVisible();
  await tabTo(page, wider);
  await page.keyboard.press("Enter");
  // The same words, everywhere, with the keyboard back in the search field: nothing more to offer when that finds nothing too.
  await expect(field(page)).toHaveValue("zzyzxquux");
  await expect(field(page)).toBeFocused();
  await expect(page.getByText(`Nothing found for “zzyzxquux” in Blog ${blog}.`)).toHaveCount(0);
  await expect(page.getByText(/^Nothing found for “zzyzxquux”/)).toBeVisible();
  await expect(wider).toHaveCount(0);
});
