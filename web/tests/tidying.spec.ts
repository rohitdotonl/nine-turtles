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

  // Everyone you follow: a row of its own in the sidebar, under the lists (decision 0266).
  await page.goto(new URL("/", FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("navigation", { name: "Sidebar" }).getByRole("link", { name: "Everyone you follow" }).click();
  await expect(page.getByRole("heading", { name: "Everyone you follow", level: 2 })).toBeVisible();
  await expect(page).toHaveURL(/\/following$/);
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
  // New folder… under No folder, before the folders (decision 0261).
  await expect(sheet.getByRole("radio").nth(1)).toHaveAccessibleName("New folder…");
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
  // Unsubscribe sits alone at the bar's left, far from Move to… at its right, so a slip can't land on it (decision 0217).
  const unsubscribeBox = (await page.getByRole("button", { name: "Unsubscribe", exact: true }).boundingBox())!;
  const countBox = (await page.getByText("2 chosen").boundingBox())!;
  const moveBox = (await page.getByRole("button", { name: "Move to…" }).boundingBox())!;
  expect(unsubscribeBox.x + unsubscribeBox.width).toBeLessThan(countBox.x);
  expect(countBox.x + countBox.width).toBeLessThan(moveBox.x);
  expect(moveBox.x - (unsubscribeBox.x + unsubscribeBox.width)).toBeGreaterThan(100);
  await page.getByRole("button", { name: "Unsubscribe", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Unsubscribed" })).toHaveText("Unsubscribed from 2.");
  await expect(yours(page).getByRole("link", { name: new RegExp(first) })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Undone." })).toHaveText("Undone.");
  // The line has a ×, as the list's note does: it goes, and the keyboard waits on Choose….
  await yours(page).getByRole("button", { name: "Close the note" }).click();
  await expect(yours(page).getByText("Undone.")).toBeHidden();
  await expect(yours(page).getByRole("button", { name: "Choose…" })).toBeFocused();
  await expect(yours(page).getByRole("link", { name: new RegExp(first) })).toBeVisible();
  await expect(yours(page).getByRole("link", { name: new RegExp(second) })).toBeVisible();

  // A row opens their page, where they can be written to, noted and edited.
  await yours(page).getByRole("link", { name: new RegExp(`^${first}`) }).click();
  await expect(page).toHaveURL(/\/(people|publications)\/\d+\/about$/);
});

test("with the keyboard alone: Choose, tick, Move to… and Escape closes only the sheet", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard use is tested on the wide layout");
  const [first] = await twoBlogs(page);
  await page.goto(new URL("/following", FEEDS_APP).href);
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
  // Escape on the page leaves it where it is: a place of its own beside the sidebar, not one of Settings' pages (decision 0266).
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Everyone you follow", level: 2 })).toBeVisible();
  await expect(page).toHaveURL(/\/following$/);
});

test("when everyone you follow couldn't load, Try again loads them, keeping the keyboard's place", async ({ page }) => {
  await page.goto(new URL("/following", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  let failing = true;
  await page.route("**/api/tidy/feeds", (route) => (failing ? route.fulfill({ status: 500 }) : route.fallback()));
  await page.reload();
  await appReady(page);
  const problem = yours(page).getByRole("status").filter({ hasText: "Everyone you follow couldn't be loaded." });
  await expect(problem).toBeVisible();
  failing = false;
  await problem.getByRole("button", { name: "Try again" }).focus();
  await page.keyboard.press("Enter");
  await expect(problem).toHaveCount(0);
  await expect(page.locator("#your-feeds-heading")).toBeFocused();
  await expect(yours(page).getByRole("button", { name: "Choose…" })).toBeVisible();
});

test("Recently unsubscribed: Bring back with the keyboard alone, its Undo, and one already gone (decision 0240)", async ({ page }) => {
  const [first, second] = await twoBlogs(page);
  await page.goto(new URL("/following", FEEDS_APP).href);
  await appReady(page);

  // Unsubscribe from the first, then do something else: it waits, kept, at the end.
  await page.getByRole("button", { name: "Choose…" }).click();
  await page.getByRole("checkbox", { name: new RegExp(first) }).check();
  await page.getByRole("button", { name: "Unsubscribe", exact: true }).click();
  await yours(page).getByRole("button", { name: "Close the note" }).click();
  const kept = yours(page).getByRole("region", { name: "Recently unsubscribed" });
  await expect(kept.getByRole("button", { name: `Bring back ${first}` })).toBeVisible();
  await expect(kept.getByText(/^Unsubscribed today · kept until \d+\s\w+/).first()).toBeVisible();
  // A date inside a sentence has the plain zero too (decision 0246).
  await expect(kept.getByText(/^Unsubscribed today · kept until/).first().locator(".dated")).toHaveCSS("font-family", /^"Atkinson Hyperlegible Next Plain Zero"/);
  await expect(kept.getByText("Kept for 30 days, with their articles, so you can bring them back.")).toBeVisible();

  // From the keyboard: Bring back, then the keyboard waits on Undo.
  await tabTo(page, kept.getByRole("button", { name: `Bring back ${first}` }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "is back." })).toHaveText(`${first} is back.`);
  await expect(page.getByRole("button", { name: "Undo" })).toBeFocused();
  await expect(yours(page).getByRole("link", { name: new RegExp(`^${first}`) })).toBeVisible();
  await expect(kept.getByRole("button", { name: `Bring back ${first}` })).toHaveCount(0);
  // Undo unsubscribes again: they're back on the shelf.
  await page.keyboard.press("Enter");
  await expect(kept.getByRole("button", { name: `Bring back ${first}` })).toBeVisible();
  await expect(yours(page).getByRole("link", { name: new RegExp(`^${second}`) })).toBeVisible();

  // One cleared meanwhile: said calmly, and the keyboard stays on the shelf, not lost.
  await page.route("**/api/tidy/resubscribe", (route) => route.fulfill({ status: 409, json: { error: "too-late" } }));
  await yours(page).getByRole("button", { name: `Bring back ${first}` }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "already gone" })).toHaveText(`${first} can't be brought back: they're already gone.`);
  await expect(page.locator(":focus")).not.toHaveCount(0);
  await expect(page.locator("body")).not.toBeFocused();
});
