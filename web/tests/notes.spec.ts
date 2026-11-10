import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, choose, follow, signIn, tabTo } from "./screens";

// SPEC section 42 (decision 0164), "How to check it", in a browser: words
// chosen in an article are highlighted from the small menu beside them, a
// note is written on the whole article with N, both show at the
// article's end and stay after a reload; Notes, always in the sidebar,
// lists the article with its highlight; search finds it by the note's words;
// without a connection a highlight is still made, with the quiet line until
// it's sent; a person's page takes a note on them; and unsubscribing asks
// whether to keep what was saved.

const article = (page: Page) => page.getByRole("region", { name: "Article", exact: true });
const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });
const NEWEST = "On keeping a commonplace book (3)";

async function openNewest(page: Page, blog: string): Promise<number> {
  const id = await follow(page, `${FEED_SITE}/blog/${blog}/`);
  await page.goto(new URL(`/feeds/${id}`, FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("button", { name: new RegExp(NEWEST.replace(/[()]/g, "\\$&")) }).first().click();
  await expect(article(page).getByRole("heading", { name: NEWEST })).toBeVisible();
  return id;
}

test("highlights and a note stay with the article, and Notes and search find them", async ({ page, isMobile }) => {
  test.skip(isMobile, "the keys are the computer's; the phone uses the same menu");
  const blog = `notes-${test.info().workerIndex}-${Date.now()}`;
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await openNewest(page, blog);

  // Words chosen open the small menu; Highlight draws them in soft pencil.
  await choose(page, "made-up summary");
  await page.getByRole("menu", { name: "Chosen words" }).getByRole("menuitem", { name: /Highlight/ }).click();
  await expect(article(page).locator("mark.highlight")).toHaveText("made-up summary");
  // A small menu beside it says so, and offers a note there and then; Done closes it.
  const fresh = page.getByRole("menu", { name: "Highlight" });
  await expect(fresh).toContainText("Highlighted");
  await expect(fresh.getByRole("menuitem", { name: "Add a note…" })).toBeFocused();
  await fresh.getByRole("menuitem", { name: "Done" }).click();
  await expect(fresh).toHaveCount(0);
  const ends = article(page).getByRole("list", { name: "Your highlights" });
  await expect(ends.getByRole("button", { name: "made-up summary", exact: true })).toBeVisible();

  // h highlights the words chosen, from the keyboard.
  await choose(page, "for article");
  await page.keyboard.press("h");
  await expect(article(page).locator("mark.highlight")).toHaveCount(2);
  await page.keyboard.press("Escape");
  // Its Copy and Remove are at the end too; Remove puts the keyboard on Undo, which brings it back.
  await expect(ends.getByRole("button", { name: "Copy “for article”" })).toBeVisible();
  await ends.getByRole("button", { name: "Remove highlight “for article”" }).click();
  await expect(article(page).locator("mark.highlight")).toHaveCount(1);
  const undo = page.getByRole("button", { name: "Undo" });
  await expect(undo).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(article(page).locator("mark.highlight")).toHaveCount(2);

  // N with nothing chosen: a note on the whole article, at its end.
  await page.getByRole("heading", { name: NEWEST }).focus();
  await page.keyboard.press("n");
  const box = page.getByRole("textbox", { name: "A note on this article" });
  await expect(box).toBeFocused();
  await page.keyboard.type("Ask about the hedgerow survey");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(article(page).getByText("Ask about the hedgerow survey")).toBeVisible();

  // Both are kept: after a reload they're there, and Notes is in the sidebar.
  await page.reload();
  await appReady(page);
  await page.getByRole("button", { name: new RegExp(NEWEST.replace(/[()]/g, "\\$&")) }).first().click();
  await expect(article(page).locator("mark.highlight")).toHaveCount(2);
  await expect(article(page).getByText("Ask about the hedgerow survey")).toBeVisible();
  const notes = sidebar(page).getByRole("link", { name: "Notes", exact: true });
  await expect(notes).toBeVisible();
  await notes.click();
  await expect(page.getByText("Highlighted · made-up summary").first()).toBeVisible();

  // Search finds the article by its note's words.
  await page.keyboard.press("/");
  await page.keyboard.type("hedgerow");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Your note · .*hedgerow/).first()).toBeVisible();
});

/** Signed in, on a new blog's newest article, with each new highlight's save answering late (or refused), as on a busy server. */
async function slowSaves(page: Page, name: string, refuse = false) {
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await openNewest(page, `${name}-${test.info().workerIndex}-${Date.now()}`);
  await page.route(/\/api\/articles\/\d+\/highlights$/, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await new Promise((done) => setTimeout(done, 1500));
    await (refuse ? route.fulfill({ status: 500, body: "" }) : route.continue());
  });
  await choose(page, "for article");
  await page.keyboard.press("h");
  await page.keyboard.press("Escape");
  return article(page).getByRole("list", { name: "Your highlights" });
}

async function reopen(page: Page) {
  await page.reload();
  await appReady(page);
  await expect(article(page).getByRole("heading", { name: NEWEST })).toBeVisible();
}

test.describe("a highlight still being saved", () => {
  test.skip(({ isMobile }) => isMobile, "the keys are the computer's; the phone uses the same menu");

  test("removed at once, it goes, with Undo, and stays gone", async ({ page }) => {
    const ends = await slowSaves(page, "slow-remove");
    // The remove reaches the server once the save answers, under the highlight's own number.
    const removed = page.waitForResponse((answer) => /\/api\/highlights\/\d+\/delete$/.test(answer.url()));
    await ends.getByRole("button", { name: "Remove highlight “for article”" }).click();
    await expect(article(page).locator("mark.highlight")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Undo" })).toBeFocused();
    expect((await removed).ok()).toBe(true);
    await expect(page.getByText("couldn't be removed")).toHaveCount(0);
    await reopen(page);
    await expect(article(page).locator("mark.highlight")).toHaveCount(0);
  });

  for (const when of ["before", "after"] as const) {
    test(`a note on it, saved ${when} its save answers, is kept`, async ({ page }) => {
      const ends = await slowSaves(page, `slow-note-${when}`);
      await ends.getByRole("button", { name: "Add a note on “for article”" }).click();
      await page.getByRole("textbox", { name: "A note on these words" }).fill(`Saved ${when}`);
      // After: the box, opened with the stand-in, is still there when the save answers.
      if (when === "after") await page.waitForResponse((answer) => /\/highlights$/.test(answer.url()) && answer.request().method() === "POST");
      // The note itself reaches the server, under the highlight's own number (never the stand-in's).
      const noted = page.waitForResponse((answer) => /\/api\/highlights\/\d+$/.test(answer.url()) && answer.request().method() === "POST");
      await page.getByRole("button", { name: "Save" }).click();
      await expect(ends.getByText(`Saved ${when}`)).toBeVisible();
      expect((await noted).ok()).toBe(true);
      await expect(page.getByText("couldn't be saved")).toHaveCount(0);
      await reopen(page);
      await expect(article(page).locator("mark.highlight")).toHaveCount(1);
      await expect(ends.getByText(`Saved ${when}`)).toBeVisible();
    });
  }

  test("refused, a note written on it meanwhile keeps its words in the box", async ({ page }) => {
    const ends = await slowSaves(page, "slow-refused", true);
    await ends.getByRole("button", { name: "Add a note on “for article”" }).click();
    const box = page.getByRole("textbox", { name: "A note on these words" });
    await box.fill("Words worth keeping");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("The note couldn't be saved, so your words are still here.")).toBeVisible();
    await expect(box).toHaveValue("Words worth keeping");
  });
});

test("without a connection a highlight is kept on the device, and sent once back", async ({ page, context, isMobile }) => {
  test.skip(isMobile, "the same on a phone");
  const blog = `notes-offline-${test.info().workerIndex}-${Date.now()}`;
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await openNewest(page, blog);

  await context.setOffline(true);
  await page.evaluate(() => dispatchEvent(new Event("offline")));
  await choose(page, "short made-up");
  await page.getByRole("menuitem", { name: /Highlight/ }).click();
  await expect(article(page).locator("mark.highlight")).toHaveText("short made-up");
  await expect(page.getByText("You're offline. This is saved on this device only, and reaches your account once you're back online.")).toBeVisible();

  const sent = page.waitForResponse((response) => /\/api\/articles\/\d+\/highlights$/.test(response.url()) && response.status() === 201);
  await context.setOffline(false);
  await page.evaluate(() => dispatchEvent(new Event("online")));
  await sent;
  await expect(page.getByText("You're offline.", { exact: false })).toHaveCount(0);
});

test("unsubscribing asks whether to keep what was saved", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same question on a phone");
  const blog = `notes-leave-${test.info().workerIndex}-${Date.now()}`;
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await openNewest(page, blog);
  await choose(page, "made-up summary");
  await page.getByRole("menuitem", { name: /Highlight/ }).click();
  await expect(article(page).locator("mark.highlight")).toHaveCount(1);

  // Their page has a private note of the reader's own.
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("button", { name: "Add a note…" }).click();
  await page.getByRole("textbox", { name: `A note on Blog ${blog}` }).fill("Met at the spring fair");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Met at the spring fair")).toBeVisible();

  await page.goto(new URL(`/people/${id}/edit`, FEEDS_APP).href);
  await appReady(page);
  const unsubscribe = page.getByRole("button", { name: `Unsubscribe from Blog ${blog}` });
  await tabTo(page, unsubscribe);
  await page.keyboard.press("Enter");
  const question = page.getByRole("group", { name: `Keep what you saved from Blog ${blog}?` });
  await expect(question).toBeVisible();
  await expect(question).toContainText("You highlighted or noted 1 of their articles and wrote a note on them.");
  await expect(question.getByRole("button", { name: "Keep them" })).toBeFocused();
  await question.getByRole("button", { name: "Keep them" }).click();
  await expect(page.getByText(`Unsubscribed from Blog ${blog}.`)).toBeVisible();
});

test("Remove them too leaves them, with Undo", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same question on a phone");
  const blog = `notes-remove-${test.info().workerIndex}-${Date.now()}`;
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await openNewest(page, blog);
  await choose(page, "made-up summary");
  await page.getByRole("menuitem", { name: /Highlight/ }).click();
  await expect(article(page).locator("mark.highlight")).toHaveCount(1);

  await page.goto(new URL(`/people/${id}/edit`, FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("button", { name: `Unsubscribe from Blog ${blog}` }).click();
  const question = page.getByRole("group", { name: `Keep what you saved from Blog ${blog}?` });
  const asked = page.waitForRequest((request) => request.url().endsWith("/api/writers/unsubscribe") && request.postDataJSON()?.remove_kept === true);
  // Apart from Keep them and Cancel, naming exactly what goes (decision 0239).
  await expect(question.getByText("Or, if you don't want them any more:")).toBeVisible();
  await question.getByRole("button", { name: "Remove the highlighted or noted article too" }).click();
  await asked;
  await expect(page.getByText(`Unsubscribed from Blog ${blog}.`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
});
