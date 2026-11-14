import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn, tabTo } from "./screens";

// Decision 0269, SPEC sections 4 and 18: "Read one thing at a time", the
// owner's trial. Off, nothing changes (every other spec runs with it off). On,
// on a computer: the list alone, then the article alone in the whole window,
// with the list's name at its top left and Escape going back. It's kept in
// this browser only, so each test here starts with it off. They run on the
// nine turtles that reads the made-up publisher, so each can follow a blog of its own.

const at = (path: string) => new URL(path, FEEDS_APP).href;

const SWITCH = "Read one thing at a time";

/** Signs in on Settings and switches the trial on from the keyboard, as the owner. */
async function switchOn(page: Page): Promise<void> {
  await page.goto(at("/settings"));
  await appReady(page);
  if (await page.getByLabel("Password", { exact: true }).isVisible()) await signIn(page);
  const trial = page.getByRole("switch", { name: SWITCH });
  await expect(trial).not.toBeChecked();
  await expect(trial).toHaveAccessibleDescription(/^A trial, on this device\./);
  await tabTo(page, trial);
  await page.keyboard.press("Space");
  await expect(trial).toBeChecked();
}

/** Follows a blog of this test's own (three articles) and opens its list. */
async function openBlog(page: Page, name: string): Promise<{ id: number; title: string }> {
  const id = await follow(page, `${FEED_SITE}/blog/${name}/`);
  await page.goto(at(`/people/${id}`));
  await appReady(page);
  await expect(page.locator("#list-pane .item-row").first()).toBeVisible();
  return { id, title: `Blog ${name}` };
}

const article = (page: Page) => page.getByRole("region", { name: "Article" });
const titleOf = (page: Page) => article(page).getByRole("heading", { level: 2 });
const rows = (page: Page) => page.locator("#list-pane .item-row");

test("one thing at a time: the list alone, then the article alone, and back to the same row", async ({ page, isMobile }) => {
  test.skip(isMobile, "A phone already reads one thing at a time: the phone's own test is below.");
  // TEMPORARY, to find why this fails on main: what the page asked the server for, and what was on screen.
  const asked: string[] = [];
  const began = Date.now();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) asked.push(`${Date.now() - began}ms ${request.method()} ${url.pathname}${url.search}`);
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith("/api/")) asked.push(`${Date.now() - began}ms   ${response.status()} ${url.pathname}${url.search}`);
  });
  await switchOn(page);
  const blog = await openBlog(page, `one-thing-${test.info().workerIndex}-${Date.now()}`);
  const list = page.locator("#list-pane");
  const sidebar = page.locator("#sidebar");

  // Nothing open: the sidebar and the list, no reading area, the rows in a centred column of a readable width.
  await expect(sidebar).toBeVisible();
  await expect(article(page)).toHaveCount(0);
  await expect(page.getByText(/^(Nothing open|Choose an article)/)).toHaveCount(0);
  const [listBox, rowBox] = await Promise.all([list.boundingBox(), rows(page).first().boundingBox()]);
  expect(rowBox!.width).toBeLessThanOrEqual(42 * 16);
  expect(Math.abs(rowBox!.x + rowBox!.width / 2 - (listBox!.x + listBox!.width / 2))).toBeLessThanOrEqual(24);

  // Opening the second article: it alone fills the window, with the list's name at its top left.
  const second = rows(page).nth(1);
  const secondRow = (await second.textContent()) ?? "";
  await second.click();
  await expect(article(page)).toBeVisible();
  await expect(sidebar).toBeHidden();
  await expect(list).toBeHidden();
  await expect(page).toHaveURL(/\/articles\/\d+$/);
  const back = page.getByRole("button", { name: `Back to ${blog.title}`, exact: true });
  await expect(back).toBeVisible();
  const [backBox, articleBox, viewport] = await Promise.all([back.boundingBox(), article(page).boundingBox(), page.viewportSize()]);
  expect(backBox!.height).toBeGreaterThanOrEqual(44);
  expect(backBox!.x).toBeLessThan(40);
  expect(articleBox!.width).toBeGreaterThan(viewport!.width - 2);
  // No sidebar button over it, and full-screen reading has nothing left to do: it isn't offered.
  await expect(page.getByRole("button", { name: /^Sidebar/ })).toBeHidden();
  await page.getByRole("button", { name: "More actions" }).click();
  await expect(page.getByRole("menuitem", { name: /Full-screen reading/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  // Nor does the keyboard's cheat sheet list it.
  await page.keyboard.press("?");
  const sheet = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(sheet.getByText("Open article", { exact: true })).toBeVisible();
  await expect(sheet.getByText("Full-screen reading")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  const opened =(await titleOf(page).textContent())?.trim() ?? "";
  expect(opened).not.toBe("");
  expect(secondRow).toContain(opened);

  // j and k move to the next and previous article while reading.
  await titleOf(page).focus();
  asked.push(`${Date.now() - began}ms --- j pressed`);
  await page.keyboard.press("j");
  try {
    await expect(titleOf(page)).not.toHaveText(opened, { timeout: 2000 });
  } catch (failure) {
    const seen = await page.evaluate(() => {
      const active = document.activeElement;
      const pane = document.querySelector<HTMLElement>("#list-pane");
      return {
        active: active ? `${active.tagName}.${active.className} "${active.textContent?.trim().slice(0, 60)}"` : "none",
        rows: [...document.querySelectorAll("#list-pane .item-row")].map((row) => `${row.getAttribute("aria-current") ?? ""} ${row.textContent?.trim().slice(0, 70)}`),
        pane: pane ? `children ${pane.childElementCount}, display ${getComputedStyle(pane).display}, words "${pane.textContent?.trim().slice(0, 300)}"` : "no list pane",
        dialogs: [...document.querySelectorAll("dialog[open], [role=dialog], [role=menu]")].map((each) => `${each.tagName} ${each.getAttribute("aria-label") ?? ""} ${each.textContent?.trim().slice(0, 80)}`),
      };
    });
    console.log(`DIAG url ${page.url()}\nDIAG seen ${JSON.stringify(seen, null, 1)}`);
    console.log(`DIAG requests\n${asked.join("\n")}`);
    console.log(`DIAG page\n${(await page.locator("body").ariaSnapshot()).slice(0, 5000)}`);
    throw failure;
  }
  await page.keyboard.press("k");
  await expect(titleOf(page)).toHaveText(opened);

  // Escape: back to the list as it was, the keyboard on the row that was open.
  await page.keyboard.press("Escape");
  await expect(list).toBeVisible();
  await expect(sidebar).toBeVisible();
  await expect(article(page)).toHaveCount(0);
  await expect(rows(page).nth(1)).toBeFocused();

  // Enter opens it again; the back link goes back the same way.
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
  await page.goto(at(`/people/${blog.id}/about`));
  await appReady(page);
  await expect(page.getByRole("heading", { level: 2, name: blog.title })).toBeVisible();
  await expect(sidebar).toBeHidden();
  await expect(list).toBeHidden();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(list).toBeVisible();
  await expect(sidebar).toBeVisible();
  // Their settings too: alone in the window, and Escape goes back to their page, still alone.
  await page.goto(at(`/people/${blog.id}/settings`));
  await appReady(page);
  await expect(page.getByRole("heading", { level: 2, name: "Settings" })).toBeVisible();
  await expect(sidebar).toBeHidden();
  await expect(list).toBeHidden();
  await page.locator("body").focus();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(new RegExp(`/people/${blog.id}/about$`));
  await expect(page.getByRole("heading", { level: 2, name: blog.title })).toBeVisible();
  await expect(list).toBeHidden();

  // Switched off, the three panes are back as before: the reading area beside the list.
  await page.goto(at("/settings"));
  await appReady(page);
  await page.getByRole("switch", { name: SWITCH }).click();
  await expect(page.getByRole("switch", { name: SWITCH })).not.toBeChecked();
  await page.goto(at(`/people/${blog.id}`));
  await appReady(page);
  await rows(page).first().click();
  await expect(article(page)).toBeVisible();
  await expect(list).toBeVisible();
  await expect(sidebar).toBeVisible();
  await expect(page.getByRole("button", { name: `Back to ${blog.title}`, exact: true })).toHaveCount(0);
});

test("on a phone the trial changes nothing: the article is its own screen, as always", async ({ page, isMobile }) => {
  test.skip(!isMobile, "The trial is for a computer.");
  await switchOn(page);
  const blog = await openBlog(page, `one-thing-phone-${test.info().workerIndex}-${Date.now()}`);
  await rows(page).first().click();
  await expect(article(page)).toBeVisible();
  // The phone's own build: its top bar's back and its bottom toolbar, with Previous and Next.
  await expect(page.getByRole("button", { name: `Back to ${blog.title}`, exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Article actions" })).toBeVisible();
});

test("the switch is the owner's alone: another reader's Settings don't have it", async ({ browser }, testInfo) => {
  const stranger = await browser.newContext();
  const page = await stranger.newPage();
  await page.goto(at("/sign-up"));
  await appReady(page);
  await page.getByLabel("Email").fill(`one-thing-${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("slow mornings, long reads");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.locator("#sidebar")).toBeAttached();
  await page.goto(at("/settings"));
  await expect(page.getByText(/^Version /)).toBeVisible();
  await expect(page.getByRole("switch", { name: SWITCH })).toHaveCount(0);
  // Even with it kept on in this browser, nothing changes for them: an article opens beside the list.
  await page.evaluate(() => localStorage.setItem("nine-turtles.one-thing-at-a-time", "on"));
  if (!testInfo.project.name.startsWith("phone")) {
    await openBlog(page, `one-thing-stranger-${testInfo.workerIndex}-${Date.now()}`);
    await rows(page).first().click();
    await expect(article(page)).toBeVisible();
    await expect(page.locator("#list-pane")).toBeVisible();
    await expect(page.locator("#sidebar")).toBeVisible();
  }
  await stranger.close();
});
