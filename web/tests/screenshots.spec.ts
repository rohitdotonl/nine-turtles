import { test } from "@playwright/test";
import type { Theme } from "../src/lib/themes";
import { SCREENS, THEMES, openScreen } from "./screens";

// Photographs every screen on White and Night, the pages Match device shows
// by day and by night (and the main ones on Paper) so the owner can see each change.
// They run on a nine turtles of their own for each width, following only a
// made-up library of blogs (tests/screens.ts), so they look like the app in use.
// The pictures land in web/screenshots/ and GitHub Actions posts them on the
// pull request (see docs/decisions/0005-screenshots.md).
// Paper is photographed on the main screens, Settings and a
// sheet only, to keep the pull request's pictures to a size the owner can
// look through.
const EVERY_SCREEN: Theme[] = ["white", "night"];
const MAIN_SCREENS = ["articles", "article", "settings", "who-page"];

for (const screen of SCREENS) {
  for (const theme of THEMES) {
    if (!EVERY_SCREEN.includes(theme) && !MAIN_SCREENS.includes(screen.name)) continue;
    test(`photograph ${screen.name} in ${theme}`, async ({ page }, testInfo) => {
      await openScreen(page, screen, theme);
      await page.screenshot({
        path: `screenshots/${screen.name}-${theme}-${testInfo.project.metadata.device}.png`,
        fullPage: true,
      });
    });
  }
}
