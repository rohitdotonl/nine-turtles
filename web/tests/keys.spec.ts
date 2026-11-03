import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, openReadingRoom, signIn, tabTo } from "./screens";

// The `?` list's foot (SPEC section 19), done with the keyboard alone, and
// the keys Home and End, Shift+J and Shift+K, g then f and g then ,. Every
// test uses the one owner's account, so the settings that say a reader once
// had keys of their own are answered here and never saved.

const article = (page: Page) => page.getByRole("region", { name: "Article" });
const sheet = (page: Page) => page.getByRole("dialog", { name: "Keyboard shortcuts" });

/** Answers this page's settings itself, as for a reader who had keys of their own; counts the "seen" it's sent. */
async function keysWereChanged(page: Page): Promise<{ seen: number }> {
  const told = { seen: 0 };
  await page.route("**/api/settings", (route) => {
    if (route.request().method() === "POST") {
      const body = JSON.parse(route.request().postData() ?? "{}") as { keys_seen?: boolean };
      if (body.keys_seen) told.seen++;
    }
    return route.fulfill({ json: { sort: "newest", mode: "inbox", let_go: "never", keys_reset: told.seen === 0, hidden: [] } });
  });
  return told;
}

async function signedIn(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
}

/** Follows a new blog of this test's own, three articles, and opens its list. */
async function openBlog(page: Page): Promise<number> {
  const name = `rekey-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const id = await follow(page, `${FEED_SITE}/blog/${name}/`);
  await page.goto(new URL(`/people/${id}`, FEEDS_APP).href);
  await appReady(page);
  await expect(page.getByRole("listitem").getByRole("button", { name: new RegExp(`Blog ${name}`) }).first()).toBeVisible();
  return id;
}

function row(page: Page, number: number) {
  return page.getByRole("button", { name: new RegExp(`\\(${number}\\)`) });
}

test.describe("on a wide window", () => {
  test.skip(({ isMobile }) => isMobile, "keys are for a keyboard");

  test("the list's foot links to Help's keys page, by the keyboard alone, and has no way to change keys", async ({ page }) => {
    // SPEC sections 19 and 40 (decision 0157).
    await signedIn(page);
    await page.keyboard.press("?");
    await expect(sheet(page)).toBeVisible();
    const help = sheet(page).getByRole("link", { name: "Help with keys (on the nine turtles website)" });
    await expect(help).toHaveAttribute("href", "https://nineturtles.app/help/every-keyboard-key/");
    await expect(help).toHaveAttribute("target", "_blank");
    expect((await help.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await tabTo(page, help);
    await expect(help).toBeFocused();
    await expect(sheet(page).getByRole("button", { name: /Change keys/ })).toHaveCount(0);
    await expect(sheet(page).getByTestId("keys-reset")).toHaveCount(0);
  });

  test("a reader who had keys of their own is told once, at the list's foot, that they're back to these", async ({ page }) => {
    const told = await keysWereChanged(page);
    await signedIn(page);
    await page.keyboard.press("?");
    await expect(sheet(page).getByTestId("keys-reset")).toHaveText("You can't choose your own keys any more, so every shortcut is back to the key shown here. If you miss it, write to hello@nineturtles.app.");
    await expect.poll(() => told.seen).toBe(1);
    await page.keyboard.press("Escape");
    await expect(sheet(page)).toBeHidden();
    await page.keyboard.press("?");
    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page).getByTestId("keys-reset")).toHaveCount(0);
    // Nor on coming back.
    await page.keyboard.press("Escape");
    await page.reload();
    await appReady(page);
    await page.keyboard.press("?");
    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page).getByTestId("keys-reset")).toHaveCount(0);
  });

  test("Home and End choose the first and last article; Shift+J and Shift+K move between feeds; g then f and g then , go to Your feeds and Settings", async ({ page }) => {
    await signedIn(page);
    const blog = await openBlog(page);
    await page.keyboard.press("End");
    await expect(row(page, 1)).toHaveAttribute("aria-current", "true");
    await page.keyboard.press("Home");
    await expect(row(page, 3)).toHaveAttribute("aria-current", "true");

    // From All, Shift+J goes to the first feed in the sidebar, again to the next, and Shift+K back.
    await page.goto(new URL("/all", FEEDS_APP).href);
    await appReady(page);
    // Once the sidebar has the feeds (the blog, in no folder, among them).
    await expect(page.getByRole("navigation", { name: "Sidebar" }).locator(`a[href="/people/${blog}"]`)).toBeVisible();
    await page.keyboard.press("Shift+J");
    await expect(page).toHaveURL(/\/people\/\d+$/);
    const first = page.url();
    await page.keyboard.press("Shift+J");
    await expect(page).not.toHaveURL(first);
    await expect(page).toHaveURL(/\/people\/\d+$/);
    await page.keyboard.press("Shift+K");
    await expect(page).toHaveURL(first);

    await page.keyboard.press("g");
    await page.keyboard.press("f");
    await expect(page).toHaveURL(/\/settings\/feeds$/);
    await page.keyboard.press("g");
    await page.keyboard.press(",");
    await expect(page).toHaveURL(/\/settings$/);
  });

  test("Home and End keep their usual job in the open article and on a page that isn't a list", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 420 });
    await page.goto(new URL("/all", FEEDS_APP).href);
    await appReady(page);
    await signIn(page);
    await openReadingRoom(page);
    // Whether nine turtles took the last key for itself.
    const watch = () => page.evaluate(() => addEventListener("keydown", (event) => ((window as unknown as { taken: boolean }).taken = event.defaultPrevented)));
    await watch();
    const taken = () => page.evaluate(() => (window as unknown as { taken: boolean }).taken);

    // In the open article, End scrolls to its end and Home back to its top; the same article stays chosen.
    await page.getByRole("button", { name: /The pleasure of a slow letter/ }).click();
    await page.keyboard.press("Enter");
    const scroller = article(page).locator(".reading-scroller");
    await expect(article(page).getByRole("heading", { level: 2, name: "The pleasure of a slow letter" })).toBeFocused();
    // End only after the article has its full height: its picture loads
    // lazily, and until then there may be nothing below to scroll to.
    await expect(article(page).locator('img[alt="A river drawn as three blue lines"]')).toBeVisible();
    await expect.poll(() => scroller.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    await page.keyboard.press("End");
    expect(await taken()).toBe(false);
    await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect(article(page).locator(".article-title")).toHaveText("The pleasure of a slow letter");
    await expect(page.getByRole("button", { name: /The pleasure of a slow letter/ })).toHaveAttribute("aria-current", "true");
    await page.keyboard.press("Home");
    expect(await taken()).toBe(false);
    await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBe(0);

    // On Settings, a page and not a list, they're the browser's.
    await page.goto(new URL("/settings", FEEDS_APP).href);
    await appReady(page);
    await watch();
    await page.keyboard.press("End");
    expect(await taken()).toBe(false);
    await expect(page).toHaveURL(/\/settings$/);
    await page.keyboard.press("Home");
    expect(await taken()).toBe(false);
  });
});
