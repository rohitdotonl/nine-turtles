import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn, tabTo } from "./screens";

// SPEC section 15, "Your feeds": every feed with when it last posted, the
// quiet ones, and Edit, which moves or unsubscribes from several feeds at
// once, each with one Undo. Each run follows blogs of its own.

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });
const yours = (page: Page) => page.getByRole("region", { name: "Your feeds" });

async function twoBlogs(page: Page): Promise<[string, string]> {
  const run = `${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const names = [`tidy-a-${run}`, `tidy-b-${run}`];
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  for (const name of names) await follow(page, `${FEED_SITE}/blog/${name}/`);
  return [`Blog ${names[0]}`, `Blog ${names[1]}`];
}

test("Edit moves several feeds to a new folder and unsubscribes from them, each with one Undo", async ({ page, isMobile }) => {
  const [first, second] = await twoBlogs(page);
  const folder = `Later ${Date.now()}`;

  // Settings › Feeds › Your feeds.
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("link", { name: "Your feeds" }).click();
  await expect(page.getByRole("heading", { name: "Your feeds", level: 2 })).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/feeds$/);
  // Each feed says when it last posted; out of Edit, a row opens the feed.
  await expect(yours(page).getByRole("link", { name: new RegExp(`^${first}\\s*Last posted (today|on )`) })).toBeVisible();

  // Fresh blogs aren't quiet.
  await page.getByRole("radio", { name: "Quiet for 6 months" }).check();
  await expect(yours(page).getByRole("link", { name: new RegExp(first) })).toHaveCount(0);
  await page.getByRole("radio", { name: "All feeds" }).check();

  // Edit: tick two feeds, then Move to… a new folder.
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("checkbox", { name: new RegExp(first) }).check();
  await page.getByRole("checkbox", { name: new RegExp(second) }).check();
  await expect(page.getByText("2 chosen")).toBeVisible();
  await page.getByRole("button", { name: "Move to…" }).click();
  const sheet = page.getByRole("dialog", { name: "Move 2 feeds" });
  await sheet.getByRole("radio", { name: "New folder" }).check();
  await sheet.getByRole("textbox", { name: "New folder's name" }).fill(folder);
  await sheet.getByRole("button", { name: "Move" }).click();
  await expect(sheet).toHaveCount(0);
  const status = page.getByRole("status").filter({ hasText: "Moved" });
  await expect(status).toHaveText(`Moved 2 feeds to ${folder}.`);
  await expect(yours(page).getByRole("link", { name: new RegExp(`${first}.*· ${folder}`) })).toBeVisible();
  if (!isMobile) await expect(sidebar(page).getByRole("link", { name: new RegExp(`^${folder}`) })).toBeVisible();

  // One Undo puts both back, and the folder made for them goes too.
  await expect(page.getByRole("button", { name: "Undo" })).toBeFocused();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(yours(page).getByRole("link", { name: new RegExp(`${first}.*· ${folder}`) })).toHaveCount(0);
  if (!isMobile) await expect(sidebar(page).getByRole("link", { name: new RegExp(`^${folder}`) })).toHaveCount(0);

  // Unsubscribe from both at once; one Undo brings both back.
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("checkbox", { name: new RegExp(first) }).check();
  await page.getByRole("checkbox", { name: new RegExp(second) }).check();
  await page.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Unsubscribed" })).toHaveText("Unsubscribed from 2 feeds.");
  await expect(yours(page).getByRole("link", { name: new RegExp(first) })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(yours(page).getByRole("link", { name: new RegExp(first) })).toBeVisible();
  await expect(yours(page).getByRole("link", { name: new RegExp(second) })).toBeVisible();

  // Closing goes back to Settings.
  await page.getByRole("button", { name: "Close your feeds" }).click();
  await expect(page.getByRole("heading", { name: "Settings", level: 2 })).toBeVisible();
});

test("with the keyboard alone: Edit, choose, Move to… and Escape closes only the sheet", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard use is tested on the wide layout");
  const [first] = await twoBlogs(page);
  await page.goto(new URL("/settings/feeds", FEEDS_APP).href);
  await appReady(page);
  await tabTo(page, page.getByRole("button", { name: "Edit" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Done" })).toBeFocused();
  await tabTo(page, page.getByRole("checkbox", { name: new RegExp(first) }));
  await page.keyboard.press("Space");
  await expect(page.getByText("1 chosen")).toBeVisible();
  // Choose all ticks every listed feed; Choose none clears them.
  await page.getByRole("button", { name: "Choose all" }).click();
  await expect(page.getByText(/^([2-9]|\d\d+) chosen$/)).toBeVisible();
  await page.getByRole("button", { name: "Choose none" }).click();
  await expect(page.getByText("Choose feeds")).toBeVisible();
  await page.getByRole("checkbox", { name: new RegExp(first) }).check();
  await tabTo(page, page.getByRole("button", { name: "Move to…" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Move 1 feed" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your feeds", level: 2 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Move to…" })).toBeFocused();
  // Escape on the page goes back to Settings.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Settings", level: 2 })).toBeVisible();
});
