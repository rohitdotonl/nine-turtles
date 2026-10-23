import { expect, type Page } from "@playwright/test";
import { TEST_PASSWORD } from "../playwright.config";
import { THEMES, type Theme } from "../src/lib/themes";

// Every screen of slowfeed. Each new screen is added here, so it is
// automatically checked for accessibility and photographed for the owner.
export const SCREENS: { name: string; path: string; signedIn: boolean }[] = [
  { name: "sign-in", path: "/", signedIn: false },
  { name: "home", path: "/", signedIn: true },
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
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

/** Waits until slowfeed has decided which screen to show. */
export async function appReady(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { level: 1, name: "slowfeed" })).toBeVisible();
}

export async function openScreen(
  page: Page,
  screen: { path: string; signedIn: boolean },
  theme: Theme,
): Promise<void> {
  await page.goto(screen.path);
  await appReady(page);
  if (screen.signedIn) await signIn(page);
  // Until the Settings screen exists (Milestone 4), the theme is chosen the way
  // Settings will: by setting <html data-theme="…">.
  await page.evaluate((chosen) => {
    document.documentElement.dataset.theme = chosen;
  }, theme);
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe(BACKGROUNDS[theme]);
}
