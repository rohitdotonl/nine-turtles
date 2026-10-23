import { test } from "@playwright/test";
import { SCREENS, THEMES, openScreen } from "./screens";

// Photographs every screen in every theme so the owner can see each change.
// The pictures land in web/screenshots/ and GitHub Actions posts them on the
// pull request (see docs/decisions/0005-screenshots.md).
for (const screen of SCREENS) {
  for (const theme of THEMES) {
    test(`photograph ${screen.name} in ${theme}`, async ({ page }, testInfo) => {
      await openScreen(page, screen, theme);
      await page.screenshot({
        path: `screenshots/${screen.name}-${theme}-${testInfo.project.name}.png`,
        fullPage: true,
      });
    });
  }
}
