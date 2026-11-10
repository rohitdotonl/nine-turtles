import { expect, test, type Locator, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// Pick up and drop (decision 0246): someone held in the sidebar can be
// dropped on the foot's Pause or Unsubscribe (SPEC section 5), and a link
// dropped on nine turtles, or on a folder, opens "Follow <name>?" (SPEC
// section 3). Each test follows blogs of its own, since every test shares
// the one nine turtles that has feeds.

test.skip(({ isMobile }) => isMobile, "the wide layout shows the sidebar beside the list");
test.describe.configure({ mode: "serial" });

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });
const note = (page: Page) => sidebar(page).getByRole("status").filter({ hasText: /\S/ });
const act = (page: Page, which: "pause" | "unsubscribe") => page.locator(`[data-drop-act="${which}"]`);

function unique(prefix: string): string {
  return `${prefix}-${test.info().workerIndex}-${Date.now()}`;
}

/** Signs in and follows a blog of the test's own, in no folder (or in `folder`); its name in the sidebar. */
async function aBlog(page: Page, prefix: string, folder?: string): Promise<{ name: string; id: number }> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
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
  await dragTo(page, row(page, name), act(page, "unsubscribe"));
  await sidebar(page).getByRole("button", { name: "Undo" }).click();
  await expect(note(page)).toContainText("Undone.");
});

/** Holds a link (`address`) over `target`, as a browser does with one dragged from a page, then lets go there. */
async function dropLink(page: Page, target: Locator, address: string) {
  const data = await page.evaluateHandle((text) => {
    const transfer = new DataTransfer();
    transfer.setData("text/uri-list", text);
    return transfer;
  }, address);
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
  await sidebar(page).getByRole("button", { name: `What's in ${folder}` }).click();
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
