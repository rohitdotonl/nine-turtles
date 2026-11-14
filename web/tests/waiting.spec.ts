import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, openReadingRoom, signIn } from "./screens";

// Every wait and every press is answered, round 2 (decision 0230): a slow
// list, article or video says it's on its way, a mark refused because the
// reader was signed out says so with Sign in, following someone is named
// with Undo, and a key that needs an article says to choose one.

const phone = () => test.info().project.name === "phone";
const article = (page: Page) =>
  page.getByRole("region", { name: "Article", exact: true });
const SLOW_LETTER = /The pleasure of a slow letter/;

/**
 * Holds every request matching `url` until the returned function is called.
 * Then it goes on its way, or, given `standIn`, is answered with that page
 * instead, so the test never leaves this computer.
 */
async function hold(
  page: Page,
  url: string | RegExp,
  standIn?: string,
): Promise<() => void> {
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(url, async (route) => {
    await held;
    return standIn === undefined
      ? route.continue()
      : route.fulfill({ contentType: "text/html", body: standIn });
  });
  return release;
}

async function signedIn(page: Page): Promise<void> {
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
}

test("a slow list and a slow article say they're loading", async ({
  page,
}) => {
  await signedIn(page);
  const id = await follow(page, `${FEED_SITE}/reading/`);
  const release = await hold(page, /\/api\/articles\?/);
  await page.goto(new URL(`/people/${id}`, FEEDS_APP).href);
  await expect(page.getByText(/^Loading .+…$/)).toBeVisible();
  release();
  await expect(page.getByRole("button", { name: SLOW_LETTER })).toBeVisible();
  await expect(page.getByText(/^Loading .+…$/)).toHaveCount(0);

  const releaseText = await hold(page, /\/api\/articles\/\d+$/);
  await page.getByRole("button", { name: SLOW_LETTER }).click();
  await expect(article(page).getByText("Loading the article…")).toBeVisible();
  releaseText();
  await expect(article(page).getByText("Loading the article…")).toHaveCount(
    0,
  );
});

test("a video that takes a while to start says so", async ({ page }) => {
  // A stand-in for YouTube's player: the real one's page can take longer to
  // finish loading than this test waits.
  const release = await hold(page, /youtube/, "<p>YouTube's player</p>");
  await signedIn(page);
  const id = await follow(page, `${FEED_SITE}/videos/`);
  await page.goto(new URL(`/people/${id}`, page.url()).href);
  await page.getByRole("button", { name: /A river at dawn/ }).click();
  await article(page)
    .getByRole("button", { name: "Play video: A river at dawn, for an hour" })
    .click();
  await expect(article(page).getByText("Starting the video…")).toBeVisible();
  await expect(article(page).locator("iframe")).toBeFocused();
  release();
  await expect(article(page).getByText("Starting the video…")).toHaveCount(0);
});

test("a mark refused because the reader is signed out says so, with Sign in", async ({
  page,
}) => {
  await signedIn(page);
  await openReadingRoom(page);
  await page.route("**/api/articles/starred", (route) =>
    route.fulfill({ status: 401 }),
  );
  await page.getByRole("button", { name: SLOW_LETTER }).click();
  await article(page)
    .getByRole("button", { name: "Star", exact: true })
    .first()
    .click();
  await expect(
    page
      .getByText("You're signed out, so the star wasn't saved.", {
        exact: true,
      })
      .locator("visible=true"),
  ).toBeVisible();
  const signInButton = page
    .getByRole("button", { name: "Sign in", exact: true })
    .locator("visible=true");
  await expect(signInButton).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
  // Sign in loads nine turtles again, which asks to sign in if it must and comes back here.
  await Promise.all([page.waitForEvent("load"), signInButton.click()]);
  await appReady(page);
});

test("following someone says so, with Undo", async ({ page }) => {
  const name = `following-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  await page.goto(
    new URL(
      `/add-feed?url=${encodeURIComponent(`${FEED_SITE}/blog/${name}/`)}`,
      FEEDS_APP,
    ).href,
  );
  await appReady(page);
  await signIn(page);
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  // Its articles name no writer, so it could be either: kept with Publications (decision 0264).
  await expect(page).toHaveURL(/\/publications\/[0-9]+$/);
  await expect(
    page.getByText(`You're following Blog ${name}.`, { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(
    page.getByText(`You're no longer following Blog ${name}.`, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/\/publications\/[0-9]+$/);
  const feeds = await (
    await page.request.get(new URL("/api/feeds", FEEDS_APP).href)
  ).text();
  expect(feeds).not.toContain(name);
});

test("a key that needs an article says to choose one first", async ({
  page,
}) => {
  test.skip(phone(), "A phone has no keys; its Star sits on an article.");
  await signedIn(page);
  await openReadingRoom(page);
  await page.keyboard.press("s");
  await expect(
    page.getByText("Choose an article first. j chooses the first one.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("j");
  await page.keyboard.press("s");
  await expect(page.getByText("Starred.", { exact: true })).toBeVisible();
});
