import { expect, type Locator, type Page } from "@playwright/test";
import { TEST_PASSWORD } from "../playwright.config";
import { THEMES, type Theme } from "../src/lib/themes";

// Every screen of slowfeed. Each new screen is added here, so it is
// automatically checked for accessibility and photographed for the owner.
export type Screen = { name: string; path: string; signedIn: boolean; open?: (page: Page) => Promise<void> };

export const SCREENS: Screen[] = [
  { name: "sign-in", path: "/", signedIn: false },
  { name: "unread", path: "/unread", signedIn: true },
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
  await page.goto(screen.path);
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
