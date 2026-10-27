import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// SPEC section 34 (decision 0111), "How to check it", done by a browser: a
// made-up podcast (tests/feed-server.mjs) whose episodes are silence. An
// episode plays in the player under its byline, where it stopped is kept on
// the server and it carries on from there after a reload; and an episode in
// Up Next starts by itself when the one playing ends. On a wide window only:
// Up Next is the reader's own, shared by every test signed in as them.

const article = (page: Page) => page.getByRole("region", { name: "Article" });
const player = (page: Page) => article(page).getByRole("group", { name: "Episode player" });
const bar = (page: Page) => page.getByRole("region", { name: "Now playing" });
const LONG = "A long walk";
const SHORT = "A short pause";

async function openPodcast(page: Page): Promise<void> {
  const name = `cast-${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/podcast/${name}/`);
  await page.goto(new URL(`/feeds/${id}`, FEEDS_APP).href);
  await appReady(page);
  await expect(page.getByRole("button", { name: new RegExp(LONG) })).toBeVisible();
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
  await player(page).getByRole("button", { name: "Play" }).click();
  await expect(player(page).getByRole("button", { name: "Pause" })).toBeVisible();
  await expect(bar(page)).toBeVisible();
  await expect.poll(async () => Number(await slider.inputValue()), { timeout: 10_000 }).toBeGreaterThanOrEqual(3);
  await player(page).getByRole("button", { name: "Pause" }).click();
  await expect(player(page).getByRole("button", { name: "Play" })).toBeVisible();
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
});

test("the episode in Up Next starts by itself when the one playing ends", async ({ page, isMobile }) => {
  test.skip(isMobile, "Up Next is the reader's own, so one window checks it");
  await openPodcast(page);

  // The long one goes in Up Next, from its More menu; Up Next shows in the sidebar.
  await open(page, LONG);
  await article(page).getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Add to Up Next" }).click();
  await expect(player(page)).toContainText(/In Up Next, \d+ of \d+/);
  const sidebar = page.getByRole("navigation", { name: "Sidebar" });
  await expect(sidebar.getByRole("link", { name: /^Up Next/ })).toBeVisible();

  // The short one plays to its end (two seconds); then the long one starts.
  await open(page, SHORT);
  await player(page).getByRole("button", { name: "Play" }).click();
  await expect(bar(page)).toContainText(`Playing next: ${LONG}`, { timeout: 15_000 });
  await expect(bar(page).getByRole("button", { name: "Pause" })).toBeVisible();
  // Playing it took it off Up Next, which leaves the sidebar again when empty.
  await expect(sidebar.getByRole("link", { name: /^Up Next/ })).toHaveCount(0);
  await bar(page).getByRole("button", { name: "Close the player" }).click();
});
