import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// SPEC section 13 (Refresh: the view waits for you) and section 8, check 4
// (mark all as read never touches items that arrived in the background),
// done by a browser. The test nine turtles checks every feed every two seconds,
// and the browser's clock is moved on so the list's once-a-minute question
// comes quickly. Each test follows a made-up blog of its own.

const NEW_ARTICLE = "What the river taught me (4)";
const NEWEST = "On keeping a commonplace book (3)";

async function openBlog(page: Page): Promise<string> {
  const name = `refresh-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  await page.clock.install();
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/`);
  await page.goto(new URL(`/feeds/${id}`, FEEDS_APP).href);
  await appReady(page);
  await expect(row(page, NEWEST)).toBeVisible();
  return name;
}

function row(page: Page, title: string) {
  return page.getByRole("button", { name: new RegExp(title.replace(/[()]/g, "\\$&")) });
}

/** The publisher adds an article; waits until the list says new items are waiting. */
async function publishAndWait(page: Page, blog: string, message: string) {
  const published = await page.request.get(`${FEED_SITE}/grow/${blog}`);
  expect(published.ok()).toBe(true);
  await expect(async () => {
    await page.clock.fastForward(61_000);
    await expect(page.getByRole("status").filter({ hasText: message })).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
}

test("new items wait for r, and mark all as read never touches them", async ({ page, isMobile }) => {
  test.skip(isMobile, "the phone has its own test below");
  const blog = await openBlog(page);
  const sidebar = page.getByRole("navigation", { name: "Sidebar" });
  await expect(sidebar.getByRole("link", { name: `Blog ${blog} 3 unread` })).toBeVisible();

  await publishAndWait(page, blog, "New items · press r");
  // The note floats below the articles, not above them.
  const note = (await page.getByRole("status").filter({ hasText: "New items" }).boundingBox())!;
  expect(note.y).toBeGreaterThan((await row(page, NEWEST).boundingBox())!.y);
  // The list hasn't moved: the new article isn't shown, and the counts wait too.
  await expect(row(page, NEW_ARTICLE)).toHaveCount(0);
  await expect(page.getByRole("region", { name: `Blog ${blog}` }).getByRole("list").getByRole("button")).toHaveCount(3);
  await expect(sidebar.getByRole("link", { name: `Blog ${blog} 3 unread` })).toBeVisible();

  // Mark all as read without pressing r: only the three on screen.
  await page.keyboard.press("Shift+A");
  await expect(page.getByRole("status").filter({ hasText: "Marked 3 items as read" })).toBeVisible();

  // r: the new article appears at once, still unread; the line is quiet again.
  await page.keyboard.press("r");
  await expect(row(page, NEW_ARTICLE)).toHaveAccessibleName(/, unread/);
  await expect(row(page, NEWEST)).not.toHaveAccessibleName(/, unread/);
  await expect(page.getByRole("status").filter({ hasText: "New items" })).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: `Blog ${blog} 1 unread` })).toBeVisible();
  // Undo still works after r, for the same three.
  await page.keyboard.press("u");
  await expect(row(page, NEWEST)).toHaveAccessibleName(/, unread/);
  await expect(sidebar.getByRole("link", { name: `Blog ${blog} 4 unread` })).toBeVisible();
});

test("on a phone, the note offers Show, which shows new items; Refresh in the More menu does too", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the phone layout only");
  const blog = await openBlog(page);

  await publishAndWait(page, blog, "New items");
  await expect(row(page, NEW_ARTICLE)).toHaveCount(0);
  const show = page.getByRole("button", { name: "Show new items" });
  await expect(show).toHaveText("Show");
  expect((await show.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await show.click();
  await expect(row(page, NEW_ARTICLE)).toBeVisible();
  await expect(show).toHaveCount(0);
  // Refresh is in the list's More (…) menu, the same as r.
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("menuitem", { name: "Refresh" }).click();
  await expect(row(page, NEW_ARTICLE)).toBeVisible();
});

test("reopening the app shows what arrived, without pressing anything", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same on every width");
  const blog = await openBlog(page);
  await publishAndWait(page, blog, "New items · press r");
  await page.reload();
  await appReady(page);
  await expect(row(page, NEW_ARTICLE)).toBeVisible();
});
