import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, choose, follow, signIn } from "./screens";

// SPEC section 36, their page (decision 0207): after Write to and your note on
// them, Lately (their three newest pieces, each one press from reading) and
// Your highlights from their writing, then Source. Uses a blog of its own,
// since every test shares the one nine turtles that has feeds.

const pane = (page: Page) => page.getByRole("region", { name: "Article", exact: true });
const about = (page: Page, name: string) => page.getByRole("region", { name: `About ${name}` });

test("their page shows Lately and the words you highlighted in their writing, each one press from reading", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same page on a phone, a screen of its own");
  const name = `their-${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);
  await page.goto(new URL(`/people/${id}`, FEEDS_APP).href);
  await appReady(page);

  // Highlight words in their newest article.
  await page.locator(".item-row").first().click();
  const title = (await pane(page).locator("h2.article-title").innerText()).trim();
  await choose(page, "made-up summary");
  await page.getByRole("menu", { name: "Chosen words" }).getByRole("menuitem", { name: /Highlight/ }).click();
  await page.getByRole("menu", { name: "Highlight" }).getByRole("menuitem", { name: "Done" }).click();

  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  const who = about(page, `Blog ${name}`);
  const lately = who.getByRole("region", { name: "Lately" });
  await expect(lately.getByRole("listitem")).toHaveCount(3);
  await expect(lately.getByRole("button").first()).toContainText(title);
  const highlights = who.getByRole("region", { name: "Your highlights" });
  await expect(highlights.getByRole("listitem")).toHaveCount(1);
  await expect(highlights).toContainText("made-up summary");
  await expect(highlights.getByRole("button", { name: title })).toBeVisible();

  // In order: Write to, Lately, Your highlights, then Source.
  const text = await who.innerText();
  const at = (words: string) => text.search(new RegExp(words, "i"));
  expect(at(`Write to Blog ${name}`)).toBeLessThan(at("Lately"));
  expect(at("Lately")).toBeLessThan(at("Your highlights"));
  expect(at("Your highlights")).toBeLessThan(at("^Source$|\\nSource\\n"));

  // The title in Your highlights opens the article.
  await highlights.getByRole("button", { name: title }).click();
  await expect(pane(page).getByRole("heading", { level: 2, name: title })).toBeVisible();

  // And a piece in Lately opens it too.
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  const second = lately.getByRole("button").nth(1);
  const secondTitle = (await second.locator(".title").innerText()).trim();
  await second.click();
  await expect(pane(page).getByRole("heading", { level: 2, name: secondTitle })).toBeVisible();
});
