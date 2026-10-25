import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn, tabTo } from "./screens";

// SPEC section 14 (search), "How to check it", done by a browser, with the
// keyboard only. Each test uses blogs and a folder of its own, since every
// test shares the one nine turtles that has feeds.

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
  await expect(heading(page)).toHaveText("Search results");
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
  await expect(page.getByRole("region", { name: "Search results" }).getByRole("button", { name: "Refresh" })).toHaveCount(0);

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
  await expect(page.getByRole("button", { name: "Remove Starred", exact: true })).toBeVisible();
  // The chip says it in plain words, as the options menu does; the typed form is its tooltip (decision 0048).
  await expect(page.getByTitle("is:starred", { exact: true })).toHaveText("Starred");
  await expect(field(page)).toHaveValue("");
  await expect(results(page)).toHaveCount(1);
  await expect(results(page).first()).toContainText("Walking the long way home");

  // 4. The options panel writes the same filters: a date makes a chip.
  await page.getByRole("button", { name: "Search options" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Search options" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("checkbox", { name: "Starred", exact: true })).toBeChecked();
  // It floats over the list instead of pushing it down.
  await expect(page.locator("#search-options")).toHaveCSS("position", "absolute");
  // A menu of checkmark rows: the list search started from, All feeds, and the feed now
  // searched (chosen above with feed:), which holds; Tab from the field lands on it.
  await field(page).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("radio", { name: `Blog ${loose}` })).toBeFocused();
  await expect(page.getByRole("radio", { name: `Blog ${loose}` })).toBeChecked();
  await expect(page.getByRole("radio", { name: `${folder} This list` })).not.toBeChecked();
  await expect(page.getByRole("radio", { name: "All feeds" })).not.toBeChecked();
  await expect(page.getByRole("combobox", { name: "Search in another feed or folder" })).toBeVisible();
  // It's drawn as a menu's submenu row, short words and a trailing chevron, not a drop-down among the checkmarks (decision 0048).
  await expect(page.locator(".menu-row").filter({ has: page.getByRole("combobox", { name: "Search in another feed or folder" }) })).toContainText("Other feed or folder");
  // Presets count back from today; Custom shows the two dates.
  await page.getByRole("radio", { name: "Past week" }).check();
  await expect(page.getByRole("button", { name: /^Remove After / })).toBeVisible();
  await page.getByRole("radio", { name: "Any time" }).check();
  await expect(page.getByRole("button", { name: /^Remove After / })).toHaveCount(0);
  await expect(page.getByLabel("Published after")).toHaveCount(0);
  await page.getByRole("radio", { name: "Custom" }).check();
  await page.getByLabel("Published after").fill("2030-01-01");
  await expect(page.getByRole("button", { name: "Remove After 1 Jan 2030", exact: true })).toBeVisible();
  await expect(page.getByText("Nothing found.")).toBeVisible();
  await page.getByRole("checkbox", { name: "Unread", exact: true }).press("Space");
  await expect(page.getByRole("button", { name: "Remove Unread", exact: true })).toBeVisible();

  // 5 is the Hindi test below. 6. Escape closes the options, then a second Escape: back exactly where you were, the search gone.
  await page.keyboard.press("Escape");
  await expect(page.locator("#search-options")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(heading(page)).toHaveText(folder);
  await expect(heading(page)).toBeFocused();
  await expect(field(page)).toHaveValue("");
  // At rest the field just says "Search"; back in it, the search starts in the folder again.
  await expect(field(page)).toHaveAttribute("placeholder", "Search");
  await field(page).focus();
  await expect(page.getByRole("button", { name: `Remove in: ${folder}` })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove Starred", exact: true })).toHaveCount(0);
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
  await expect(results(page).first().locator(".title mark")).toHaveText("पुस्तकालय");
  // The word is in the text too: the excerpt shows it there, whole.
  await expect(results(page).first().locator(".excerpt mark")).toHaveText("पुस्तकालय");
});

test("each result shows its text around the match under the title, and × clears the field", async ({ page, isMobile }) => {
  const blog = unique("excerpt");
  const [id] = await start(page, [`${FEED_SITE}/blog/${blog}/`]);
  await open(page, `/feeds/${id}`, `Blog ${blog}`);
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
  const blog = unique("nothing");
  const [id] = await start(page, [`${FEED_SITE}/blog/${blog}/`]);
  await open(page, `/feeds/${id}`, `Blog ${blog}`);
  const reading = page.getByRole("region", { name: "Article" });
  await expect(reading).toContainText(/press j/i);
  await page.keyboard.press("/");
  await page.keyboard.type("zzyzxquux");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Nothing found.")).toBeVisible();
  await expect(reading).toContainText("Time to read something beautiful.");
  await expect(reading).not.toContainText(/press j/i);
});

test("with many filters the search box wraps, and no chip slides under the options button", async ({ page }) => {
  const blog = unique("chips");
  const [id] = await start(page, [`${FEED_SITE}/blog/${blog}/`]);
  await open(page, `/feeds/${id}`, `Blog ${blog}`);
  // With an article open, the list is at its narrowest.
  await heading(page).focus();
  await page.keyboard.press("j");
  await expect(page.getByRole("region", { name: "Article" }).locator(".article-title")).toBeVisible();
  await field(page).focus();
  await page.keyboard.type("is:unread after:2020-01-01 before:2030-01-01 ");
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(4);
  const options = (await page.getByRole("button", { name: "Search options" }).boundingBox())!;
  for (const chip of await page.getByRole("button", { name: /^Remove / }).all()) {
    // The chip itself (its remove button's 44px reaches a little past it, by design).
    const box = (await chip.locator("..").boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(options.x + 1);
  }
});

test("the search options float over the list; Escape closes them first, then the search", async ({ page }) => {
  const blog = unique("options");
  const [id] = await start(page, [`${FEED_SITE}/blog/${blog}/`]);
  await open(page, `/feeds/${id}`, `Blog ${blog}`);
  await field(page).focus();
  const button = page.getByRole("button", { name: "Search options" });
  await button.click();
  const options = page.locator("#search-options");
  await expect(options).toBeVisible();
  // Past month counts back thirty days; "after" is strictly after.
  await page.getByRole("radio", { name: "Past month" }).check();
  const day = new Date();
  day.setDate(day.getDate() - 30);
  const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  // The chip says it in words ("After 24 Sept 2026"); how it's typed is its tooltip and its Remove button's description (decision 0048).
  const words = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(day);
  const remove = page.getByRole("button", { name: `Remove After ${words}`, exact: true });
  await expect(remove).toBeVisible();
  await expect(remove).toHaveAccessibleDescription(`after:${iso}`);
  await expect(page.getByTitle(`after:${iso}`, { exact: true })).toHaveText(`After ${words}`);
  // The first Escape closes only the options, back to their button; the search stays.
  await page.keyboard.press("Escape");
  await expect(options).toBeHidden();
  await expect(button).toBeFocused();
  await expect(remove).toBeVisible();
  // Leaving the search with the keyboard closes them too.
  await button.click();
  await expect(options).toBeVisible();
  await heading(page).focus();
  await expect(options).toBeHidden();
});

test("with only the keyboard: a search is saved, opened from the sidebar, renamed, and deleted with Undo", async ({ page }) => {
  const blog = unique("saved");
  const [id] = await start(page, [`${FEED_SITE}/blog/${blog}/`]);
  await open(page, `/feeds/${id}`, `Blog ${blog}`);
  await heading(page).focus();
  const sidebar = page.getByRole("navigation", { name: "Sidebar" });
  const more = page.getByRole("button", { name: "More", exact: true });
  const savedLink = (name: string) => sidebar.getByRole("link", { name: `${name} (saved search)` });
  const chip = page.getByRole("button", { name: `Remove in: Blog ${blog}` });
  /** More, then its last item: Save search… or Edit saved search…. */
  const lastInMore = async () => {
    await tabTo(page, more, 200);
    await page.keyboard.press("Enter");
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
  };

  // Search, then More › Save search…: a sheet named after the words, ready to type in.
  await page.keyboard.press("/");
  await page.keyboard.type("walking");
  await page.keyboard.press("Enter");
  await expect(results(page)).toHaveCount(1);
  await expect(page.getByRole("menuitem", { name: "Save search…" })).toHaveCount(0);
  await lastInMore();
  await expect(page.getByRole("heading", { level: 2, name: "Save search" })).toBeVisible();
  const name = page.getByRole("textbox", { name: "Name" });
  await expect(name).toBeFocused();
  await expect(name).toHaveValue("walking");
  await expect(page.getByRole("dialog")).toContainText(`walking · In Blog ${blog}`);
  const first = unique("Walks");
  await page.keyboard.press("Control+a");
  await page.keyboard.type(first);
  await page.keyboard.press("Enter");

  // Saved: it opens, with its own address, its name as the title, and its place in the sidebar.
  await expect(page).toHaveURL(/\/searches\/\d+$/);
  await expect(heading(page)).toHaveText(first);
  await expect(savedLink(first)).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 2, name: "Saved searches" })).toBeVisible();
  await expect(chip).toBeVisible();
  await expect(field(page)).toHaveValue("walking");
  const found = () => page.getByRole("region", { name: first }).getByRole("listitem");
  await expect(found()).toHaveCount(1);

  // Somewhere else (g a), then back from the sidebar: the search runs again. A reload keeps it too.
  await heading(page).focus();
  await page.keyboard.press("g");
  await page.keyboard.press("a");
  await expect(heading(page)).toHaveText("All");
  await tabTo(page, savedLink(first), 200);
  await page.keyboard.press("Enter");
  await expect(heading(page)).toHaveText(first);
  await expect(found()).toHaveCount(1);
  await page.reload();
  await appReady(page);
  await expect(heading(page)).toHaveText(first);
  await expect(chip).toBeVisible();
  await expect(found()).toHaveCount(1);

  // Changing the search (Backspace at the field's start removes the chip), then Escape: it's back as saved.
  await field(page).focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("Backspace");
  await expect(chip).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(chip).toBeVisible();

  // Edit saved search…: a new name.
  await lastInMore();
  await expect(page.getByRole("heading", { level: 2, name: "Edit saved search" })).toBeFocused();
  const second = unique("Rambles");
  await tabTo(page, page.getByRole("textbox", { name: "Name" }));
  await page.keyboard.press("Control+a");
  await page.keyboard.type(second);
  await page.keyboard.press("Enter");
  await expect(heading(page)).toHaveText(second);
  await expect(savedLink(second)).toBeVisible();
  await expect(savedLink(first)).toHaveCount(0);

  // Delete: only the search goes, and u undoes it straight afterwards.
  await lastInMore();
  await tabTo(page, page.getByRole("button", { name: `Delete ${second}` }));
  await page.keyboard.press("Enter");
  await expect(page.getByText(`Deleted the saved search ${second}`)).toBeVisible();
  await expect(savedLink(second)).toHaveCount(0);
  await page.keyboard.press("u");
  await expect(page.getByText("Undone.")).toBeVisible();
  await expect(savedLink(second)).toBeVisible();

  // Tidy up, so other tests' sidebars stay as they expect.
  await tabTo(page, savedLink(second), 200);
  await page.keyboard.press("Enter");
  await lastInMore();
  await tabTo(page, page.getByRole("button", { name: `Delete ${second}` }));
  await page.keyboard.press("Enter");
  await expect(savedLink(second)).toHaveCount(0);
});
