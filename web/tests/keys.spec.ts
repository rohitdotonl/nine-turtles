import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, openReadingRoom, signIn, tabTo } from "./screens";

// Keys of the reader's own (decision 0110, SPEC section 19), done with the
// keyboard alone, and the keys that came with it: Home and End, Shift+J and
// Shift+K, g then f and g then ,. Every test uses the one owner's account,
// so this page's settings are answered here and never saved: one test's
// keys can't change another's.

const article = (page: Page) => page.getByRole("region", { name: "Article" });
const sheet = (page: Page) => page.getByRole("dialog", { name: /Keyboard shortcuts|Change keys/ });
const shortcutList = (page: Page) => sheet(page).getByRole("region", { name: "Shortcuts" });
const said = (page: Page) => page.getByTestId("keys-said");
const binding = (page: Page, id: string) => sheet(page).locator(`[data-binding="${id}"]`);

/** Answers this page's settings itself, keeping the keys it's sent; returns what was last saved. */
async function keepSettingsHere(page: Page): Promise<{ keys: Record<string, string> }> {
  const saved = { keys: {} as Record<string, string> };
  await page.route("**/api/settings", (route) => {
    if (route.request().method() === "POST") {
      const body = JSON.parse(route.request().postData() ?? "{}") as { keys?: Record<string, string> };
      if (body.keys) saved.keys = body.keys;
    }
    return route.fulfill({ json: { sort: "newest", mode: "inbox", counts: "shown", let_go: "never", keys: saved.keys } });
  });
  return saved;
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
  await page.goto(new URL(`/feeds/${id}`, FEEDS_APP).href);
  await appReady(page);
  await expect(page.getByRole("button", { name: new RegExp(`Blog ${name}`) }).first()).toBeVisible();
  return id;
}

function row(page: Page, number: number) {
  return page.getByRole("button", { name: new RegExp(`\\(${number}\\)`) });
}

/** Opens the shortcut list with ?, and Change keys… at its foot, by keyboard alone. */
async function changeKeys(page: Page) {
  await page.keyboard.press("?");
  await expect(sheet(page)).toBeVisible();
  await tabTo(page, sheet(page).getByRole("button", { name: "Change keys…" }));
  await page.keyboard.press("Enter");
  await expect(sheet(page).getByRole("heading", { name: "Change keys" })).toBeVisible();
}

test.describe("on a wide window", () => {
  test.skip(({ isMobile }) => isMobile, "keys are for a keyboard");

  test("star moves to x with the keyboard alone, and x stars everywhere the key shows", async ({ page }) => {
    const saved = await keepSettingsHere(page);
    await signedIn(page);
    await openBlog(page);
    await page.keyboard.press("j");

    await changeKeys(page);
    // The keyboard is on the first key that can change.
    await expect(binding(page, "next-article")).toBeFocused();
    await tabTo(page, binding(page, "star"));
    await expect(binding(page, "star")).toHaveAccessibleName("Change the key that stars and unstars, now S");
    await page.keyboard.press("Enter");
    await expect(binding(page, "star")).toHaveText("Press the new key…");
    await expect(said(page)).toHaveText("Press the new key that stars and unstars. Escape cancels.");
    // Shift alone keeps it waiting; a key that can't be used says why, and it still waits.
    await page.keyboard.press("Shift");
    await page.keyboard.press("Enter");
    await expect(shortcutList(page).getByText(/^Enter presses buttons and opens articles/)).toBeVisible();
    await page.keyboard.press("x");
    await expect(said(page)).toHaveText("X now stars and unstars.");
    await expect(binding(page, "star")).toHaveAccessibleName("Change the key that stars and unstars, now X");
    await expect(binding(page, "star")).toBeFocused();
    await expect(sheet(page).getByRole("button", { name: "Reset the key that stars and unstars to S" })).toBeVisible();
    expect(saved.keys).toEqual({ star: "x" });

    await tabTo(page, sheet(page).getByRole("button", { name: "Done" }));
    await page.keyboard.press("Enter");
    await expect(sheet(page).getByRole("heading", { name: "Keyboard shortcuts" })).toBeVisible();
    await expect(sheet(page).getByRole("button", { name: "Change keys…" })).toBeFocused();
    // The list shows X now.
    await expect(sheet(page).getByRole("row", { name: /Star \/ unstar/ })).toContainText("X");
    await page.keyboard.press("Escape");
    await expect(sheet(page)).toBeHidden();

    const star = article(page).getByRole("button", { name: "Star" });
    await expect(star).toHaveAttribute("aria-pressed", "false");
    await expect(star).toHaveAttribute("title", "Star (X)");
    // s does nothing now; x stars.
    await page.keyboard.press("s");
    await expect(star).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("x");
    await expect(star).toHaveAttribute("aria-pressed", "true");
    await expect(star).toHaveAttribute("title", "Starred (X)");
    await page.keyboard.press("x");
    await expect(star).toHaveAttribute("aria-pressed", "false");

    // After a reload the keys are still the reader's.
    await page.reload();
    await appReady(page);
    await page.keyboard.press("?");
    await expect(sheet(page).getByRole("row", { name: /Star \/ unstar/ })).toContainText("X");
  });

  test("a key another shortcut has is asked about first, and the other is left with no key; Reset all puts every key back", async ({ page }) => {
    const saved = await keepSettingsHere(page);
    await signedIn(page);
    await openBlog(page);
    await changeKeys(page);

    await tabTo(page, binding(page, "star"));
    await page.keyboard.press("Enter");
    await page.keyboard.press("Shift+O");
    const question = shortcutList(page).getByText("Shift+O already marks older as read. Use it here instead?");
    await expect(question).toBeVisible();
    await expect(said(page)).toHaveText("Shift+O already marks older as read. Use it here instead?");
    await expect(sheet(page).getByRole("button", { name: "Use it" })).toBeFocused();
    // Escape answers the question, never closes the list.
    await page.keyboard.press("Escape");
    await expect(question).toBeHidden();
    await expect(sheet(page)).toBeVisible();
    await expect(said(page)).toHaveText("Not changed.");
    await expect(binding(page, "star")).toBeFocused();
    expect(saved.keys).toEqual({});

    await page.keyboard.press("Enter");
    await page.keyboard.press("Shift+O");
    await page.keyboard.press("Enter");
    await expect(said(page)).toHaveText("Shift+O now stars and unstars. Nothing marks older as read now.");
    await expect(binding(page, "mark-older-read")).toHaveText("No key");
    await expect(binding(page, "star")).toBeFocused();
    expect(saved.keys).toEqual({ star: "Shift+O", "mark-older-read": "" });

    // Reset all keys, at the sheet's foot.
    await tabTo(page, sheet(page).getByRole("button", { name: "Reset all keys" }));
    await page.keyboard.press("Enter");
    await expect(said(page)).toHaveText("Every key is back as it was.");
    await expect(binding(page, "star")).toHaveAccessibleName("Change the key that stars and unstars, now S");
    await expect(binding(page, "mark-older-read")).toHaveAccessibleName("Change the key that marks older as read, now Shift+O");
    expect(saved.keys).toEqual({});

    // Keys that stay as they are aren't buttons at all.
    await expect(binding(page, "cheat-sheet")).toHaveCount(0);
    await expect(binding(page, "go-unread")).toHaveCount(0);
    // Settings › Keyboard opens the same list, ready to change keys.
    await page.keyboard.press("Escape");
    await page.goto(new URL("/settings", FEEDS_APP).href);
    await appReady(page);
    await page.getByRole("button", { name: "Change keys…" }).click();
    await expect(sheet(page).getByRole("heading", { name: "Change keys" })).toBeVisible();
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
    await expect(page.getByRole("navigation", { name: "Sidebar" }).locator(`a[href="/feeds/${blog}"]`)).toBeVisible();
    await page.keyboard.press("Shift+J");
    await expect(page).toHaveURL(/\/feeds\/\d+$/);
    const first = page.url();
    await page.keyboard.press("Shift+J");
    await expect(page).not.toHaveURL(first);
    await expect(page).toHaveURL(/\/feeds\/\d+$/);
    await page.keyboard.press("Shift+K");
    await expect(page).toHaveURL(first);

    await page.keyboard.press("g");
    await page.keyboard.press("f");
    await expect(page).toHaveURL(/\/settings\/feeds$/);
    await page.keyboard.press("g");
    await page.keyboard.press(",");
    await expect(page).toHaveURL(/\/settings$/);
  });

  test("a key of your own works without a connection, from this device's copy; signing out forgets it", async ({ page, context }) => {
    const saved = await keepSettingsHere(page);
    saved.keys = { star: "x" };
    await signedIn(page);
    await openBlog(page);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("nine-turtles.keys"))).toBe(JSON.stringify({ star: "x" }));
    await page.keyboard.press("j");
    const star = article(page).getByRole("button", { name: "Star" });
    await expect(star).toHaveAttribute("title", "Star (X)");

    await context.setOffline(true);
    await page.keyboard.press("x");
    await expect(star).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("s");
    await expect(star).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("x");
    await expect(star).toHaveAttribute("aria-pressed", "false");
    await context.setOffline(false);
    await page.evaluate(() => dispatchEvent(new Event("online")));

    // Signing out: the next reader on this browser starts from nine turtles' own keys.
    await page.goto(new URL("/settings", FEEDS_APP).href);
    await appReady(page);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("nine-turtles.keys"))).toBeNull();
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
