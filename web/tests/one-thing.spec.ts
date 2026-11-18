import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// Decision 0275, SPEC section 4: one thing at a time, the way nine turtles
// reads on a computer, for every reader. Nothing open: the sidebar and the
// list alone, its rows in a centred column; then the article alone in the
// whole window, with the list's name at its top left, and Escape, that name
// or the browser's Back going back. A phone already read this way. They run
// on the nine turtles that reads the made-up publisher, so each can follow a
// blog of its own.

const at = (path: string) => new URL(path, FEEDS_APP).href;

/** Signs in, as the owner, if this browser isn't yet. */
async function signedIn(page: Page): Promise<void> {
  await page.goto(at("/"));
  await appReady(page);
  if (await page.getByLabel("Password", { exact: true }).isVisible()) await signIn(page);
}

/** Follows a blog of this test's own (three articles) and opens its list. */
async function openBlog(page: Page, name: string): Promise<{ id: number; title: string }> {
  const id = await follow(page, `${FEED_SITE}/blog/${name}/`);
  await page.goto(at(`/${id}`));
  await appReady(page);
  await expect(page.locator("#list-pane .item-row").first()).toBeVisible();
  return { id, title: `Blog ${name}` };
}

const article = (page: Page) => page.getByRole("region", { name: "Article" });
const titleOf = (page: Page) => article(page).getByRole("heading", { level: 2 });
const rows = (page: Page) => page.locator("#list-pane .item-row");

test("on a computer: the list alone, then the article alone, and back to the same row", async ({ page, isMobile }) => {
  test.skip(isMobile, "A phone's own test is below.");
  await signedIn(page);
  const blog = await openBlog(page, `one-thing-${test.info().workerIndex}-${Date.now()}`);
  const list = page.locator("#list-pane");
  const sidebar = page.locator("#sidebar");

  // Nothing open: the sidebar and the list, no reading area, the list in one column as wide as the article's,
  // centred beside the sidebar (decisions 0277 and 0278).
  await expect(sidebar).toBeVisible();
  await expect(article(page)).toHaveCount(0);
  await expect(page.getByText(/^(Nothing open|Choose an article)/)).toHaveCount(0);
  const listTitleX = (await rows(page).first().locator(".title").boundingBox())!.x;
  expect(Math.abs((await page.locator("#list-heading").boundingBox())!.x - listTitleX)).toBeLessThan(1);
  const [left, right] = await list.locator(".scroller").evaluate((element) => [parseFloat(getComputedStyle(element).paddingLeft), parseFloat(getComputedStyle(element).paddingRight)]);
  expect(Math.abs(left! - right!)).toBeLessThan(2);

  // Opening the second article: it alone fills the window, with the list's name at its top left.
  const second = rows(page).nth(1);
  const secondRow = (await second.textContent()) ?? "";
  await second.click();
  await expect(article(page)).toBeVisible();
  await expect(sidebar).toBeHidden();
  await expect(list).toBeHidden();
  await expect(page).toHaveURL(/\/[a-z0-9-]+-\d+\/[a-z0-9-]+-\d+$/);
  const back = page.getByRole("button", { name: `Back to ${blog.title}`, exact: true });
  await expect(back).toBeVisible();
  const [backBox, articleBox, viewport] = await Promise.all([back.boundingBox(), article(page).boundingBox(), page.viewportSize()]);
  expect(backBox!.height).toBeGreaterThanOrEqual(44);
  expect(articleBox!.width).toBeGreaterThan(viewport!.width - 2);
  // The article's column is as wide as the list's was (decision 0277), centred in the window, and its bar stands
  // over the text, its first and last icons mirroring each other over the text's edges (decision 0299).
  const text = (await article(page).locator(".article").boundingBox())!;
  expect(Math.abs(backBox!.x + 12 - text.x)).toBeLessThan(2);
  const more = (await page.getByRole("button", { name: "More actions" }).boundingBox())!;
  expect(Math.abs(more.x + more.width - 12 - (text.x + text.width))).toBeLessThan(2);
  // No sidebar button over it, and full-screen reading is gone: not in More, not in the cheat sheet, and f does nothing.
  await expect(page.getByRole("button", { name: /^Sidebar/ })).toBeHidden();
  await page.getByRole("button", { name: "More actions" }).click();
  await expect(page.getByRole("menuitem", { name: /Full-screen reading/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.keyboard.press("?");
  const sheet = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(sheet.getByText("Open article", { exact: true })).toBeVisible();
  await expect(sheet.getByText("Full-screen reading")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  const opened = (await titleOf(page).textContent())?.trim() ?? "";
  expect(opened).not.toBe("");
  expect(secondRow).toContain(opened);
  await titleOf(page).focus();
  await page.keyboard.press("f");
  await expect(article(page)).toBeVisible();
  await expect(sidebar).toBeHidden();
  await expect(list).toBeHidden();

  // j and k move to the next and previous article while reading.
  await page.keyboard.press("j");
  await expect(titleOf(page)).not.toHaveText(opened);
  await page.keyboard.press("k");
  await expect(titleOf(page)).toHaveText(opened);

  // Escape: back to the list as it was, the keyboard on the row that was open.
  await page.keyboard.press("Escape");
  await expect(list).toBeVisible();
  await expect(sidebar).toBeVisible();
  await expect(article(page)).toHaveCount(0);
  await expect(rows(page).nth(1)).toBeFocused();

  // Enter opens it again; the back button goes back the same way.
  await page.keyboard.press("Enter");
  await expect(article(page)).toBeVisible();
  await back.click();
  await expect(list).toBeVisible();
  await expect(rows(page).nth(1)).toBeFocused();

  // The browser's Back goes back to the list too, and Forward opens the article again.
  await rows(page).first().click();
  await expect(article(page)).toBeVisible();
  await page.goBack();
  await expect(list).toBeVisible();
  await expect(article(page)).toHaveCount(0);
  await page.goForward();
  await expect(article(page)).toBeVisible();
  await expect(list).toBeHidden();

  // Reloading at an article's address opens it alone, with its way back.
  await page.reload();
  await appReady(page);
  await expect(article(page)).toBeVisible();
  await expect(list).toBeHidden();
  await back.click();
  await expect(list).toBeVisible();

  // A person's page fills the window the same way; its × goes back to their list.
  await page.goto(at(`/${blog.id}/about`));
  await appReady(page);
  await expect(page.getByRole("heading", { level: 2, name: blog.title })).toBeVisible();
  await expect(sidebar).toBeHidden();
  await expect(list).toBeHidden();
  await page.locator(".who-page").getByRole("button", { name: /^Back to / }).click();
  await expect(list).toBeVisible();
  await expect(sidebar).toBeVisible();
  // Their settings too: alone in the window, and Escape goes back to their page, still alone.
  await page.goto(at(`/${blog.id}/settings`));
  await appReady(page);
  await expect(page.getByRole("heading", { level: 2, name: "Settings" })).toBeVisible();
  await expect(sidebar).toBeHidden();
  await expect(list).toBeHidden();
  await page.locator("body").focus();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(new RegExp(`/(?:[a-z0-9-]+-)?${blog.id}/about$`));
  await expect(page.getByRole("heading", { level: 2, name: blog.title })).toBeVisible();
  await expect(list).toBeHidden();

  // Nothing to switch: Settings has no switch for it.
  await page.goto(at("/settings"));
  await expect(page.getByText(/^Version /)).toBeVisible();
  await expect(page.getByRole("switch", { name: "Read one thing at a time" })).toHaveCount(0);
});

test("Settings and Everyone you follow are centred beside the sidebar", async ({ page, isMobile }) => {
  test.skip(isMobile, "A phone has one edge for every screen.");
  await page.setViewportSize({ width: 1440, height: 800 });
  await signedIn(page);
  // Each page's own column sits in the middle of the area beside the sidebar, as the list does (decision 0278).
  const centred = async (section: string) => {
    const [area, column] = await Promise.all([page.locator(section).boundingBox(), page.locator(`${section} .scroller > .mx-auto`).first().boundingBox()]);
    expect(Math.abs(column!.x - area!.x - (area!.x + area!.width - column!.x - column!.width))).toBeLessThan(20);
    expect(column!.x - area!.x).toBeGreaterThan(100);
  };
  await page.goto(at("/settings"));
  await appReady(page);
  await centred("section[aria-labelledby='settings-heading']");
  await page.getByRole("link", { name: "Everyone you follow" }).click();
  await expect(page.locator("#your-feeds-heading")).toBeVisible();
  await centred("section[aria-labelledby='your-feeds-heading']");
});

test("a row chosen with j, then their page opened over it, is still unread: only an opened article is read", async ({ page, isMobile }) => {
  test.skip(isMobile, "A phone has no j.");
  await signedIn(page);
  const blog = await openBlog(page, `one-thing-unread-${test.info().workerIndex}-${Date.now()}`);
  await expect(rows(page).first()).toHaveAccessibleName(/, unread/);
  await page.locator("#list-heading").focus();
  await page.keyboard.press("j");
  await expect(rows(page).first()).toBeFocused();
  // i: their page has the window; its ‹ goes back to their list.
  await page.keyboard.press("i");
  await expect(page.getByRole("heading", { level: 2, name: blog.title })).toBeVisible();
  await expect(page.locator("#list-pane")).toBeHidden();
  await page.locator(".who-page").getByRole("button", { name: /^Back to / }).click();
  await expect(page.locator("#list-pane")).toBeVisible();
  // The chosen row was never opened, so it's still unread, here and on the server.
  await expect(rows(page).first()).toHaveAccessibleName(/, unread/);
  await page.reload();
  await appReady(page);
  await expect(rows(page).first()).toHaveAccessibleName(/, unread/);
});

test("on a medium window: the sidebar stays beside the list, and the article still has the window", async ({ page, isMobile }) => {
  test.skip(isMobile, "A phone's own test is below.");
  await page.setViewportSize({ width: 1000, height: 800 });
  await signedIn(page);
  const blog = await openBlog(page, `one-thing-medium-${test.info().workerIndex}-${Date.now()}`);
  await expect(page.locator("#sidebar")).toBeVisible();
  await expect(page.locator("#list-pane")).toBeVisible();
  await rows(page).first().click();
  await expect(article(page)).toBeVisible();
  await expect(page.locator("#sidebar")).toBeHidden();
  await expect(page.locator("#list-pane")).toBeHidden();
  await page.getByRole("button", { name: `Back to ${blog.title}`, exact: true }).click();
  await expect(page.locator("#sidebar")).toBeVisible();
  await expect(rows(page).first()).toBeFocused();
});

test("on a phone the article is its own screen, as always", async ({ page, isMobile }) => {
  test.skip(!isMobile, "The computer's own tests are above.");
  await signedIn(page);
  const blog = await openBlog(page, `one-thing-phone-${test.info().workerIndex}-${Date.now()}`);
  await rows(page).first().click();
  await expect(article(page)).toBeVisible();
  // The phone's own build: its top bar's back and its bottom toolbar, with Previous and Next.
  await expect(page.getByRole("button", { name: `Back to ${blog.title}`, exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Article actions" })).toBeVisible();
});

test("every reader reads this way, not only the owner", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("phone"), "A phone already did, for everyone.");
  const stranger = await browser.newContext();
  const page = await stranger.newPage();
  await page.goto(at("/sign-up"));
  await appReady(page);
  await page.getByLabel("Email").fill(`one-thing-${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("slow mornings, long reads");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.locator("#sidebar")).toBeAttached();
  const blog = await openBlog(page, `one-thing-stranger-${testInfo.workerIndex}-${Date.now()}`);
  await rows(page).first().click();
  await expect(article(page)).toBeVisible();
  await expect(page.locator("#list-pane")).toBeHidden();
  await expect(page.locator("#sidebar")).toBeHidden();
  await expect(page.getByRole("button", { name: `Back to ${blog.title}`, exact: true })).toBeVisible();
  await stranger.close();
});

test("their page opened from an article's More closes back to that article (decisions 0284, 0289)", async ({ page, isMobile }) => {
  await signedIn(page);
  const blog = await openBlog(page, `one-thing-writer-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`);
  await rows(page).nth(1).click();
  await expect(article(page)).toBeVisible();
  const title = (await titleOf(page).textContent()) ?? "";
  await article(page).getByRole("button", { name: "More actions" }).last().click();
  await page.getByRole("menuitem", { name: `Info about ${blog.title}` }).click();
  await expect(page.getByRole("heading", { level: 2, name: blog.title })).toBeVisible();
  // On a phone its ‹ says where it goes; on a computer, × (and Escape).
  if (isMobile) await page.getByRole("button", { name: "Article", exact: true }).click();
  else await page.keyboard.press("Escape");
  await expect(titleOf(page)).toHaveText(title);
  await expect(page).toHaveURL(/\/[a-z0-9-]+-\d+\/[a-z0-9-]+-\d+$/);
});

test("their name in an article opens their list, and ‹ Article goes back to it, by the keyboard and through their page too (decision 0289)", async ({ page, isMobile }) => {
  await signedIn(page);
  const blog = await openBlog(page, `one-thing-byline-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`);
  // Read in All articles, so going back to the article means going back to All.
  await page.goto(at("/all"));
  await appReady(page);
  await page.locator("#list-pane .item-row").filter({ hasText: blog.title }).first().click();
  const title = (await titleOf(page).textContent()) ?? "";
  const toAll = page.getByRole("button", { name: "Back to All articles" });
  await expect(toAll).toBeVisible();

  // By the keyboard: the name under the title, Enter. Their list, their picture leading its title, with ‹ Article.
  await article(page).locator(".article-byline").getByRole("link", { name: blog.title, exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#list-heading")).toContainText(blog.title);
  await expect(page.locator("#list-heading .portrait")).toBeVisible();
  const back = page.getByRole("button", { name: "Back to the article" });
  await expect(back).toBeVisible();
  if (isMobile) await expect(page.getByRole("button", { name: "Back to Home" })).toHaveCount(0);
  // Escape goes back to the article too, as ‹ Article does.
  await page.locator("#list-heading").focus();
  await page.keyboard.press("Escape");
  await expect(titleOf(page)).toHaveText(title);
  await expect(toAll).toBeVisible();

  // Through their page and back: ‹ Article still goes back to the article, in All, never round and round.
  await article(page).locator(".article-byline").getByRole("link", { name: blog.title, exact: true }).click();
  await page.locator("#list-heading").getByRole("button", { name: blog.title }).click();
  await expect(page.getByRole("heading", { level: 2, name: blog.title })).toBeVisible();
  if (isMobile) await page.getByRole("button", { name: blog.title, exact: true }).first().click();
  else await page.keyboard.press("Escape");
  await expect(back).toBeVisible();
  await back.focus();
  await page.keyboard.press("Enter");
  await expect(titleOf(page)).toHaveText(title);
  await toAll.click();
  await expect(page.locator("#list-heading")).toHaveText("All articles");
  if (isMobile) await expect(page.getByRole("button", { name: "Back to Home" })).toBeVisible();
  else await expect(back).toHaveCount(0);
});
