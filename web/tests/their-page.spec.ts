import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, choose, follow, signIn, tabTo } from "./screens";

// SPEC section 36, their page (decisions 0211, 0215 and 0254): one page, no
// Edit mode. Their name and where they publish, Write to (the one solid
// button), your note and Your highlights from their writing, each one press
// from reading, then their settings, each changing as it's touched; no
// Lately, as their list already shows their newest.
// Uses a blog of its own, since every test shares the one nine turtles that has feeds.

const pane = (page: Page) => page.getByRole("region", { name: "Article", exact: true });
const about = (page: Page, name: string) => page.getByRole("region", { name: `About ${name}` });

test("their page shows the words you highlighted in their writing, each one press from reading, and no Lately", async ({ page, isMobile }) => {
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
  await expect(who.getByRole("region", { name: "Lately" })).toHaveCount(0);
  // No Edit mode, and Write to is the one solid button.
  await expect(who.getByRole("button", { name: /^Edit Blog/ })).toHaveCount(0);
  await expect(who.locator(".btn-primary")).toHaveCount(1);
  const highlights = who.getByRole("region", { name: "Your highlights" });
  await expect(highlights.getByRole("listitem")).toHaveCount(1);
  await expect(highlights).toContainText("made-up summary");
  await expect(highlights.getByRole("button", { name: title })).toBeVisible();

  // In order: Write to, Your highlights, then Settings.
  const text = await who.innerText();
  const at = (words: string) => text.search(new RegExp(words, "i"));
  expect(at(`Write to Blog ${name}`)).toBeLessThan(at("Your highlights"));
  expect(at("Your highlights")).toBeLessThan(at("\\nSettings\\n"));

  // The title in Your highlights opens the article.
  await highlights.getByRole("button", { name: title }).click();
  await expect(pane(page).getByRole("heading", { level: 2, name: title })).toBeVisible();

  // And from the keyboard alone: Tab reaches the title, Enter opens it.
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  await tabTo(page, highlights.getByRole("button", { name: title }));
  await page.keyboard.press("Enter");
  await expect(pane(page).getByRole("heading", { level: 2, name: title })).toBeVisible();

});

test("on a phone, their page's quiet words are still 44px each way to touch", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the touch floor is a phone's");
  const name = `their-phone-${test.info().workerIndex}-${Date.now()}`;
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  const who = about(page, `Blog ${name}`);
  for (const target of [who.getByRole("button", { name: "Add a note…" }), who.getByRole("button", { name: /^Folders/ }), who.getByRole("button", { name: "Hide articles about…" })]) {
    const box = await target.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});

test("their settings change the moment they're touched, with no Edit, Cancel or Done", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same page on a phone");
  const name = `their-prefs-${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);

  // The old Edit address opens their page, with the keyboard on their Name.
  await page.goto(new URL(`/people/${id}/edit`, FEEDS_APP).href);
  await appReady(page);
  await expect(page).toHaveURL(new RegExp(`/people/${id}/about$`));
  const who = about(page, `Blog ${name}`);
  const settings = who.getByRole("region", { name: "Settings" });
  const field = settings.getByRole("textbox", { name: "Name" });
  await expect(field).toBeFocused();
  await expect(who.getByRole("button", { name: /^(Cancel|Done)$/ })).toHaveCount(0);

  // Escape puts a half-typed name back; Enter keeps a new one, at once.
  await field.fill("Someone else");
  await page.keyboard.press("Escape");
  await expect(field).toHaveValue(`Blog ${name}`);
  await field.fill(`Mira ${name}`);
  await page.keyboard.press("Enter");
  const renamed = about(page, `Mira ${name}`);
  await expect(renamed.getByRole("heading", { level: 2, name: `Mira ${name}` })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Sidebar" }).getByRole("link", { name: new RegExp(`Mira ${name}`) })).toBeVisible();

  // Folders: the ones they're in, in words, opening to the tick list; a new folder is made and chosen as it's named.
  await renamed.getByRole("button", { name: /^Folders/ }).click();
  await renamed.getByRole("textbox", { name: "New folder" }).fill(`Shelf ${name}`);
  await page.keyboard.press("Enter");
  await expect(renamed.getByRole("checkbox", { name: `Shelf ${name}` })).toBeChecked();
  await expect(renamed.getByRole("button", { name: /^Folders/ })).toContainText(`Shelf ${name}`);
  await renamed.getByRole("checkbox", { name: `Shelf ${name}` }).uncheck();
  await expect(renamed.getByRole("button", { name: /^Folders/ })).toContainText("None");

  // A publication has no Write to: choosing it takes the button away, and choosing A person brings it back.
  await renamed.getByRole("radio", { name: "A publication" }).check();
  await expect(renamed.getByRole("link", { name: /^Write to/ }).or(renamed.getByRole("button", { name: /^Write to/ }))).toHaveCount(0);
  await renamed.getByRole("radio", { name: "A person" }).check();
  await expect(renamed.getByRole("link", { name: /^Write to/ }).or(renamed.getByRole("button", { name: /^Write to/ }))).toHaveCount(1);

  // Pause for a while: on as it's switched, and the line at the top says so, with Resume.
  await renamed.getByRole("switch", { name: "Pause for a while" }).check();
  await expect(renamed.getByRole("button", { name: "Resume" })).toBeVisible();
  await renamed.getByRole("button", { name: "Resume" }).click();
  await expect(renamed.getByRole("switch", { name: "Pause for a while" })).not.toBeChecked();

  // The X at the bar's right end goes back to their list.
  await renamed.getByRole("button", { name: "Close" }).click();
  await expect(page).toHaveURL(new RegExp(`/people/${id}$`));
});

test("when Your highlights can't be loaded, their page says so", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same words on a phone");
  const name = `their-failing-${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);
  await page.route(`**/api/feeds/${id}/highlights`, (route) => route.fulfill({ status: 500, json: { error: "trouble" } }));
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  const who = about(page, `Blog ${name}`);
  await expect(who).toContainText("Your highlights from their writing couldn't be loaded.");
  await expect(who.getByRole("region", { name: "Your highlights" })).toHaveCount(0);
});
