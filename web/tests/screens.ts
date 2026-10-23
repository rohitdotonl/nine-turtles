import { expect, type Locator, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP, TEST_PASSWORD } from "../playwright.config";
import { THEMES, type Theme } from "../src/lib/themes";

// Every screen of slowfeed. Each new screen is added here, so it is
// automatically checked for accessibility and photographed for the owner.
// `base` picks the slowfeed that has feeds (playwright.config.ts); without
// it, the screen is seen on a slowfeed with none.
export type Screen = {
  name: string;
  path: string;
  signedIn: boolean;
  base?: string;
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
    base: FEEDS_APP,
    open: async (page) => {
      await follow(page, `${FEED_SITE}/`);
      await follow(page, `${FEED_SITE}/garden/`);
      await page.reload();
      await appReady(page);
      await expect(page.getByRole("button", { name: "Show older items" })).toBeVisible();
    },
  },
  {
    name: "add-feed-choice",
    path: "/add-feed",
    signedIn: true,
    base: FEEDS_APP,
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
    base: FEEDS_APP,
    open: async (page) => {
      await openReadingRoom(page);
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
    base: FEEDS_APP,
    open: async (page) => {
      const id = await follow(page, `${FEED_SITE}/blog/screen-marks-${Date.now()}/`);
      await page.goto(new URL(`/feeds/${id}`, page.url()).href);
      await appReady(page);
      await expect(page.getByRole("button", { name: /A year of reading slowly/ })).toBeVisible();
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
    base: FEEDS_APP,
    open: async (page) => {
      const id = await follow(page, `${FEED_SITE}/garden/`);
      await follow(page, `${FEED_SITE}/`);
      await page.request.post(new URL(`/api/feeds/${id}`, page.url()).href, {
        data: { title: "Garden Letters", folders: [], new_folder: "Outdoors" },
      });
      const listed = await (await page.request.get(new URL("/api/feeds", page.url()).href)).json();
      const folder = listed.folders.find((each: { name: string }) => each.name === "Outdoors").id;
      // Opened in the sidebar, as if its button had been pressed.
      await page.evaluate((open) => localStorage.setItem("slowfeed.open-folders", JSON.stringify([open])), folder);
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
    base: FEEDS_APP,
    open: async (page) => {
      const id = await follow(page, `${FEED_SITE}/garden/`);
      await page.goto(new URL(`/feeds/${id}/edit`, page.url()).href);
      await appReady(page);
      await expect(page.getByRole("heading", { level: 2, name: "Edit feed" })).toBeVisible();
    },
  },
  { name: "settings", path: "/settings", signedIn: true },
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

export { THEMES };

// Background colors from DESIGN.md → "Color", used to prove the theme took effect.
const BACKGROUNDS: Record<Theme, string> = {
  "off-white": "rgb(248, 246, 241)",
  sepia: "rgb(243, 233, 210)",
  dark: "rgb(28, 27, 25)",
};

/**
 * Follows a feed through slowfeed's own API, with the page's sign-in, so a
 * screen can start with feeds. Following one twice is fine.
 */
export async function follow(page: Page, address: string): Promise<number> {
  const response = await page.request.post(new URL("/api/feeds", page.url()).href, { data: { address } });
  expect([201, 409]).toContain(response.status());
  const body = await response.json();
  return Number(body.feed?.id ?? body.feed_id);
}

/** Follows Reading Room and opens its list, with nothing selected yet. */
export async function openReadingRoom(page: Page): Promise<void> {
  const id = await follow(page, `${FEED_SITE}/reading/`);
  await page.goto(new URL(`/feeds/${id}`, page.url()).href);
  await appReady(page);
  await expect(page.getByRole("button", { name: /The pleasure of a slow letter/ })).toBeVisible();
}

/** Signs in through the sign-in page, the way the reader does. */
export async function signIn(page: Page): Promise<void> {
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Sidebar" })).toBeVisible();
}

/** Waits until slowfeed has decided which screen to show. */
export async function appReady(page: Page): Promise<void> {
  await expect(page.getByLabel("Password").or(page.getByRole("button", { name: "Sidebar" }))).toBeVisible();
}

/** Chooses a theme the way Settings saves it, before the page loads. */
export async function chooseTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript((chosen) => {
    localStorage.setItem("slowfeed.preferences", JSON.stringify({ theme: chosen }));
  }, theme);
}

export async function openScreen(page: Page, screen: Screen, theme: Theme): Promise<void> {
  await chooseTheme(page, theme);
  await page.goto(screen.base ? new URL(screen.path, screen.base).href : screen.path);
  await appReady(page);
  if (screen.signedIn) await signIn(page);
  await screen.open?.(page);
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe(BACKGROUNDS[theme]);
}

/** Presses Tab until the keyboard's place reaches the element: the keyboard floor. */
export async function tabTo(page: Page, target: Locator, limit = 50): Promise<void> {
  for (let i = 0; i < limit; i++) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Tab never reached the element");
}
