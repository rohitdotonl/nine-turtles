import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, openReadingRoom, signIn } from "./screens";

// Every press is answered (decision 0229): a mark made while reading is said
// where the reader is, Refresh says when nothing new came, a key with
// nothing to do says why, a waiting button says what it's doing, and Write
// back says the email app is opening, with a way out if it didn't.

const phone = () => test.info().project.name === "phone";
const article = (page: Page) =>
  page.getByRole("region", { name: "Article", exact: true });
const NEWEST = "On keeping a commonplace book (3)";
const newestRow = (page: Page) =>
  page.getByRole("button", { name: /On keeping a commonplace book \(3\)/ });

/** Signs in, follows a new made-up blog of its own and opens its list. */
async function openBlog(page: Page): Promise<void> {
  const name = `answers-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/`);
  await page.goto(new URL(`/people/${id}`, FEEDS_APP).href);
  await appReady(page);
  await expect(newestRow(page)).toBeVisible();
}

test("a mark made while the list is out of sight is said in the article, with Undo", async ({
  page,
}) => {
  await openBlog(page);
  await newestRow(page).click();
  await expect(
    article(page).getByRole("heading", { level: 2, name: NEWEST }),
  ).toBeVisible();
  // On a computer, the list hidden with its own button; on a phone the article is a screen of its own.
  if (!phone())
    await page.getByRole("button", { name: "Article list" }).click();
  await article(page)
    .getByRole("button", { name: "Star", exact: true })
    .first()
    .click();
  await expect(
    article(page).getByText("Starred.", { exact: true }),
  ).toBeVisible();
  await article(page).getByRole("button", { name: "Undo" }).click();
  await expect(
    article(page).getByText("Undone.", { exact: true }),
  ).toBeVisible();
  await expect(
    article(page).getByRole("button", { name: "Star", exact: true }).first(),
  ).toHaveAttribute("aria-pressed", "false");
  await article(page).getByRole("button", { name: "Close the note" }).click();
  await expect(
    article(page).getByText("Undone.", { exact: true }),
  ).toBeHidden();
});

test("Refresh says so when nothing new has arrived", async ({ page }) => {
  await openBlog(page);
  await page.getByRole("button", { name: "More", exact: true }).first().click();
  await page.getByRole("menuitem", { name: /^Refresh/ }).click();
  await expect(
    page.getByText(/^Nothing new has arrived since \d\d:\d\d\.$/),
  ).toBeVisible();
});

test("a key with nothing to do says why", async ({ page }) => {
  test.skip(
    phone(),
    "A phone has no keys; its Previous arrow is dimmed on the first article.",
  );
  await openBlog(page);
  await page.keyboard.press("u");
  await expect(
    page.getByText("Nothing to undo.", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("j");
  await expect(
    article(page).getByRole("heading", { level: 2, name: NEWEST }),
  ).toBeVisible();
  await page.keyboard.press("k");
  await expect(
    page.getByText("That's the first article here.", { exact: true }),
  ).toBeVisible();
});

test("a button that waits says what it's doing", async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(
    "**/api/sign-in",
    async (route) => (await held, route.continue()),
  );
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await page.getByLabel("Email").fill("someone@example.com");
  await page.getByLabel("Password", { exact: true }).fill("not the password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Signing in…" })).toBeVisible();
  release();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
});

test("Write back says the email app is opening, and offers the address if nothing opened", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await openReadingRoom(page);
  await page
    .getByRole("button", { name: /The pleasure of a slow letter/ })
    .click();
  const writeBack = article(page).getByRole("link", { name: /^Write back to/ });
  // No email app in the test browser: the press is kept from leaving the page, as when none opens.
  await writeBack.evaluate((link) =>
    link.addEventListener("click", (event) => event.preventDefault(), true),
  );
  await writeBack.click();
  await expect(
    article(page).getByText("Opening your email app…"),
  ).toBeVisible();
  await article(page)
    .getByRole("button", { name: "Copy their address" })
    .click();
  await expect(
    article(page).getByText("Copied.", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "a@reading-room.example",
  );
});
