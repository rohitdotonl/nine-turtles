import { expect, test } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, choose, follow, openReadingRoom, signIn } from "./screens";

// Printing an article prints the article (decision 0236, SPEC section 7):
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
  // The names are set apart, so a right-to-left one keeps the line in order.
  await expect(credit).toHaveAttribute("data-credit", /^From \u2068Reading Room\u2069, by \u2068Asha Rao\u2069, .*[0-9]{4}\. The original: https?:\/\/\S+$/);
  expect(await credit.evaluate((element) => getComputedStyle(element, "::before").content)).toMatch(/^"From \u2068Reading Room/);
  // Nothing of the app's own: no sidebar, list, toolbar or Write back.
  await expect(page.getByRole("navigation", { name: "Sidebar" })).toBeHidden();
  await expect(page.getByRole("button", { name: /The pleasure of a slow letter/ })).toBeHidden();
  await expect(page.getByRole("link", { name: /^Write back/ })).toBeHidden();
  // Nor the View original links, at the top or at the end (decision 0263).
  for (const link of await page.getByRole("link", { name: /^View original/ }).all()) await expect(link).toBeHidden();
  for (const button of await page.getByRole("button").all()) {
    // Only the writer's name and the pictures that open larger (role "button"), which are the article's own.
    if (await button.isVisible()) expect(await button.getAttribute("class")).toMatch(/writer-link|openable/);
  }
  await expect(article.locator(".article-title")).toHaveCSS("color", "rgb(0, 0, 0)");
  await page.screenshot({ path: test.info().outputPath(`print-${isMobile ? "phone" : "desktop"}.png`), fullPage: true });
});

test("printed from Night, the article is black on white, and its highlights print with their words", async ({ page, isMobile }) => {
  test.skip(isMobile, "choosing words is the same menu on a phone");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/print-${test.info().workerIndex}-${Date.now()}/`);
  await page.goto(new URL(`/people/${id}`, FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("button", { name: /On keeping a commonplace book \(3\)/ }).click();
  const article = page.getByRole("region", { name: "Article", exact: true });
  await choose(page, "made-up summary");
  await page.getByRole("menu", { name: "Chosen words" }).getByRole("menuitem", { name: /Highlight/ }).click();
  await page.getByRole("menu", { name: "Highlight" }).getByRole("menuitem", { name: "Done" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");

  await page.emulateMedia({ media: "print", colorScheme: "dark" });
  await expect(article.locator(".article-title")).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(article.locator(".article-text")).toHaveCSS("color", "rgb(0, 0, 0)");
  // The highlight in the text keeps a dark line under its words, and its tone is the black ink's.
  const mark = article.locator("mark.highlight");
  await expect(mark).toHaveCSS("text-decoration-line", "underline");
  expect(await mark.evaluate((element) => getComputedStyle(element).backgroundColor)).toMatch(/^(rgba\(0, 0, 0|color\(srgb 0 0 0)/);
  // At the end, the highlight's words print; its Copy and Remove don't.
  const ends = article.getByRole("list", { name: "Your highlights" });
  await expect(ends.getByRole("button", { name: "made-up summary", exact: true })).toBeVisible();
  await expect(ends.getByRole("button", { name: /^Remove highlight/ })).toBeHidden();
  await expect(ends.getByRole("button", { name: /^Copy/ })).toBeHidden();
  await page.screenshot({ path: test.info().outputPath("print-night.png"), fullPage: true });
});
