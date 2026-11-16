import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// Each open article has an address of its own (decision 0233, SPEC section 6):
// reload, a new tab and the browser's Back keep it, and it says who and what
// (decision 0281). Each test follows a made-up blog of its own (three articles).

const article = (page: Page) => page.getByRole("region", { name: "Article", exact: true });
const NEWEST = "On keeping a commonplace book (3)";
const MIDDLE = "Walking the long way home (2)";

/** Signs in, follows a new blog and opens its list. Returns its list's address, which gains the blog's name. */
async function openBlog(page: Page): Promise<{ name: string; list: string }> {
  const name = `addresses-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/`);
  await page.goto(new URL(`/${id}`, FEEDS_APP).href);
  await appReady(page);
  await expect(row(page, name, NEWEST)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/blog-addresses-[a-z0-9-]+-${id}$`));
  return { name, list: path(page) };
}

function row(page: Page, blog: string, title: string) {
  return page.getByRole("button", { name: new RegExp(`${title.replace(/[()]/g, "\\$&")}.*Blog ${blog}`) });
}

const path = (page: Page) => new URL(page.url()).pathname;

test.describe("on a computer", () => {
  test.skip(({ isMobile }) => isMobile, "the phone has its own test below");

  test("an open article's address names it, and a reload opens it again", async ({ page }) => {
    const { name, list } = await openBlog(page);
    await row(page, name, NEWEST).click();
    await expect(article(page).getByRole("heading", { level: 2, name: NEWEST })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${list}/[a-z0-9-]+-[0-9]+$`));
    const opened = path(page);
    expect(opened).toMatch(new RegExp(`^${list}/on-keeping-a-commonplace-book-3-[0-9]+$`));

    // Back to the list (the article has the window to itself, decision 0275), then the next one.
    await page.keyboard.press("Escape");
    await row(page, name, MIDDLE).click();
    await expect(page).toHaveURL(new RegExp(`${list}/[a-z0-9-]+-[0-9]+$`));
    expect(path(page)).not.toBe(opened);

    await page.goto(new URL(opened, FEEDS_APP).href);
    await appReady(page);
    await expect(article(page).getByRole("heading", { level: 2, name: NEWEST })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${opened}$`));
    await expect(page).toHaveTitle(`${NEWEST} · nine turtles`);
    // Back in its list, its row is the one marked as open.
    await page.keyboard.press("Escape");
    await expect(row(page, name, NEWEST)).toHaveAttribute("aria-current", "true");
  });

  test("an address with only numbers, or old words, opens the article and then says who and what", async ({ page }) => {
    const { name, list } = await openBlog(page);
    await row(page, name, NEWEST).click();
    const id = path(page).match(/[0-9]+$/)![0];
    const number = list.match(/[0-9]+$/)![0];
    await page.goto(new URL(`/an-old-name-${number}/an-old-title-${id}`, FEEDS_APP).href);
    await appReady(page);
    await expect(article(page).getByRole("heading", { level: 2, name: NEWEST })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${list}/on-keeping-a-commonplace-book-3-${id}$`));
    // Under a list that isn't theirs, the writer's name comes first.
    await page.goto(new URL(`/all/${id}`, FEEDS_APP).href);
    await appReady(page);
    await expect(article(page).getByRole("heading", { level: 2, name: NEWEST })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/all/blog-[a-z0-9-]+/on-keeping-a-commonplace-book-3-${id}$`));
  });

  test("Ctrl-click or a middle click opens the article in a new tab; the row's menu offers it too", async ({ page, context }) => {
    const { name, list } = await openBlog(page);
    const [tab] = await Promise.all([context.waitForEvent("page"), row(page, name, MIDDLE).click({ modifiers: ["ControlOrMeta"] })]);
    await tab.waitForLoadState();
    expect(path(tab)).toMatch(new RegExp(`^${list}/[a-z0-9-]+-[0-9]+$`));
    await tab.close();
    // This tab stays as it was.
    await expect(page).toHaveURL(new RegExp(`${list}$`));
    await expect(row(page, name, MIDDLE)).not.toHaveAttribute("aria-current", "true");

    const [middle] = await Promise.all([context.waitForEvent("page"), row(page, name, MIDDLE).click({ button: "middle" })]);
    await middle.waitForLoadState();
    expect(path(middle)).toMatch(new RegExp(`^${list}/[a-z0-9-]+-[0-9]+$`));
    await middle.close();

    await row(page, name, NEWEST).click({ button: "right" });
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem", { name: "Copy link" })).toBeVisible();
    const [fromMenu] = await Promise.all([context.waitForEvent("page"), menu.getByRole("menuitem", { name: "Open in a new tab" }).click()]);
    await fromMenu.waitForLoadState();
    expect(path(fromMenu)).toMatch(new RegExp(`^${list}/[a-z0-9-]+-[0-9]+$`));
  });

  test("Back and Forward keep the open article; an article that can't be opened says so", async ({ page }) => {
    const { name, list } = await openBlog(page);
    await row(page, name, NEWEST).click();
    await expect(page).toHaveURL(new RegExp(`${list}/[a-z0-9-]+-[0-9]+$`));
    const opened = path(page);
    // To Starred from the open article (the sidebar is away while it's open, decision 0275).
    await page.keyboard.press("g");
    await page.keyboard.press("s");
    await expect(page).toHaveURL(/\/starred$/);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${opened}$`));
    await expect(article(page).getByRole("heading", { level: 2, name: NEWEST })).toBeVisible();

    await page.goto(new URL(`${list}/gone-999999999`, FEEDS_APP).href);
    await appReady(page);
    await expect(page.getByText("That article couldn't be opened. It may be gone, or nine turtles can't be reached just now.")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${list}$`));
  });

  test("an address naming an article under a page that isn't a list is a wrong turn", async ({ page }) => {
    await page.goto(new URL("/all", FEEDS_APP).href);
    await appReady(page);
    await signIn(page);
    await page.goto(new URL("/settings/a-letter-3", FEEDS_APP).href);
    await expect(page.getByRole("heading", { name: "Wrong turn?" })).toBeVisible();
  });
});

test.describe("on a phone", () => {
  test.skip(({ isMobile }) => !isMobile, "the phone layout only");

  test("an open article's address names it; a reload opens it, and Back goes to its list", async ({ page }) => {
    const { name, list } = await openBlog(page);
    await row(page, name, NEWEST).click();
    await expect(page).toHaveURL(new RegExp(`${list}/[a-z0-9-]+-[0-9]+$`));
    const opened = path(page);
    await page.getByRole("button", { name: /^Back to/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`${list}$`));

    await page.goto(new URL(opened, FEEDS_APP).href);
    await appReady(page);
    await expect(article(page).getByRole("heading", { level: 2, name: NEWEST })).toBeVisible();
    // A reload keeps it, and one Back goes to its list.
    await page.reload();
    await appReady(page);
    await expect(article(page).getByRole("heading", { level: 2, name: NEWEST })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${list}$`));
    await expect(row(page, name, NEWEST)).toBeVisible();
  });
});
