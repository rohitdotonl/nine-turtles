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

/**
 * Signed in, on a new blog's newest article, with a new highlight's save
 * answering late (or refused), as on a busy server. `answered` says whether
 * the save has answered yet; `saved` is its answer. Refused, saves after it
 * are refused too until the test says otherwise (`refuse`). `first` runs on
 * the article before the highlight is made.
 */
async function slowSaves(page: Page, name: string, refuse = false, first?: () => Promise<void>) {
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await openNewest(page, `${name}-${test.info().workerIndex}-${Date.now()}`);
  await first?.();
  const save = { refuse, answered: false };
  await page.route(/\/api\/articles\/\d+\/highlights$/, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await new Promise((done) => setTimeout(done, 2500));
    await (save.refuse ? route.fulfill({ status: 500, body: "" }) : route.continue());
    save.answered = true;
  });
  const saved = page.waitForResponse((answer) => /\/highlights$/.test(answer.url()) && answer.request().method() === "POST");
  await choose(page, "for article");
  await page.keyboard.press("h");
  await page.keyboard.press("Escape");
  return { ends: article(page).getByRole("list", { name: "Your highlights" }), save, saved };
}

/** The next change to a highlight reaching the server, under its own number (never a stand-in's, which is below zero). */
function onServer(page: Page, change: "note" | "remove") {
  const address = change === "note" ? /\/api\/highlights\/\d+$/ : /\/api\/highlights\/\d+\/delete$/;
  return page.waitForResponse((answer) => address.test(answer.url()) && answer.request().method() === "POST");
}

async function reopen(page: Page) {
  await page.reload();
  await appReady(page);
  await expect(article(page).getByRole("heading", { name: NEWEST })).toBeVisible();
}

/** A note written on words chosen in the article, left unsaved with Not now. */
async function leaveNoteOnWords(page: Page, words: string, note: string) {
  await choose(page, words);
  await page.getByRole("menu", { name: "Chosen words" }).getByRole("menuitem", { name: "Add a note…" }).click();
  await page.getByRole("textbox", { name: "A note on these words" }).fill(note);
  await page.getByRole("button", { name: "Not now" }).click();
}

const highlightSave = (page: Page) => page.waitForResponse((answer) => /\/api\/articles\/\d+\/highlights$/.test(answer.url()) && answer.request().method() === "POST");

/**
 * Signed in, on a new blog's newest article, "for article" highlighted with
 * h: the server saves it, but its answer never reaches the page, as when the
 * page is reloaded that instant. It waits on the device to be sent again.
 */
async function answerLost(page: Page, name: string) {
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await openNewest(page, `${name}-${test.info().workerIndex}-${Date.now()}`);
  let lost = false;
  await page.route(/\/api\/articles\/\d+\/highlights$/, async (route) => {
    if (route.request().method() !== "POST" || lost) return route.continue();
    lost = true;
    expect((await route.fetch()).status()).toBe(201);
    await route.abort("internetdisconnected");
  });
  await choose(page, "for article");
  await page.keyboard.press("h");
  await expect(page.getByText("You're offline.", { exact: false })).toBeVisible();
  await page.keyboard.press("Escape");
}

/** The browser says it's online again: the app asks the server, and sends what's waiting. */
async function backOnline(page: Page) {
  await page.evaluate(() => dispatchEvent(new Event("online")));
}

test.describe("a highlight sent twice is saved once (decision 0255)", () => {
  test.skip(({ isMobile }) => isMobile, "the keys are the computer's; the phone does the same");

  test("its answer lost as the page reloads, it's sent again after and kept once", async ({ page }) => {
    await answerLost(page, "twice");
    // Kept on the device, it's sent again once the page is back, and the server knows it.
    const again = highlightSave(page);
    await reopen(page);
    expect((await again).status()).toBe(201);
    await expect(article(page).locator("mark.highlight")).toHaveCount(1);
    await expect(page.getByText("You're offline.", { exact: false })).toHaveCount(0);
    await reopen(page);
    await expect(article(page).locator("mark.highlight")).toHaveCount(1);
    await expect(article(page).getByRole("list", { name: "Your highlights" }).getByRole("listitem")).toHaveCount(1);
  });

  test("words with a note kept on them, highlighted with h: Save puts the note on that highlight", async ({ page }) => {
    await page.goto(new URL("/all", FEEDS_APP).href);
    await appReady(page);
    await signIn(page);
    await openNewest(page, `kept-then-h-${test.info().workerIndex}-${Date.now()}`);
    await leaveNoteOnWords(page, "for article", "Kept on the words");
    await reopen(page);
    await expect(page.getByRole("textbox", { name: "A note on these words" })).toHaveValue("Kept on the words");
    const made = highlightSave(page);
    await choose(page, "for article");
    await page.keyboard.press("h");
    expect((await made).status()).toBe(201);
    await page.keyboard.press("Escape");
    // The kept box is now the highlight's: Save notes it, and highlights nothing again.
    const noted = onServer(page, "note");
    await article(page).getByRole("button", { name: "Save" }).click();
    expect((await noted).ok()).toBe(true);
    const ends = article(page).getByRole("list", { name: "Your highlights" });
    await expect(ends.getByText("Kept on the words")).toBeVisible();
    await reopen(page);
    await expect(article(page).locator("mark.highlight")).toHaveCount(1);
    await expect(ends.getByText("Kept on the words")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "A note on these words" })).toHaveCount(0);
  });
  test("its answer lost, a note written on it while it waits is saved once it's sent again", async ({ page }) => {
    await answerLost(page, "twice-note");
    const ends = article(page).getByRole("list", { name: "Your highlights" });
    await ends.getByRole("button", { name: "Add a note on “for article”" }).click();
    await page.getByRole("textbox", { name: "A note on these words" }).fill("Written while waiting");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(ends.getByText("Written while waiting")).toBeVisible();
    const noted = onServer(page, "note");
    await backOnline(page);
    expect((await noted).ok()).toBe(true);
    await reopen(page);
    await expect(article(page).locator("mark.highlight")).toHaveCount(1);
    await expect(ends.getByText("Written while waiting")).toBeVisible();
  });

  test("its answer lost, removed while it waits, it's removed on the server too", async ({ page }) => {
    await answerLost(page, "twice-remove");
    const ends = article(page).getByRole("list", { name: "Your highlights" });
    await ends.getByRole("button", { name: "Remove highlight “for article”" }).click();
    await expect(article(page).locator("mark.highlight")).toHaveCount(0);
    const removed = onServer(page, "remove");
    await backOnline(page);
    expect((await removed).ok()).toBe(true);
    await reopen(page);
    await expect(article(page).locator("mark.highlight")).toHaveCount(0);
  });

  test("a kept note's Save pressed while h is still saving its words puts the note on that highlight", async ({ page }) => {
    await page.goto(new URL("/all", FEEDS_APP).href);
    await appReady(page);
    await signIn(page);
    await openNewest(page, `kept-then-slow-h-${test.info().workerIndex}-${Date.now()}`);
    await leaveNoteOnWords(page, "for article", "Saved while it saves");
    await reopen(page);
    await page.route(/\/api\/articles\/\d+\/highlights$/, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await new Promise((done) => setTimeout(done, 2500));
      await route.continue();
    });
    let saves = 0;
    page.on("request", (request) => {
      if (/\/api\/articles\/\d+\/highlights$/.test(request.url()) && request.method() === "POST") saves += 1;
    });
    await choose(page, "for article");
    await page.keyboard.press("h");
    await page.keyboard.press("Escape");
    const noted = onServer(page, "note");
    await article(page).getByRole("button", { name: "Save" }).click();
    expect((await noted).ok()).toBe(true);
    expect(saves).toBe(1);
    await expect(page.getByRole("textbox", { name: "A note on these words" })).toHaveCount(0);
    const ends = article(page).getByRole("list", { name: "Your highlights" });
    await reopen(page);
    await expect(article(page).locator("mark.highlight")).toHaveCount(1);
    await expect(ends.getByText("Saved while it saves")).toBeVisible();
  });

  test("a kept note's Save refused, on words h is still saving, keeps its words for later", async ({ page }) => {
    await page.goto(new URL("/all", FEEDS_APP).href);
    await appReady(page);
    await signIn(page);
    await openNewest(page, `kept-refused-${test.info().workerIndex}-${Date.now()}`);
    await leaveNoteOnWords(page, "for article", "Not to be lost");
    await reopen(page);
    await page.route(/\/api\/articles\/\d+\/highlights$/, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await new Promise((done) => setTimeout(done, 2500));
      await route.continue();
    });
    await page.route(/\/api\/highlights\/\d+$/, (route) => route.fulfill({ status: 500, body: "" }));
    const made = highlightSave(page);
    await choose(page, "for article");
    await page.keyboard.press("h");
    await page.keyboard.press("Escape");
    await article(page).getByRole("button", { name: "Save" }).click();
    expect((await made).status()).toBe(201);
    await expect(page.getByText("The note couldn't be saved, so your words are still here.")).toBeVisible();
    await page.getByRole("button", { name: "Not now" }).click();
    await page.unroute(/\/api\/highlights\/\d+$/);
    await reopen(page);
    await expect(article(page).locator("mark.highlight")).toHaveCount(1);
    await expect(page.getByRole("textbox", { name: "A note on these words" })).toHaveValue("Not to be lost");
  });

  test("its answer lost, a note left unsaved on it is back after a reload", async ({ page }) => {
    await answerLost(page, "twice-left");
    const ends = article(page).getByRole("list", { name: "Your highlights" });
    await ends.getByRole("button", { name: "Add a note on “for article”" }).click();
    await page.getByRole("textbox", { name: "A note on these words" }).fill("Left while waiting");
    await page.getByRole("button", { name: "Not now" }).click();
    await reopen(page);
    await expect(article(page).locator("mark.highlight")).toHaveCount(1);
    await expect(page.getByRole("textbox", { name: "A note on these words" })).toHaveValue("Left while waiting");
  });
});

test.describe("a highlight still being saved", () => {
  test.skip(({ isMobile }) => isMobile, "the keys are the computer's; the phone uses the same menu");

  test("removed at once, it goes, with Undo, and stays gone", async ({ page }) => {
    const { ends, save } = await slowSaves(page, "slow-remove");
    const removed = onServer(page, "remove");
    await ends.getByRole("button", { name: "Remove highlight “for article”" }).click();
    expect(save.answered).toBe(false);
    await expect(article(page).locator("mark.highlight")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Undo" })).toBeFocused();
    expect((await removed).ok()).toBe(true);
    await expect(page.getByText("couldn't be removed")).toHaveCount(0);
    await reopen(page);
    await expect(article(page).locator("mark.highlight")).toHaveCount(0);
  });

  for (const when of ["before", "after"] as const) {
    test(`a note on it, saved ${when} its save answers, is kept`, async ({ page }) => {
      const { ends, save, saved } = await slowSaves(page, `slow-note-${when}`);
      await ends.getByRole("button", { name: "Add a note on “for article”" }).click();
      await page.getByRole("textbox", { name: "A note on these words" }).fill(`Saved ${when}`);
      // After: the box, opened with the stand-in, is still there when the save answers.
      if (when === "after") await saved;
      const noted = onServer(page, "note");
      await page.getByRole("button", { name: "Save" }).click();
      expect(save.answered).toBe(when === "after");
      await expect(ends.getByText(`Saved ${when}`)).toBeVisible();
      expect((await noted).ok()).toBe(true);
      await expect(page.getByText("couldn't be saved")).toHaveCount(0);
      await reopen(page);
      await expect(article(page).locator("mark.highlight")).toHaveCount(1);
      await expect(ends.getByText(`Saved ${when}`)).toBeVisible();
    });
  }

  test("refused, removed meanwhile, it's simply gone", async ({ page }) => {
    const { ends, save, saved } = await slowSaves(page, "slow-refused-remove", true);
    await ends.getByRole("button", { name: "Remove highlight “for article”" }).click();
    expect(save.answered).toBe(false);
    await saved;
    await expect(article(page).locator("mark.highlight")).toHaveCount(0);
    await expect(page.getByText("couldn't be removed")).toHaveCount(0);
    await reopen(page);
    await expect(article(page).locator("mark.highlight")).toHaveCount(0);
  });

  test("refused, a note saved on it meanwhile keeps its words, and Try again highlights them with it", async ({ page }) => {
    const { ends, save } = await slowSaves(page, "slow-refused-note", true);
    await ends.getByRole("button", { name: "Add a note on “for article”" }).click();
    const box = page.getByRole("textbox", { name: "A note on these words" });
    await box.fill("Words worth keeping");
    await page.getByRole("button", { name: "Save" }).click();
    expect(save.answered).toBe(false);
    // Highlighting it again is refused too: the words stay, with why, and Try again.
    const again = page.getByRole("button", { name: "Try again" });
    await expect(again).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("The highlight couldn't be saved.")).not.toHaveCount(0);
    await expect(box).toHaveValue("Words worth keeping");
    // The server takes it now: Try again highlights the words, with the note.
    save.refuse = false;
    const made = page.waitForResponse((answer) => /\/highlights$/.test(answer.url()) && answer.status() === 201);
    await again.click();
    expect((await made).ok()).toBe(true);
    await expect(ends.getByText("Words worth keeping")).toBeVisible();
    await reopen(page);
    await expect(article(page).locator("mark.highlight")).toHaveCount(1);
    await expect(ends.getByText("Words worth keeping")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "A note on these words" })).toHaveCount(0);
  });

  test("refused, a note left unsaved on it comes back on its words, and Save highlights them with it", async ({ page }) => {
    const { ends, saved } = await slowSaves(page, "slow-refused-left", true);
    await ends.getByRole("button", { name: "Add a note on “for article”" }).click();
    await page.getByRole("textbox", { name: "A note on these words" }).fill("Kept for later");
    await saved;
    await page.getByRole("button", { name: "Not now" }).click();
    await page.unroute(/\/api\/articles\/\d+\/highlights$/);
    await reopen(page);
    const box = page.getByRole("textbox", { name: "A note on these words" });
    await expect(box).toHaveValue("Kept for later");
    const made = page.waitForResponse((answer) => /\/highlights$/.test(answer.url()) && answer.request().method() === "POST");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(ends.getByText("Kept for later")).toBeVisible();
    expect((await made).ok()).toBe(true);
    await reopen(page);
    await expect(article(page).locator("mark.highlight")).toHaveCount(1);
    await expect(ends.getByText("Kept for later")).toBeVisible();
  });

  test("refused, a note left unsaved on it comes back beside one already kept on other words", async ({ page }) => {
    const { ends, saved } = await slowSaves(page, "slow-refused-two", true, () => leaveNoteOnWords(page, "made-up summary", "On other words"));
    await ends.getByRole("button", { name: "Add a note on “for article”" }).click();
    await page.getByRole("textbox", { name: "A note on these words" }).fill("Kept for later");
    await saved;
    await page.getByRole("button", { name: "Not now" }).click();
    await page.unroute(/\/api\/articles\/\d+\/highlights$/);
    await reopen(page);
    const boxes = page.getByRole("textbox", { name: "A note on these words" });
    await expect(boxes).toHaveCount(2);
    expect((await boxes.evaluateAll((all) => all.map((box) => (box as HTMLTextAreaElement).value))).sort()).toEqual(["Kept for later", "On other words"]);
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
