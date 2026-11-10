import { expect, test } from "@playwright/test";
import { FEEDS_APP } from "../playwright.config";
import { appReady, openReadingRoom, signIn } from "./screens";

// Printing an article prints the article (decision 0235, SPEC section 7):
// its title, byline and words, and a credit line with the original's
// address; nothing of the app's own.

test("Print prints the open article alone, with where it came from", async ({ page, isMobile }) => {
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await openReadingRoom(page);
  await page.getByRole("button", { name: /The pleasure of a slow letter/ }).click();
  const article = page.getByRole("region", { name: "Article", exact: true });
  await expect(article.getByRole("heading", { level: 2, name: "The pleasure of a slow letter" })).toBeVisible();
  // On screen, no credit line: the byline and View original say it.
  const credit = article.locator(".print-credit");
  await expect(credit).toBeHidden();

  await page.emulateMedia({ media: "print" });
  await expect(article.getByRole("heading", { level: 2, name: "The pleasure of a slow letter" })).toBeVisible();
  await expect(credit).toBeVisible();
  await expect(credit).toHaveAttribute("data-credit", /^From Reading Room, by Asha Rao, .*[0-9]{4}\. The original: https?:\/\/\S+$/);
  expect(await credit.evaluate((element) => getComputedStyle(element, "::before").content)).toMatch(/^"From Reading Room/);
  // Nothing of the app's own: no sidebar, list, toolbar or Write back.
  await expect(page.getByRole("navigation", { name: "Sidebar" })).toBeHidden();
  await expect(page.getByRole("button", { name: /The pleasure of a slow letter/ })).toBeHidden();
  await expect(page.getByRole("link", { name: /^Write back/ })).toBeHidden();
  for (const button of await page.getByRole("button").all()) {
    // Only the writer's name and the pictures, which are the article's own.
    if (await button.isVisible()) expect(await button.getAttribute("class")).toMatch(/writer-link|openable/);
  }
  // Black on white, whatever the theme.
  await expect(article.locator(".article-title")).toHaveCSS("color", "rgb(0, 0, 0)");
  await page.screenshot({ path: test.info().outputPath(`print-${isMobile ? "phone" : "desktop"}.png`), fullPage: true });
});
