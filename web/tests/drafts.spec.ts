import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, choose, follow, signIn } from "./screens";

// Nothing the reader typed is thrown away (decision 0233), in a browser: a
// half-written note survives going to another article, and Discard throws
// it away with Undo; a note that couldn't be saved keeps its words, with Try
// again; a note on highlighted words survives Escape; changes on Edit survive
// leaving, and Cancel throws them away; an address typed in Add survives
// Escape.

const article = (page: Page) => page.getByRole("region", { name: "Article", exact: true });
const button = (title: string) => new RegExp(title.replace(/[()]/g, "\\$&"));
const NEWEST = "On keeping a commonplace book (3)";
const OLDER = "Walking the long way home (2)";

async function openNewest(page: Page, blog: string): Promise<number> {
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${blog}/`);
  await page.goto(new URL(`/feeds/${id}`, FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("button", { name: button(NEWEST) }).first().click();
  await expect(article(page).getByRole("heading", { name: NEWEST })).toBeVisible();
  return id;
}

test("a half-written note waits for the reader's return, and Discard has Undo", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same box on a phone");
  await openNewest(page, `drafts-note-${test.info().workerIndex}-${Date.now()}`);
  await page.getByRole("heading", { name: NEWEST }).focus();
  await page.keyboard.press("n");
  await page.keyboard.type("Ask about the hedgerow survey");

  // The most ordinary slip: another article in the list.
  await page.getByRole("button", { name: button(OLDER) }).first().click();
  await expect(article(page).getByRole("heading", { name: OLDER })).toBeVisible();
  await page.getByRole("button", { name: button(NEWEST) }).first().click();
  const box = page.getByRole("textbox", { name: "A note on this article" });
  await expect(box).toHaveValue("Ask about the hedgerow survey");
  await expect(article(page).getByText("Kept from when you left this article.")).toBeVisible();

  // Discard throws it away, with Undo straight afterwards.
  await article(page).getByRole("button", { name: "Discard" }).click();
  await expect(box).toHaveCount(0);
  const undo = page.getByRole("button", { name: "Undo" });
  await expect(undo).toBeFocused();
  await undo.click();
  await expect(box).toHaveValue("Ask about the hedgerow survey");

  // Saved, it's no longer kept as a draft: coming back shows the note, not the box.
  await page.getByRole("button", { name: "Save" }).click();
  await expect(article(page).getByText("Ask about the hedgerow survey")).toBeVisible();
  await expect(box).toHaveCount(0);
  await page.reload();
  await appReady(page);
  await page.getByRole("button", { name: button(NEWEST) }).first().click();
  await expect(article(page).getByText("Ask about the hedgerow survey")).toBeVisible();
  await expect(box).toHaveCount(0);
});

test("a note that couldn't be saved keeps its words, and Try again saves them", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same box on a phone");
  await openNewest(page, `drafts-fail-${test.info().workerIndex}-${Date.now()}`);
  await page.getByRole("heading", { name: NEWEST }).focus();
  await page.keyboard.press("n");
  await page.keyboard.type("Lovely point about writing slowly");

  await page.route("**/api/articles/*/note", (route) => route.fulfill({ status: 500, json: { error: "trouble" } }));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(article(page).getByText("The note couldn't be saved, so your words are still here. Try again in a moment.")).toBeVisible();
  const box = page.getByRole("textbox", { name: "A note on this article" });
  await expect(box).toHaveValue("Lovely point about writing slowly");

  await page.unroute("**/api/articles/*/note");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(box).toHaveCount(0);
  await expect(article(page).getByText("Lovely point about writing slowly")).toBeVisible();
});

test("a note on highlighted words survives Escape, and waits at the article's end", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same menu on a phone");
  await openNewest(page, `drafts-highlight-${test.info().workerIndex}-${Date.now()}`);
  await choose(page, "made-up summary");
  await page.getByRole("menu", { name: "Chosen words" }).getByRole("menuitem", { name: /Highlight/ }).click();
  await page.getByRole("menu", { name: "Highlight" }).getByRole("menuitem", { name: "Add a note…" }).click();
  await page.keyboard.type("Compare with the spring list");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Add a note" })).toHaveCount(0);

  // Opened again in place, the box starts with the words and says they're not saved yet.
  const ends = article(page).getByRole("list", { name: "Your highlights" });
  await ends.getByRole("button", { name: "Add a note on “made-up summary”" }).click();
  const menuBox = page.getByRole("textbox", { name: "A note on these words" });
  await expect(menuBox).toHaveValue("Compare with the spring list");
  await expect(page.getByText("Not saved yet.")).toBeVisible();
  // What's typed there is kept too, however the box was opened.
  await page.keyboard.type(", and the autumn one");
  await page.keyboard.press("Escape");

  // Coming back to the article, its box is open at the end, under the highlight.
  await page.getByRole("button", { name: button(OLDER) }).first().click();
  await page.getByRole("button", { name: button(NEWEST) }).first().click();
  await expect(ends.getByRole("textbox", { name: "A note on these words" })).toHaveValue("Compare with the spring list, and the autumn one");
  await ends.getByRole("button", { name: "Save" }).click();
  await expect(ends.getByText("Compare with the spring list, and the autumn one")).toBeVisible();
  await expect(ends.getByRole("textbox")).toHaveCount(0);
});

test("changes on Edit survive leaving, and Cancel throws them away", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same page on a phone");
  const blog = `drafts-edit-${test.info().workerIndex}-${Date.now()}`;
  const id = await openNewest(page, blog);
  await page.goto(new URL(`/people/${id}/edit`, FEEDS_APP).href);
  await appReady(page);
  const name = page.getByRole("textbox", { name: "Name" });
  await name.fill("Asha Rao, garden letters");

  // Escape leaves Edit for their page; Edit there brings the changes back.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { level: 2, name: `Edit Blog ${blog}` })).toHaveCount(0);
  await page.getByRole("button", { name: `Edit Blog ${blog}`, exact: true }).click();
  await expect(name).toHaveValue("Asha Rao, garden letters");
  await expect(page.getByText("Going elsewhere keeps these changes here for you.")).toBeVisible();

  // So does a reload.
  await page.reload();
  await appReady(page);
  await expect(name).toHaveValue("Asha Rao, garden letters");
  await expect(page.getByText("Going elsewhere keeps these changes here for you.")).toBeVisible();

  // Cancel is the one way to throw them away.
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.goto(new URL(`/people/${id}/edit`, FEEDS_APP).href);
  await appReady(page);
  await expect(name).toHaveValue(`Blog ${blog}`);
  await expect(page.getByText("Not saved yet.")).toHaveCount(0);
});

test("an address typed in Add waits there after Escape, and Cancel clears it", async ({ page, isMobile }) => {
  test.skip(isMobile, "on a phone, Add is a screen of its own");
  await page.goto("/unread");
  await appReady(page);
  await signIn(page);
  await page.keyboard.press("a");
  const sheet = page.getByRole("dialog", { name: "Add a person or publication" });
  await sheet.getByLabel("Their website's address").fill("gardenletters.example");
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);

  await page.keyboard.press("a");
  await expect(sheet.getByLabel("Their website's address")).toHaveValue("gardenletters.example");
  await sheet.getByRole("button", { name: "Cancel" }).click();
  await page.keyboard.press("a");
  await expect(sheet.getByLabel("Their website's address")).toHaveValue("");
});
