import { expect, test, type Locator, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// Pick up and drop (decision 0248): someone held in the sidebar can be
// dropped on the foot's Pause or Unsubscribe (SPEC section 5), and a link
// dropped on nine turtles, or on a folder, opens "Follow <name>?" (SPEC
// section 3). Decision 0250: someone dropped onto someone else makes one
// person (SPEC section 36), and an article dragged from the list carries
// the publisher's link and stars on Starred (SPEC section 6). Each test follows blogs of its own, since every test shares
// the one nine turtles that has feeds.

test.skip(({ isMobile }) => isMobile, "the wide layout shows the sidebar beside the list");
test.describe.configure({ mode: "serial" });

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });
const note = (page: Page) => sidebar(page).getByRole("status").filter({ hasText: /\S/ });
const act = (page: Page, which: "pause" | "unsubscribe") => page.locator(`[data-drop-act="${which}"]`);

function unique(prefix: string): string {
  return `${prefix}-${test.info().workerIndex}-${Date.now()}`;
}

/** Signs in (unless `signedIn`) and follows a blog of the test's own, in no folder (or in `folder`); its name in the sidebar. */
async function aBlog(page: Page, prefix: string, folder?: string, signedIn = false): Promise<{ name: string; id: number }> {
  if (!signedIn) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(new URL("/all", FEEDS_APP).href);
    await appReady(page);
    await signIn(page);
  }
  const blog = unique(prefix);
  const id = await follow(page, `${FEED_SITE}/blog/${blog}/`);
  const name = `Blog ${blog}`;
  await page.request.post(new URL(`/api/feeds/${id}`, FEEDS_APP).href, { data: { title: name, folders: [], ...(folder ? { new_folder: folder } : {}) } });
  await page.goto(new URL("/unread", FEEDS_APP).href);
  await appReady(page);
  return { name, id };
}

/** Presses on `row`, moves a few steps, and holds it over `target` (letting go unless `hold`). */
async function dragTo(page: Page, row: Locator, target: Locator, hold = false) {
  await row.evaluate((element) => element.scrollIntoView({ block: "center" }));
  const from = (await row.boundingBox())!;
  await page.mouse.move(from.x + 40, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + from.height / 2 + 6, { steps: 2 });
  await expect(target).toBeVisible();
  const to = (await target.boundingBox())!;
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  // Held near the sidebar's edge, it scrolls (and while someone is held, Publications opens a place to drop): follow the target to where it is now.
  const now = (await target.boundingBox())!;
  if (Math.abs(now.y - to.y) > 1) await page.mouse.move(now.x + now.width / 2, now.y + now.height / 2, { steps: 2 });
  if (!hold) await page.mouse.up();
}

const row = (page: Page, name: string) => sidebar(page).getByRole("link", { name: new RegExp(`^${name}`) });

test("while someone is held, the foot offers Pause and Unsubscribe in place of Add, Keys and Settings", async ({ page }) => {
  const { name } = await aBlog(page, "hold");
  await expect(act(page, "unsubscribe")).toBeHidden();
  await dragTo(page, row(page, name), act(page, "unsubscribe"), true);
  await expect(act(page, "pause")).toBeVisible();
  await expect(act(page, "unsubscribe")).toHaveAttribute("data-drop", "");
  await expect(page.getByRole("link", { name: "Settings" })).toBeHidden();
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(act(page, "unsubscribe")).toBeHidden();
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(row(page, name)).toBeVisible();
});

test("dropped on Unsubscribe, they're gone at once; Undo brings them back", async ({ page }) => {
  const { name } = await aBlog(page, "drop-off");
  await dragTo(page, row(page, name), act(page, "unsubscribe"));
  await expect(note(page)).toContainText(`Unsubscribed from ${name}.`);
  await expect(row(page, name)).toHaveCount(0);
  await sidebar(page).getByRole("button", { name: "Undo" }).click();
  await expect(note(page)).toContainText("Undone.");
  await expect(row(page, name)).toBeVisible();
});

test("dropped on Unsubscribe with a starred article of theirs, the foot asks first; Keep them keeps it", async ({ page }) => {
  const { name, id } = await aBlog(page, "drop-kept");
  const listed = await (await page.request.get(new URL(`/api/articles?feed=${id}`, FEEDS_APP).href)).json();
  const starred = listed.articles[0].id as number;
  await page.request.post(new URL("/api/articles/starred", FEEDS_APP).href, { data: { ids: [starred], starred: true } });
  await dragTo(page, row(page, name), act(page, "unsubscribe"));
  const question = sidebar(page).getByRole("group", { name: `Keep what you saved from ${name}?` });
  await expect(question).toBeVisible();
  await expect(question).toContainText("You starred 1 of their articles.");
  // Nothing has gone yet, and the keyboard is on the safe answer.
  await expect(row(page, name)).toBeVisible();
  await expect(question.getByRole("button", { name: "Keep them" })).toBeFocused();
  await question.getByRole("button", { name: "Keep them" }).click();
  await expect(note(page)).toContainText(`Unsubscribed from ${name}.`);
  await expect(row(page, name)).toHaveCount(0);
  const kept = await (await page.request.get(new URL("/api/articles?view=starred", FEEDS_APP).href)).json();
  expect(kept.articles.map((article: { id: number }) => article.id)).toContain(starred);
});

test("Cancel in the foot's question leaves them followed", async ({ page }) => {
  const { name, id } = await aBlog(page, "drop-stay");
  const listed = await (await page.request.get(new URL(`/api/articles?feed=${id}`, FEEDS_APP).href)).json();
  await page.request.post(new URL("/api/articles/starred", FEEDS_APP).href, { data: { ids: [listed.articles[0].id], starred: true } });
  await dragTo(page, row(page, name), act(page, "unsubscribe"));
  await sidebar(page).getByRole("button", { name: "Cancel" }).click();
  await expect(sidebar(page).getByRole("group", { name: /Keep what you saved/ })).toHaveCount(0);
  await expect(row(page, name)).toBeVisible();
});

test("dropped on Pause, they're paused, with Undo; dropped there again, the note says they already are", async ({ page }) => {
  const { name, id } = await aBlog(page, "drop-pause");
  await dragTo(page, row(page, name), act(page, "pause"));
  await expect(note(page)).toContainText(`Paused ${name}.`);
  const paused = async () => {
    const feeds = await (await page.request.get(new URL("/api/feeds", FEEDS_APP).href)).json();
    return (feeds.feeds as { id: number; paused_at: number | null }[]).find((feed) => feed.id === id)?.paused_at ?? null;
  };
  await expect.poll(paused).not.toBeNull();
  await dragTo(page, row(page, name), act(page, "pause"));
  await expect(note(page)).toContainText(`${name} is already paused.`);
});

test("Undo after a drop on Pause unpauses them", async ({ page }) => {
  const { name, id } = await aBlog(page, "drop-unpause");
  await dragTo(page, row(page, name), act(page, "pause"));
  await expect(note(page)).toContainText(`Paused ${name}.`);
  await sidebar(page).getByRole("button", { name: "Undo" }).click();
  await expect(note(page)).toContainText("Undone.");
  const feeds = await (await page.request.get(new URL("/api/feeds", FEEDS_APP).href)).json();
  expect((feeds.feeds as { id: number; paused_at: number | null }[]).find((feed) => feed.id === id)?.paused_at).toBeNull();
});

test("Escape in the foot's question is Cancel, and the keyboard goes back to their row", async ({ page }) => {
  const { name, id } = await aBlog(page, "drop-escape");
  const listed = await (await page.request.get(new URL(`/api/articles?feed=${id}`, FEEDS_APP).href)).json();
  await page.request.post(new URL("/api/articles/starred", FEEDS_APP).href, { data: { ids: [listed.articles[0].id], starred: true } });
  await dragTo(page, row(page, name), act(page, "unsubscribe"));
  await expect(sidebar(page).getByRole("button", { name: "Keep them" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sidebar(page).getByRole("group", { name: /Keep what you saved/ })).toHaveCount(0);
  await expect(row(page, name)).toBeFocused();
});

/** A drag holding the link `address`, as a browser makes for one dragged from another tab. */
const holdingLink = (page: Page, address: string) =>
  page.evaluateHandle((text) => {
    const transfer = new DataTransfer();
    transfer.setData("text/uri-list", text);
    return transfer;
  }, address);

/** Holds a link (`address`) over `target`, as a browser does with one dragged from another tab, then lets go there. */
async function dropLink(page: Page, target: Locator, address: string) {
  const data = await holdingLink(page, address);
  await target.dispatchEvent("dragover", { dataTransfer: data });
  await expect(page.locator("html")).toHaveAttribute("data-dragging", "link");
  await expect(sidebar(page).getByText("Drop to follow this site.")).toBeVisible();
  await target.dispatchEvent("drop", { dataTransfer: data });
}

test("a link dropped on a folder opens Follow, and once followed they're in that folder", async ({ page }) => {
  const folder = unique("Dropped");
  await aBlog(page, "drop-anchor", folder);
  const blog = unique("dropped-link");
  const folderRow = sidebar(page).locator("[data-drop-folder]").filter({ hasText: folder });
  await dropLink(page, folderRow, `${FEED_SITE}/blog/${blog}/`);
  await expect(page.locator("html")).not.toHaveAttribute("data-dragging");
  await expect(page.getByText(`They'll go in ${folder}.`)).toBeVisible();
  // Nothing is followed until Follow is pressed.
  await expect(row(page, `Blog ${blog}`)).toHaveCount(0);
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  // The folder they went in opens by itself, so the reader sees where they went (decision 0261).
  await expect(sidebar(page).getByRole("button", { name: `What's in ${folder}` })).toHaveAttribute("aria-expanded", "true");
  await expect(sidebar(page).locator("[data-folder-item]").filter({ hasText: folder }).getByRole("link", { name: /^Blog .*dropped-link/ })).toBeVisible();
});

test("a link dropped anywhere else opens Follow; Not now follows nothing", async ({ page }) => {
  await aBlog(page, "drop-else");
  const blog = unique("not-now");
  await dropLink(page, page.getByRole("region", { name: "Article", exact: true }).or(page.locator("main")).first(), `${FEED_SITE}/blog/${blog}/`);
  await expect(page.getByText(/They'll go in/)).toHaveCount(0);
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(row(page, `Blog ${blog}`)).toHaveCount(0);
});

test("a link held over a text field, or while a sheet is open, or one of nine turtles' own links, isn't ours to take", async ({ page }) => {
  const { name } = await aBlog(page, "drop-not-ours");
  const html = page.locator("html");
  const data = await holdingLink(page, `${FEED_SITE}/blog/${unique("not-ours")}/`);
  // Over the list's search field: the field's own drop.
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("textbox", { name: "Search articles", exact: true }).dispatchEvent("dragover", { dataTransfer: data });
  await expect(html).not.toHaveAttribute("data-dragging");
  await page.keyboard.press("Escape");
  // While the shortcut list is open.
  await page.getByRole("button", { name: "Keys (keyboard shortcuts)" }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await page.locator("main").first().dispatchEvent("dragover", { dataTransfer: data });
  await expect(html).not.toHaveAttribute("data-dragging");
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  // One of nine turtles' own links, dragged from the sidebar onto a folder of it.
  const own = await page.evaluateHandle(() => new DataTransfer());
  await row(page, name).dispatchEvent("dragstart", { dataTransfer: own });
  await sidebar(page).dispatchEvent("dragover", { dataTransfer: data });
  await expect(html).not.toHaveAttribute("data-dragging");
  await row(page, name).dispatchEvent("dragend", { dataTransfer: own });
  // And with nothing in the way, the same link is ours.
  await sidebar(page).dispatchEvent("dragover", { dataTransfer: data });
  await expect(html).toHaveAttribute("data-dragging", "link");
  await sidebar(page).dispatchEvent("dragleave", { dataTransfer: data, relatedTarget: null });
});

test("a list of feeds (OPML) dropped on nine turtles is imported, and Undo takes it away", async ({ page }) => {
  await aBlog(page, "drop-file-anchor");
  const blog = unique("dropped-file");
  const opml = `<?xml version="1.0"?><opml version="2.0"><body><outline type="rss" text="Blog ${blog}" xmlUrl="${FEED_SITE}/blog/${blog}/feed.xml"/></body></opml>`;
  const data = await page.evaluateHandle((text) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([text], "from-another-app.opml", { type: "text/xml" }));
    return transfer;
  }, opml);
  const target = page.locator("main").first();
  await target.dispatchEvent("dragover", { dataTransfer: data });
  await expect(page.locator("html")).toHaveAttribute("data-dragging", "file");
  await expect(sidebar(page).getByText("Drop a list of feeds (OPML) to import it.")).toBeVisible();
  await target.dispatchEvent("drop", { dataTransfer: data });
  await expect(note(page)).toContainText("Added 1 feed.");
  await expect(row(page, `Blog ${blog}`)).toBeVisible();
  await sidebar(page).getByRole("button", { name: "Undo" }).click();
  await expect(row(page, `Blog ${blog}`)).toHaveCount(0);
});

test("someone dropped onto someone else makes one person, under the name of the one dropped on; Undo parts them", async ({ page }) => {
  const { name: theirs } = await aBlog(page, "join-onto");
  const { name: mine } = await aBlog(page, "join-held", undefined, true);
  // Room for both rows away from the sidebar's foot, where holding scrolls the list.
  await page.setViewportSize({ width: 1280, height: 1100 });
  await dragTo(page, row(page, mine), row(page, theirs), true);
  await expect(page.locator(".drag-ghost")).toHaveText(`One person with ${theirs}`);
  await expect(row(page, theirs)).toHaveAttribute("data-drop", "");
  await page.mouse.up();
  await expect(note(page)).toContainText(`${theirs} is one person now.`);
  await expect(row(page, mine)).toHaveCount(0);
  await expect(row(page, theirs)).toBeVisible();
  await sidebar(page).getByRole("button", { name: "Undo" }).click();
  await expect(note(page)).toContainText("Undone.");
  await expect(row(page, mine)).toBeVisible();
  await expect(row(page, theirs)).toBeVisible();
});

test("an article dragged from the list carries the publisher's link, and let go on Starred it's starred, with Undo", async ({ page }) => {
  const { name, id } = await aBlog(page, "drag-article");
  await row(page, name).click();
  const first = page.locator(".item-row").first();
  await expect(first).toHaveAttribute("draggable", "true");
  const listed = await (await page.request.get(new URL(`/api/articles?feed=${id}`, FEEDS_APP).href)).json();
  const article = listed.articles.find((each: { title: string }) => (each.title ?? "") !== "") ?? listed.articles[0];
  const rowOf = page.locator(".item-row").filter({ hasText: article.title });
  const data = await page.evaluateHandle(() => new DataTransfer());
  await rowOf.dispatchEvent("dragstart", { dataTransfer: data });
  expect(await data.evaluate((transfer) => transfer.getData("text/uri-list"))).toBe(article.link);
  const starred = sidebar(page).getByRole("link", { name: "Starred" });
  await starred.dispatchEvent("dragover", { dataTransfer: data });
  await expect(starred).toHaveAttribute("data-drop", "");
  await starred.dispatchEvent("drop", { dataTransfer: data });
  await rowOf.dispatchEvent("dragend", { dataTransfer: data });
  await expect(starred).not.toHaveAttribute("data-drop");
  await expect(page.getByText("Starred.", { exact: true })).toBeVisible();
  const kept = async () => (await (await page.request.get(new URL("/api/articles?view=starred", FEEDS_APP).href)).json()).articles.map((each: { id: number }) => each.id);
  await expect.poll(kept).toContain(article.id);
  await page.getByRole("button", { name: "Undo" }).first().click();
  await expect.poll(kept).not.toContain(article.id);
});

test("held someone who's a person already and dropped onto a blog, the one person takes the blog's name", async ({ page }) => {
  const { name: theirs } = await aBlog(page, "join-lone");
  const { name: first, id: one } = await aBlog(page, "join-pair-a", undefined, true);
  const { id: two } = await aBlog(page, "join-pair-b", undefined, true);
  await page.request.post(new URL("/api/writers/join", FEEDS_APP).href, { data: { feeds: [one, two] } });
  await page.reload();
  await appReady(page);
  await page.setViewportSize({ width: 1280, height: 1100 });
  await dragTo(page, row(page, first), row(page, theirs), true);
  await expect(page.locator(".drag-ghost")).toHaveText(`One person with ${theirs}`);
  await page.mouse.up();
  await expect(note(page)).toContainText(`${theirs} is one person now.`);
  await expect(row(page, theirs)).toBeVisible();
  await expect(row(page, first)).toHaveCount(0);
  await sidebar(page).getByRole("button", { name: "Undo" }).click();
  await expect(row(page, first)).toBeVisible();
  await expect(row(page, theirs)).toBeVisible();
});

test("an article dragged with the mouse onto Starred is starred; one starred already isn't taken", async ({ page }) => {
  const { name } = await aBlog(page, "drag-real");
  await row(page, name).click();
  const rows = page.locator(".item-row");
  await expect(rows.first()).toBeVisible();
  const starred = sidebar(page).getByRole("link", { name: "Starred" });
  await rows.first().dragTo(starred);
  await expect(page.getByText("Starred.", { exact: true })).toBeVisible();
  // Starred already: Starred takes no drop tone, and nothing changes.
  const data = await page.evaluateHandle(() => new DataTransfer());
  await rows.first().dispatchEvent("dragstart", { dataTransfer: data });
  await starred.dispatchEvent("dragover", { dataTransfer: data });
  await expect(starred).not.toHaveAttribute("data-drop");
  await rows.first().dispatchEvent("dragend", { dataTransfer: data });
});
