import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn, tabTo } from "./screens";

// SPEC section 15, "Everyone you follow": everyone with their newest title
// and when it came, and Choose, which moves or unsubscribes from several at
// once, each with one Undo. Each run follows blogs of its own.

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });
const yours = (page: Page) => page.getByRole("region", { name: "Everyone you follow" });

async function twoBlogs(page: Page): Promise<[string, string]> {
  const run = `${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const names = [`tidy-a-${run}`, `tidy-b-${run}`];
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  for (const name of names) await follow(page, `${FEED_SITE}/blog/${name}/`);
  return [`Blog ${names[0]}`, `Blog ${names[1]}`];
}

test("Choose moves several to a new folder and unsubscribes from them, each with one Undo", async ({ page, isMobile }) => {
  const [first, second] = await twoBlogs(page);
  const folder = `Later ${Date.now()}`;

  // Settings › Everyone you follow.
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("link", { name: "Everyone you follow" }).click();
  await expect(page.getByRole("heading", { name: "Everyone you follow", level: 2 })).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/feeds$/);
  // Each row says the title of their newest piece and when it came, never "Quiet" for a fresh blog.
  await expect(yours(page).getByRole("link", { name: new RegExp(`^${first}\\s*“[^”]+”, (today|\\d+ \\w+)`) })).toBeVisible();
  // People and Publications apart, as in the sidebar, under headings that count them.
  await expect(yours(page).getByRole("heading", { level: 3, name: /^\d+ (person|people|publications?)$/ }).first()).toBeVisible();
  // The Show filter is gone.
  await expect(page.getByRole("radio", { name: "Quiet for 6 months" })).toHaveCount(0);

  // Choose: tick two, then Move to… a new folder.
  await page.getByRole("button", { name: "Choose…" }).click();
  await page.getByRole("checkbox", { name: new RegExp(first) }).check();
  await page.getByRole("checkbox", { name: new RegExp(second) }).check();
  await expect(page.getByText("2 chosen")).toBeVisible();
  await page.getByRole("button", { name: "Move to…" }).click();
  const sheet = page.getByRole("dialog", { name: "Move to a folder" });
  // Nothing is chosen at first, so Move never takes them out of their folders by default (decision 0137).
  await expect(sheet.getByRole("radio", { checked: true })).toHaveCount(0);
  await sheet.getByRole("button", { name: "Move" }).click();
  await expect(sheet.getByRole("status")).toHaveText("Choose where they go first.");
  await sheet.getByRole("radio", { name: "New folder" }).check();
  await sheet.getByRole("textbox", { name: "New folder's name" }).fill(folder);
  await sheet.getByRole("button", { name: "Move" }).click();
  await expect(sheet).toHaveCount(0);
  const status = page.getByRole("status").filter({ hasText: "Moved" });
  await expect(status).toHaveText(`Moved 2 to ${folder}.`);
  await expect(yours(page).getByRole("link", { name: new RegExp(`${first}.*· ${folder}`) })).toBeVisible();
  if (!isMobile) await expect(sidebar(page).getByRole("link", { name: new RegExp(`^${folder}`) })).toBeVisible();

  // One Undo puts both back, and the folder made for them goes too.
  await expect(page.getByRole("button", { name: "Undo" })).toBeFocused();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(yours(page).getByRole("link", { name: new RegExp(`${first}.*· ${folder}`) })).toHaveCount(0);
  if (!isMobile) await expect(sidebar(page).getByRole("link", { name: new RegExp(`^${folder}`) })).toHaveCount(0);

  // Unsubscribe from both at once; one Undo brings both back.
  await page.getByRole("button", { name: "Choose…" }).click();
  await page.getByRole("checkbox", { name: new RegExp(first) }).check();
  await page.getByRole("checkbox", { name: new RegExp(second) }).check();
  await page.getByRole("button", { name: "Unsubscribe", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Unsubscribed" })).toHaveText("Unsubscribed from 2.");
  await expect(yours(page).getByRole("link", { name: new RegExp(first) })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(yours(page).getByRole("link", { name: new RegExp(first) })).toBeVisible();
  await expect(yours(page).getByRole("link", { name: new RegExp(second) })).toBeVisible();

  // A row opens their page, where they can be written to, noted and edited.
  await yours(page).getByRole("link", { name: new RegExp(`^${first}`) }).click();
  await expect(page).toHaveURL(/\/(people|publications)\/\d+\/about$/);
});

test("with the keyboard alone: Choose, tick, Move to… and Escape closes only the sheet", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard use is tested on the wide layout");
  const [first] = await twoBlogs(page);
  await page.goto(new URL("/settings/feeds", FEEDS_APP).href);
  await appReady(page);
  await tabTo(page, page.getByRole("button", { name: "Choose…" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Done" })).toBeFocused();
  await tabTo(page, page.getByRole("checkbox", { name: new RegExp(first) }));
  await page.keyboard.press("Space");
  await expect(page.getByText("1 chosen")).toBeVisible();
  // Choose all ticks every listed feed; Choose none clears them.
  await page.getByRole("button", { name: "Choose all" }).click();
  await expect(page.getByText(/^([2-9]|\d\d+) chosen$/)).toBeVisible();
  await page.getByRole("button", { name: "Choose none" }).click();
  await expect(page.getByText("Choose who")).toBeVisible();
  await page.getByRole("checkbox", { name: new RegExp(first) }).check();
  await tabTo(page, page.getByRole("button", { name: "Move to…" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Move to a folder" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Everyone you follow", level: 2 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Move to…" })).toBeFocused();
  // Escape on the page goes back to Settings.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Settings", level: 2 })).toBeVisible();
});
