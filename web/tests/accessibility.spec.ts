import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { SCREENS, THEMES, appReady, openScreen } from "./screens";

// The first design floor: every screen, in every theme, passes the automatic
// WCAG checks (including color contrast) at desktop and phone width.
for (const screen of SCREENS) {
  for (const theme of THEMES) {
    test(`${screen.name} in ${theme} passes the accessibility checks`, async ({ page }) => {
      await openScreen(page, screen, theme);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
}

// The default: no theme chosen, so the device's light/dark setting decides.
// These colors are written separately in app.css, so they're checked too.
for (const colorScheme of ["light", "dark"] as const) {
  test(`following the device's ${colorScheme} setting passes the accessibility checks`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/");
    await appReady(page);
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(background).toBe(colorScheme === "dark" ? "rgb(28, 27, 25)" : "rgb(248, 246, 241)");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test("the wordmark is set in Literata, served by slowfeed", async ({ page }) => {
  const fontRequests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "font") fontRequests.push(new URL(request.url()).origin);
  });
  await page.goto("/");
  await appReady(page);
  await page.evaluate(() => document.fonts.ready);

  const wordmark = page.getByRole("heading", { level: 1 });
  await expect(wordmark).toHaveText("slowfeed");
  // The wordmark's style asks for Literata first…
  const family = await wordmark.evaluate((element) => getComputedStyle(element).fontFamily);
  expect(family.split(",")[0]?.replaceAll('"', "").trim()).toBe("Literata");
  // …and the browser really loaded a Literata font file to draw it.
  const loaded = await page.evaluate(() =>
    [...document.fonts].some((face) => face.family.replaceAll('"', "") === "Literata" && face.status === "loaded"),
  );
  expect(loaded).toBe(true);
  // Every font came from slowfeed itself, never a third-party font service.
  expect(new Set(fontRequests)).toEqual(new Set([new URL(page.url()).origin]));
});
