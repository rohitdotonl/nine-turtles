import { expect, type Page } from "@playwright/test";
import { THEMES, type Theme } from "../src/lib/themes";

// Every screen of slowfeed. Each new screen is added here, so it is
// automatically checked for accessibility and photographed for the owner.
export const SCREENS: { name: string; path: string }[] = [{ name: "placeholder", path: "/" }];

export { THEMES };

// Background colors from DESIGN.md → "Color", used to prove the theme took effect.
const BACKGROUNDS: Record<Theme, string> = {
  "off-white": "rgb(248, 246, 241)",
  sepia: "rgb(243, 233, 210)",
  dark: "rgb(28, 27, 25)",
};

export async function openScreen(page: Page, path: string, theme: Theme): Promise<void> {
  await page.goto(path);
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
