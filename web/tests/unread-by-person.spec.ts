import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// Unread, by person (SPEC section 6, decision 0271): each name once, as a
// heading, with their titles under it; people first, then "Publications".
// Every test shares one reader, so each follows blogs of its own and Unread
// is shown with only theirs, in the order the server sent it.

const list = (page: Page) => page.locator("#list-pane");
const rows = (page: Page) => list(page).locator(".item-row");
/** The names and "Publications": people's names and the label under the list's title, publications' names under the label. */
const names = (page: Page) => list(page).locator(".item-list :is(h3, h4)");

/** Follows two people and a publication, three unread articles each, and opens Unread with only theirs. */
async function openUnread(page: Page, writer?: string): Promise<{ people: string[]; publication: string }> {
  const stem = `ubp-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const ids: number[] = [];
  for (const name of [`${stem}-a`, `${stem}-b`, `${stem}-p`]) ids.push(await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`));
  const settled = await page.request.post(new URL(`/api/feeds/${ids[2]}`, page.url()).href, { data: { kind: "publication" } });
  expect(settled.status()).toBe(204);
  await page.route("**/api/articles?*", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("view") !== "unread") return route.fallback();
    const response = await route.fetch();
    const body = await response.json();
    // Every page the server sends, run together, so only these three are listed: nothing else in this reader's Unread.
    let articles = body.articles;
    let next = body.next;
    while (next) {
      url.searchParams.set("after", next);
      const more = await (await page.request.get(url.href)).json();
      articles = [...articles, ...more.articles];
      next = more.next;
    }
    articles = articles.filter((article: { feed_id: number }) => ids.includes(article.feed_id));
    // A publication's writer, as its feed would name them (the made-up blogs name none).
    if (writer) for (const article of articles) if (article.feed_id === ids[2]) article.writer = writer;
    await route.fulfill({ response, json: { ...body, articles, next: null } });
  });
  await page.goto(new URL("/unread", FEEDS_APP).href);
  await appReady(page);
  await expect(rows(page)).toHaveCount(9);
  return { people: [`Blog ${stem}-a`, `Blog ${stem}-b`], publication: `Blog ${stem}-p` };
}

test("each person is named once, as a heading over their titles, people before publications", async ({ page }) => {
  const { people, publication } = await openUnread(page);
  // The two people in either order (their articles share their dates), then the publication.
  const heads = await names(page).allTextContents();
  expect(heads.slice(0, 2).sort()).toEqual([...people].sort());
  expect(heads.slice(2)).toEqual(["Publications", publication]);
  // Under each name, that person's three titles, each with its day beside the title, not under it.
  for (const name of [...people, publication]) {
    const items = list(page).locator("li").filter({ has: page.getByRole("heading", { name, exact: true }) });
    await expect(items).toHaveCount(1);
  }
  const first = rows(page).first();
  const title = await first.locator(".title").boundingBox();
  const day = await first.locator(".row-date").boundingBox();
  expect(day!.x).toBeGreaterThan(title!.x + 40);
  expect(Math.abs(day!.y - title!.y)).toBeLessThan(16);
  // The name isn't repeated in the row's small line, though a screen reader still hears whose it is.
  const shown = await rows(page).evaluateAll((all) => all.map((row) => row.querySelector(".row-feed:not(.sr-only)") === null));
  expect(shown.every(Boolean)).toBe(true);
  await expect(first).toContainText(heads[0]!);
  // The name can't be pressed: it's a heading, not a button or a link.
  await expect(list(page).locator("h3 a, h3 button")).toHaveCount(0);
});

test("a read article stays under its name, greyed, until the list loads again", async ({ page, isMobile }) => {
  test.skip(isMobile, "on a phone the article takes the screen; the same list is checked above");
  await openUnread(page);
  const heads = await names(page).allTextContents();
  await rows(page).nth(1).click();
  await expect(rows(page).nth(1).locator(".unread-dot")).toHaveCount(0);
  await expect(rows(page)).toHaveCount(9);
  expect(await names(page).allTextContents()).toEqual(heads);
});

test("by keyboard alone: one Tab stop, the arrows go title to title across names, and the names are headings", async ({ page, isMobile }) => {
  test.skip(isMobile, "a phone has no keyboard to test here");
  await openUnread(page);
  await rows(page).first().focus();
  await expect(rows(page).first()).toHaveAttribute("tabindex", "0");
  await expect(rows(page).nth(3)).toHaveAttribute("tabindex", "-1");
  // From the first person's last title, down goes to the next person's first, past their name.
  // The first press chooses the first title, as j does.
  for (let step = 0; step < 4; step++) await page.keyboard.press("ArrowDown");
  await expect(rows(page).nth(3)).toBeFocused();
  await expect(rows(page).nth(3)).toHaveAttribute("aria-current", "true");
  await page.keyboard.press("ArrowUp");
  await expect(rows(page).nth(2)).toBeFocused();
  // j goes on in the order shown, into the publications.
  await page.keyboard.press("j");
  await page.keyboard.press("j");
  await page.keyboard.press("j");
  await page.keyboard.press("j");
  await expect(rows(page).nth(6)).toHaveAttribute("aria-current", "true");
  // Screen readers list the names as headings, in order: people's and "Publications" under the list's title, a publication's under that.
  await expect(list(page).getByRole("heading", { level: 3 })).toHaveCount(3);
  await expect(list(page).getByRole("heading", { level: 4 })).toHaveCount(1);
});

for (const [what, width, text] of [
  ["a narrow phone", 320, ""],
  ["200% text", 390, "200%"],
] as const) {
  test(`on ${what}, a publication's long writer goes under the title, which keeps a readable width`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    const { publication } = await openUnread(page, "Margarethe Vandenberghe-Okonkwo and Friends");
    if (text) await page.evaluate((size) => (document.documentElement.style.fontSize = size), text);
    const row = list(page).locator("li").filter({ has: page.getByRole("heading", { name: publication, exact: true }) }).locator(".item-row");
    const title = (await row.locator(".title").boundingBox())!;
    const meta = (await row.locator(".row-meta").boundingBox())!;
    const box = (await row.boundingBox())!;
    // The title keeps most of the row; the writer and day sit under it, inside the row.
    expect(title.width).toBeGreaterThanOrEqual(box.width * 0.6);
    expect(meta.y).toBeGreaterThanOrEqual(title.y + title.height - 1);
    expect(meta.x + meta.width).toBeLessThanOrEqual(box.x + box.width + 1);
    // Nothing runs off the side.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await list(page).evaluate((pane) => [...pane.querySelectorAll(".item-row")].every((each) => each.scrollWidth <= each.clientWidth + 1))).toBe(true);
    // A person's short day still sits beside the title's first line, at its right, when there's room.
    if (!text) {
      const person = rows(page).first();
      const day = (await person.locator(".row-date").boundingBox())!;
      const words = (await person.locator(".title").boundingBox())!;
      expect(day.x).toBeGreaterThan(words.x + words.width - 1);
      expect(Math.abs(day.y - words.y)).toBeLessThan(16);
    }
  });
}
