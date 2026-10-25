import { expect, test, type Locator, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP, TEST_PASSWORD } from "../playwright.config";
import { LOOKS, THEMES as THEME_NAMES, type Mode, type Theme } from "../src/lib/themes";

// Every screen of nine turtles. Each new screen is added here, so it is
// automatically checked for accessibility and photographed for the owner.
// `library` opens the screen on a nine turtles following the made-up library
// below (playwright.config.ts); without it, the screen is seen on a nine
// turtles with no feeds.
export type Screen = {
  name: string;
  path: string;
  signedIn: boolean;
  library?: boolean;
  open?: (page: Page) => Promise<void>;
};

export const SCREENS: Screen[] = [
  { name: "sign-in", path: "/", signedIn: false },
  { name: "first-visit", path: "/unread", signedIn: true },
  { name: "add-feed", path: "/add-feed", signedIn: true },
  {
    name: "articles",
    path: "/all",
    signedIn: true,
    library: true,
    open: async (page) => {
      await expect(page.getByRole("button", { name: "Show older items" })).toBeVisible();
    },
  },
  {
    name: "add-feed-choice",
    path: "/add-feed",
    signedIn: true,
    library: true,
    open: async (page) => {
      await page.getByLabel("Paste a website or feed URL").fill(`${FEED_SITE}/two/`);
      await page.keyboard.press("Enter");
      await expect(page.getByText("This site offers more than one feed. Choose one:")).toBeVisible();
    },
  },
  {
    name: "article",
    path: "/all",
    signedIn: true,
    library: true,
    open: async (page) => {
      // Unread again where the screenshots have a nine turtles to themselves,
      // so every picture of it starts the same.
      await openReadingRoom(page, { unread: libraryApp() !== FEEDS_APP });
      await page.keyboard.press("o");
      await expect(page.getByRole("heading", { level: 2, name: "The pleasure of a slow letter" })).toBeFocused();
      await expect(page.getByRole("img", { name: "A river drawn as three blue lines" })).toBeVisible();
    },
  },
  {
    // Read, unread, selected and starred rows together, and the line with Undo.
    name: "marks",
    path: "/all",
    signedIn: true,
    library: true,
    open: async (page) => {
      // The library's own copy where the screenshots have a nine turtles to
      // themselves; elsewhere a fresh one, as other tests may be marking it too.
      const copy = libraryApp() === FEEDS_APP ? `marks-${Date.now()}/` : "";
      const id = await follow(page, `${FEED_SITE}/shelf/the-margins/${copy}feed.xml`);
      await unmark(page, id);
      await page.goto(new URL(`/feeds/${id}`, page.url()).href);
      await appReady(page);
      await expect(page.getByRole("button", { name: /On reading the same book twice/ })).toBeVisible();
      await page.keyboard.press("j");
      await page.keyboard.press("s");
      await page.keyboard.press("j");
      await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
    },
  },
  {
    // A folder's list, with the folder open in the sidebar and a search typed.
    name: "folder",
    path: "/all",
    signedIn: true,
    library: true,
    open: async (page) => {
      const listed = await (await page.request.get(new URL("/api/feeds", page.url()).href)).json();
      const folder = listed.folders.find((each: { name: string }) => each.name === "Outdoors").id;
      // Opened in the sidebar, as if its button had been pressed.
      await page.evaluate((open) => localStorage.setItem("nine-turtles.open-folders", JSON.stringify([open])), folder);
      await page.goto(new URL(`/folders/${folder}`, page.url()).href);
      await appReady(page);
      await expect(page.getByRole("heading", { level: 2, name: "Outdoors" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Outdoors" }).getByRole("listitem").first()).toBeVisible();
    },
  },
  {
    name: "edit-feed",
    path: "/all",
    signedIn: true,
    library: true,
    open: async (page) => {
      const id = await follow(page, shelf("garden-letters"));
      await page.goto(new URL(`/feeds/${id}/edit`, page.url()).href);
      await appReady(page);
      await expect(page.getByRole("heading", { level: 2, name: "Edit feed" })).toBeVisible();
    },
  },
  {
    name: "search",
    path: "/all",
    signedIn: true,
    library: true,
    open: async (page) => {
      // On a phone the field waits behind the Search button beside More until asked for (decision 0060).
      await expect(page.getByRole("region", { name: "All" }).getByRole("listitem").first()).toBeVisible();
      await page.keyboard.press("/");
      await expect(page.locator("#search-field")).toBeFocused();
      await page.keyboard.type("reading is:");
      await expect(page.locator("#list-heading")).toHaveText("Search results");
      // A filter suggested as it's typed becomes a chip; the options panel shows it too.
      await expect(page.getByRole("option", { name: "is:unread" })).toBeVisible();
      await page.keyboard.type("unread ");
      await expect(page.getByRole("button", { name: "Remove Unread", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Search options" }).click();
      await expect(page.getByRole("checkbox", { name: "Unread", exact: true })).toBeChecked();
      await expect(page.getByRole("region", { name: "Search results" }).locator("mark").first()).toBeVisible();
    },
  },
  { name: "settings", path: "/settings", signedIn: true, library: true },
  {
    name: "feed-health-all-working",
    path: "/settings/feed-health",
    signedIn: true,
    open: async (page) => {
      await expect(page.getByText("All feeds are working.")).toBeVisible();
    },
  },
  {
    // Two broken feeds, one of each kind, as the server would describe them,
    // so the library the screenshots follow stays healthy.
    name: "feed-health",
    path: "/settings/feed-health",
    signedIn: true,
    library: true,
    open: async (page) => {
      const now = Math.floor(Date.now() / 1000);
      const day = 24 * 60 * 60;
      const feed = (id: number, title: string, state: string, problem: string, since: number) => ({
        id,
        title,
        url: `https://feeds.example/${id}.xml`,
        site_url: null,
        problem,
        failing_since: now - since * day,
        missing_since: problem === "not-found" ? now - since * day : null,
        fetched_at: now - since * day,
        next_check_at: now + day,
        failures: 9,
        state,
      });
      await page.route("**/api/health", (route) =>
        route.fulfill({
          json: {
            feeds: [
              feed(901, "The Old Almanac", "dead", "not-found", 12),
              feed(902, "Letters from the Coast", "trouble", "unreachable", 2),
            ],
          },
        }),
      );
      await page.reload();
      await appReady(page);
      await expect(page.getByRole("heading", { name: "Not working" })).toBeVisible();
    },
  },
  {
    // Settings › Rules with two rules, one paused, and the rule editor open over it. The
    // rules are as the server would send them, so the library the screenshots follow stays as it is.
    name: "rules",
    path: "/settings",
    signedIn: true,
    library: true,
    open: async (page) => {
      const rule = (id: number, words: string, author: string, action: string, paused: boolean) => ({
        id,
        words,
        title_only: true,
        author,
        feed_id: null,
        folder_id: null,
        place_gone: false,
        action,
        paused,
      });
      await page.route("**/api/rules", (route) =>
        route.request().method() === "GET"
          ? route.fulfill({
              json: { rules: [rule(901, "sponsored", "", "mute", false), rule(902, "", "Jane Doe", "star", true)], muted: 12 },
            })
          : route.continue(),
      );
      await page.reload();
      await appReady(page);
      await expect(page.getByText("Mute articles with “sponsored” in the title, in all feeds.")).toBeVisible();
      await page.getByRole("button", { name: "New rule…" }).click();
      await expect(page.getByRole("heading", { level: 2, name: "New rule" })).toBeVisible();
      await page.getByRole("textbox", { name: "Word or phrase" }).fill("giveaway");
    },
  },
  {
    // Muted articles, as the server would list them.
    name: "muted",
    path: "/settings/muted",
    signedIn: true,
    open: async (page) => {
      const day = 24 * 60 * 60;
      const now = Math.floor(Date.now() / 1000);
      const article = (id: number, title: string, feed: string, ago: number) => ({
        id,
        feed_id: 1,
        feed_title: feed,
        title,
        link: null,
        at: now - ago * day,
        read: true,
        starred: false,
        muted: true,
      });
      await page.route("**/api/muted", (route) =>
        route.fulfill({
          json: {
            articles: [
              article(901, "Sponsored: the notebook I carry everywhere", "Field Notes", 1),
              article(902, "A giveaway for readers", "Small Kitchen", 3),
            ],
            count: 2,
          },
        }),
      );
      await page.reload();
      await appReady(page);
      await expect(page.getByRole("heading", { name: "2 muted articles" })).toBeVisible();
    },
  },
  {
    name: "shortcuts",
    path: "/unread",
    signedIn: true,
    open: async (page) => {
      await page.keyboard.press("?");
      await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
    },
  },
];

/** A blog in the made-up library (tests/feed-server.mjs → SHELF), by its feed's address. */
const shelf = (blog: string) => `${FEED_SITE}/shelf/${blog}/feed.xml`;

/**
 * What the library screens follow: blogs a real reader might, two of them in
 * folders, so the pictures on a pull request look like nine turtles in use.
 */
const LIBRARY: { address: string; title: string; folder?: string }[] = [
  { address: shelf("field-notes"), title: "Field Notes", folder: "Outdoors" },
  { address: shelf("garden-letters"), title: "Garden Letters", folder: "Outdoors" },
  { address: shelf("low-tide"), title: "Low Tide", folder: "Outdoors" },
  { address: shelf("the-margins"), title: "The Margins" },
  { address: `${FEED_SITE}/reading.xml`, title: "Reading Room" },
  { address: shelf("slow-code"), title: "Slow Code" },
  { address: shelf("small-kitchen"), title: "Small Kitchen", folder: "Making" },
  { address: shelf("workbench"), title: "Workbench", folder: "Making" },
];

/**
 * The nine turtles that follows the library: the screenshots' own one when
 * they run (playwright.config.ts), otherwise the one the feed tests share.
 */
export function libraryApp(): string {
  return (test.info().project.metadata as { feedsApp?: string }).feedsApp ?? FEEDS_APP;
}

/** Follows the whole library, each blog in its folder. Doing it twice is fine. */
async function followLibrary(page: Page): Promise<void> {
  for (const { address, title, folder } of LIBRARY) {
    const id = await follow(page, address);
    if (!folder) continue;
    const saved = await page.request.post(new URL(`/api/feeds/${id}`, page.url()).href, {
      data: { title, folders: [], new_folder: folder },
    });
    expect(saved.ok()).toBe(true);
  }
}

/** Marks every article of a feed unread and unstarred again, so its screen starts the same each time. */
async function unmark(page: Page, feed: number): Promise<void> {
  const listed = await (await page.request.get(new URL(`/api/articles?feed=${feed}`, page.url()).href)).json();
  const ids = listed.articles.map((article: { id: number }) => article.id);
  for (const [mark, value] of [["read", false], ["starred", false]] as const) {
    const done = await page.request.post(new URL(`/api/articles/${mark}`, page.url()).href, { data: { ids, [mark]: value } });
    expect(done.ok()).toBe(true);
  }
}

/** One theme's day or night version, as "calm-dark" (decision 0046). */
export type Variant = `${Theme}-${Mode}`;

/** Every theme by day and by night: twelve versions, each checked and photographed. */
export const THEMES: Variant[] = THEME_NAMES.flatMap((theme) => (["light", "dark"] as const).map((mode) => `${theme}-${mode}` as const));

function parts(variant: Variant): [Theme, Mode] {
  const [theme, mode] = variant.split("-") as [Theme, Mode];
  return [theme, mode];
}

// Each version's reading background (themes.ts, checked against app.css), used to prove the theme took effect.
function background(variant: Variant): string {
  const [theme, mode] = parts(variant);
  const hex = LOOKS[theme][mode].page;
  return `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
}

/**
 * Follows a feed through nine turtles' own API, with the page's sign-in, so a
 * screen can start with feeds. Following one twice is fine.
 */
export async function follow(page: Page, address: string): Promise<number> {
  const response = await page.request.post(new URL("/api/feeds", page.url()).href, { data: { address } });
  expect([201, 409]).toContain(response.status());
  const body = await response.json();
  return Number(body.feed?.id ?? body.feed_id);
}

/** Follows Reading Room and opens its list, with nothing selected yet (and, if asked, nothing read). */
export async function openReadingRoom(page: Page, { unread = false } = {}): Promise<void> {
  const id = await follow(page, `${FEED_SITE}/reading/`);
  if (unread) await unmark(page, id);
  await page.goto(new URL(`/feeds/${id}`, page.url()).href);
  await appReady(page);
  await expect(page.getByRole("button", { name: /The pleasure of a slow letter/ })).toBeVisible();
}

/** Signs in through the sign-in page, the way the reader does. */
export async function signIn(page: Page): Promise<void> {
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("#sidebar")).toBeAttached();
}

/** Waits until nine turtles has decided which screen to show. */
export async function appReady(page: Page): Promise<void> {
  // Signed in, the sidebar is there on every width (a phone may show another screen first).
  await expect(page.getByLabel("Password").or(page.locator("#sidebar"))).toBeAttached();
}

/** Chooses a theme and its day or night version the way Settings saves them, before the page loads. */
export async function chooseTheme(page: Page, variant: Variant): Promise<void> {
  const [theme, appearance] = parts(variant);
  await page.addInitScript((chosen) => {
    localStorage.setItem("nine-turtles.preferences", JSON.stringify(chosen));
  }, { theme, appearance });
}

export async function openScreen(page: Page, screen: Screen, theme: Variant): Promise<void> {
  await chooseTheme(page, theme);
  await page.goto(screen.library ? new URL(screen.path, libraryApp()).href : screen.path);
  await appReady(page);
  if (screen.signedIn) await signIn(page);
  if (screen.library) {
    await followLibrary(page);
    await page.reload();
    await appReady(page);
  }
  await screen.open?.(page);
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe(background(theme));
}

/** "Mark all as read" sits in the list's More (…) menu, beside the list's title. */
export async function markAllFromMenu(page: Page): Promise<void> {
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("menuitem", { name: "Mark all as read" }).click();
}

/** Presses Tab until the keyboard's place reaches the element: the keyboard floor. */
export async function tabTo(page: Page, target: Locator, limit = 100): Promise<void> {
  for (let i = 0; i < limit; i++) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Tab never reached the element");
}
