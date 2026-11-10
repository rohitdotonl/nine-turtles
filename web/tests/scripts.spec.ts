import { expect, test } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// SPEC section 24 (languages), "How to check it": an article in another script
// is marked with its language and set with that script's settings and reading
// face (decisions 0223, 0227).

test.skip(({ isMobile }) => isMobile, "the wide layout shows the article beside the list");

test("a Hindi article is marked Hindi, gets room between its lines and its own reading face", async ({ page }) => {
  const name = `script-${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/hindi/${name}/`);
  await page.goto(new URL(`/people/${id}`, FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("button", { name: /पुस्तकालय की एक शाम/ }).click();

  const article = page.locator("article.article");
  await expect(article).toHaveAttribute("lang", "hi");
  await expect(article).toHaveAttribute("data-script", "devanagari");
  const leading = await article.evaluate((element) => {
    const style = getComputedStyle(element);
    return parseFloat(style.lineHeight) / parseFloat(style.fontSize);
  });
  expect(leading).toBeCloseTo(1.8, 1);

  // The serif Devanagari is loaded for the Devanagari letters; the Arabic face,
  // with no Arabic letters on the page, is never downloaded.
  await expect
    .poll(() => page.evaluate(() => [...document.fonts].find((font) => font.family.includes("Noto Serif Devanagari"))?.status))
    .toBe("loaded");
  expect(await page.evaluate(() => [...document.fonts].find((font) => font.family.includes("Noto Naskh Arabic"))?.status)).toBe("unloaded");
});
