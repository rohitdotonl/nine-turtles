import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { SCREENS, THEMES, openScreen } from "./screens";

// The first design floor: every screen, in every theme, passes the automatic
// WCAG checks (including color contrast) at desktop and phone width.
for (const screen of SCREENS) {
  for (const theme of THEMES) {
    test(`${screen.name} in ${theme} passes the accessibility checks`, async ({ page }) => {
      await openScreen(page, screen.path, theme);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
}

test("the theme follows the device's dark setting when none is chosen", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe("rgb(28, 27, 25)");
});

test("the wordmark is set in Literata, served by slowfeed", async ({ page }) => {
  const fontRequests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "font") fontRequests.push(new URL(request.url()).origin);
  });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);

  const loaded = await page.evaluate(() => document.fonts.check('48px "Literata"', "slowfeed"));
  expect(loaded).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("slowfeed");
  expect(new Set(fontRequests)).toEqual(new Set([new URL(page.url()).origin]));
});
