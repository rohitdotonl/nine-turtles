import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// SPEC section 35 (decision 0113), "How to check it", done by a browser: a
// made-up podcast (tests/feed-server.mjs) whose episodes are silence. An
// episode plays in the player under its byline, where it stopped is kept on
// the server and it carries on from there after a reload; and an episode
// that ends stops there: nothing starts by itself (Up Next was removed in
// step 5 of the owner's review). The player is worked by the keyboard, and
// passes the automatic accessibility checks with the Now playing bar. Where
// a reader stopped is their own, shared by every test signed in as them, so
// those run on a wide window only; the phone checks the bar sits above the
// article's toolbar.

const article = (page: Page) => page.getByRole("region", { name: "Article", exact: true });
const player = (page: Page) => article(page).getByRole("group", { name: "Episode player" });
const bar = (page: Page) => page.getByRole("region", { name: "Now playing" });
const LONG = "A long walk";
const SHORT = "A short pause";

async function openPodcast(page: Page, wide = true): Promise<void> {
  const name = `cast-${test.info().workerIndex}-${Date.now()}`;
  if (wide) await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/podcast/${name}/`);
  await page.goto(new URL(`/people/${id}`, FEEDS_APP).href);
  await appReady(page);
  await expect(page.getByRole("button", { name: new RegExp(LONG) })).toBeVisible();
}

/** The automatic WCAG checks over the player and the Now playing bar. */
async function checkAccessibility(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .include(".episode")
    .include('section[aria-label="Now playing"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  expect(results.violations).toEqual([]);
}

/** Presses `key` on a control, as the keyboard does (never a click). */
async function press(page: Page, control: ReturnType<Page["getByRole"]>, key = "Enter"): Promise<void> {
  await control.focus();
  await page.keyboard.press(key);
}

async function open(page: Page, title: string): Promise<void> {
  await page.getByRole("button", { name: new RegExp(title) }).first().click();
  await expect(article(page).getByRole("heading", { name: title })).toBeVisible();
  await expect(player(page)).toBeVisible();
}

test("an episode plays, and carries on where it stopped after a reload", async ({ page, isMobile }) => {
  test.skip(isMobile, "where a reader stopped is theirs, so one window checks it");
  await openPodcast(page);
  // Its row says it's an episode, and how long.
  await expect(page.getByRole("button", { name: new RegExp(LONG) })).toContainText("1 min");

  await open(page, LONG);
  const slider = player(page).getByRole("slider", { name: "Position" });
  // Until it starts, the player says how long it is; the 15 and 30 in the skip buttons are big enough to read.
  const length = player(page).locator(".episode-length");
  await expect(length).toHaveText(/^1 min\s*long$/);
  for (const name of ["Back 15 seconds", "Forward 30 seconds"]) {
    const button = player(page).getByRole("button", { name });
    await expect(button).toHaveAttribute("title", name);
    const figures = (await button.locator("text").boundingBox())!;
    expect(figures.height).toBeGreaterThanOrEqual(8);
  }
  // Its show notes are only a summary (they end "…"), so they end with a link to the episode's own page, on a row 44px tall.
  const page_ = article(page).getByRole("link", { name: /^Read the episode page on Podcast cast-/ });
  await expect(page_).toBeVisible();
  expect((await page_.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // By the keyboard: Space on Play, and the button keeps the keyboard as it becomes Pause.
  await press(page, player(page).getByRole("button", { name: "Play" }), "Space");
  await expect(player(page).getByRole("button", { name: "Pause" })).toBeFocused();
  await expect(bar(page)).toBeVisible();
  // Once it has started, the times under the slider say how long: the length beside the speed steps aside.
  await expect(length).toHaveText("");
  await expect.poll(async () => Number(await slider.inputValue()), { timeout: 10_000 }).toBeGreaterThanOrEqual(3);
  await checkAccessibility(page);
  await page.keyboard.press("Enter");
  await expect(player(page).getByRole("button", { name: "Play" })).toBeFocused();
  const stopped = Number(await slider.inputValue());

  // The server has it: this device's own copy is forgotten before the reload.
  const id = (await slider.getAttribute("id"))?.split("-").pop();
  await expect
    .poll(async () => {
      const response = await page.request.get(new URL(`/api/episodes/${id}/progress`, FEEDS_APP).href);
      return ((await response.json()).progress?.position as number | undefined) ?? 0;
    })
    .toBeGreaterThanOrEqual(stopped - 1);
  await page.evaluate(() => localStorage.removeItem("nine-turtles.episode-places"));
  await page.reload();
  await appReady(page);
  await open(page, LONG);
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThanOrEqual(stopped - 1);
  // Play carries on from there, not from the start.
  await player(page).getByRole("button", { name: "Play" }).click();
  await expect(player(page).getByRole("button", { name: "Pause" })).toBeVisible();
  expect(Number(await slider.inputValue())).toBeGreaterThanOrEqual(stopped - 1);
  await bar(page).getByRole("button", { name: "Close the player" }).click();
  await expect(bar(page)).toHaveCount(0);

  // Signing out stops the player and forgets this device's places, so the next reader starts from nothing.
  await player(page).getByRole("button", { name: "Play" }).click();
  await expect(bar(page)).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("nine-turtles.episode-places"))).not.toBeNull();
  await page.getByRole("navigation", { name: "Sidebar" }).getByRole("link", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(bar(page)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("nine-turtles.episode-places"))).toBeNull();
  expect(await page.evaluate(() => [...document.querySelectorAll("audio")].some((audio) => !audio.paused))).toBe(false);
});

test("on a phone, the Now playing bar steps aside for the episode's own player, and otherwise sits just above the article's toolbar", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the phone layout only");
  await openPodcast(page, false);
  await open(page, LONG);
  await press(page, player(page).getByRole("button", { name: "Play" }));
  await expect(player(page).getByRole("button", { name: "Pause" })).toBeVisible();
  // The same episode's player is on screen, so the bar would only say it twice.
  await expect(bar(page)).toHaveCount(0);
  // On the next episode, the one playing shows in the bar.
  const toolbar = article(page).getByRole("group", { name: "Article actions" });
  await toolbar.getByRole("button", { name: "Next" }).click();
  await expect(article(page).getByRole("heading", { name: SHORT })).toBeVisible();
  await expect(bar(page)).toBeVisible();
  await expect(bar(page)).toContainText(LONG);
  const [above, below] = [await bar(page).boundingBox(), await toolbar.boundingBox()];
  expect(above && below && Math.abs(above.y + above.height - below.y)).toBeLessThanOrEqual(1);
  await checkAccessibility(page);
  await press(page, bar(page).getByRole("button", { name: "Close the player" }));
  await expect(bar(page)).toHaveCount(0);
});

test("an episode that ends stops there, and there's no Up Next to add it to", async ({ page, isMobile }) => {
  test.skip(isMobile, "where a reader stopped is their own, so one window checks it");
  await openPodcast(page);

  await open(page, LONG);
  await article(page).getByRole("button", { name: "More actions" }).click();
  await expect(page.getByRole("menuitem", { name: /Up Next/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation", { name: "Sidebar" }).getByRole("link", { name: /^Up Next/ })).toHaveCount(0);

  // The short one plays to its end (two seconds), and nothing else starts.
  await open(page, SHORT);
  await player(page).getByRole("button", { name: "Play" }).click();
  await expect(bar(page)).toContainText("Finished.", { timeout: 15_000 });
  await expect(bar(page).getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await bar(page).getByRole("button", { name: "Close the player" }).click();
});
