import { test } from "@playwright/test";
import { FIRST_THEMES } from "../src/lib/themes";
import { SCREENS, THEMES, openScreen } from "./screens";

// Photographs every screen in the first three themes (and the main ones in the rest) so the owner can see each change.
// The pictures land in web/screenshots/ and GitHub Actions posts them on the
// pull request (see docs/decisions/0005-screenshots.md).
// The themes being tried out are photographed on the main screens, Settings
// and a sheet only, to keep the pull request's pictures to a size the owner
// can look through.
const TRIAL_SCREENS = ["articles", "article", "settings", "edit-feed"];

for (const screen of SCREENS) {
  for (const theme of THEMES) {
    if (!FIRST_THEMES.includes(theme) && !TRIAL_SCREENS.includes(screen.name)) continue;
    test(`photograph ${screen.name} in ${theme}`, async ({ page }, testInfo) => {
      await openScreen(page, screen, theme);
      await page.screenshot({
        path: `screenshots/${screen.name}-${theme}-${testInfo.project.name}.png`,
        fullPage: true,
      });
    });
  }
}
