import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, openReadingRoom, signIn, tabTo } from "./screens";

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

// The app may still be asking for a list as a test ends; its answer is thrown
// away with the page, which made the stand-in below fail a test that had
// passed ("Response has been disposed"). Stop standing in first (decision 0114).
test.afterEach(async ({ page }) => page.unrouteAll({ behavior: "ignoreErrors" }));

/** Signs in, follows a new made-up blog of its own and opens its list. */
async function openBlog(page: Page): Promise<void> {
  const name = `answers-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/`);
  // A list's "latest" is the newest article anyone has (server/src/feeds/lists.rs → LATEST), so
  // another test adding a feed at the same moment looked like news to Refresh. Each list here keeps
  // the first number it was given; routed before the page loads (see marking.spec.ts).
  let latest: unknown;
  await page.route(/\/api\/articles\?/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    latest ??= body.latest;
    await route.fulfill({ response, json: { ...body, latest } });
  });
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
  // On a computer, full-screen reading (f) hides the list; on a phone the article is a screen of its own.
  if (!phone()) await page.keyboard.press("f");
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

test("the new lines never take away an Undo, and r says nothing new too", async ({
  page,
}) => {
  test.skip(phone(), "Keys, on a computer.");
  await openBlog(page);
  await page.keyboard.press("Shift+A");
  await expect(
    page.getByText(/^Marked 3 articles as read in Blog answers-.*\.$/),
  ).toBeVisible();
  await page.keyboard.press("r");
  await expect(page.getByText(/^Nothing new has arrived since/)).toBeVisible();
  await expect(page.getByText(/^Nothing new has arrived since/)).toHaveCSS("font-family", /^"Atkinson Hyperlegible Next Plain Zero"/);
  // A passing line shows no Undo of its own, but u still undoes the last action.
  await expect(page.getByRole("button", { name: "Undo" })).toBeHidden();
  await page.keyboard.press("j");
  await page.keyboard.press("k");
  await expect(
    page.getByText("That's the first article here.", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("u");
  await expect(page.getByText("Undone.", { exact: true })).toBeVisible();
  await expect(newestRow(page)).toHaveAccessibleName(/, unread/);
});

test("the note in the article is reached by Tab, and its Undo leaves the keyboard on the article", async ({
  page,
}) => {
  test.skip(phone(), "The keyboard, on a computer.");
  await openBlog(page);
  await newestRow(page).click();
  await page.keyboard.press("f");
  await page.keyboard.press("s");
  const undo = article(page).getByRole("button", { name: "Undo" });
  await tabTo(page, undo);
  await page.keyboard.press("Enter");
  await expect(
    article(page).getByText("Undone.", { exact: true }),
  ).toBeVisible();
  await expect(
    article(page).getByRole("heading", { level: 2, name: NEWEST }),
  ).toBeFocused();
});
