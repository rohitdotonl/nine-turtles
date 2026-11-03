import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn, tabTo } from "./screens";

// SPEC section 42 (decision 0161), "How to check it", in a browser: words
// chosen in an article are highlighted from the small menu beside them, a
// note is written on the whole article with Shift+H, both show at the
// article's end and stay after a reload; Notes appears in the sidebar and
// lists the article with its highlight; search finds it by the note's words;
// without a connection a highlight is still made, with the quiet line until
// it's sent; and unsubscribing asks whether to keep what was saved.

const article = (page: Page) => page.getByRole("region", { name: "Article" });
const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });
const NEWEST = "On keeping a commonplace book (3)";

/** Chooses `words` in the open article's text, as a reader does with the mouse. */
async function choose(page: Page, words: string): Promise<void> {
  await page.evaluate((wanted) => {
    const text = document.querySelector(".article-text")!;
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = (node as Text).data.indexOf(wanted);
      if (at === -1) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + wanted.length);
      getSelection()!.removeAllRanges();
      getSelection()!.addRange(range);
      text.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      return;
    }
    throw new Error(`"${wanted}" isn't in the article`);
  }, words);
}

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
  const ends = article(page).getByRole("list", { name: "Your highlights" });
  await expect(ends.getByRole("button", { name: "made-up summary", exact: true })).toBeVisible();

  // Shift+H with nothing chosen: a note on the whole article, at its end.
  await page.getByRole("heading", { name: NEWEST }).focus();
  await page.keyboard.press("Shift+H");
  const box = page.getByRole("textbox", { name: "A note on this article" });
  await expect(box).toBeFocused();
  await page.keyboard.type("Ask about the hedgerow survey");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(article(page).getByText("Ask about the hedgerow survey")).toBeVisible();

  // Both are kept: after a reload they're there, and Notes is in the sidebar.
  await page.reload();
  await appReady(page);
  await page.getByRole("button", { name: new RegExp(NEWEST.replace(/[()]/g, "\\$&")) }).first().click();
  await expect(article(page).locator("mark.highlight")).toHaveText("made-up summary");
  await expect(article(page).getByText("Ask about the hedgerow survey")).toBeVisible();
  const notes = sidebar(page).getByRole("link", { name: "Notes", exact: true });
  await expect(notes).toBeVisible();
  await notes.click();
  await expect(page.getByText("Highlighted · made-up summary").first()).toBeVisible();

  // Search finds the article by its note's words.
  await page.keyboard.press("/");
  await page.keyboard.type("hedgerow is:noted ");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Your note · .*hedgerow/).first()).toBeVisible();
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

  await page.goto(new URL(`/feeds/${id}/edit`, FEEDS_APP).href);
  await appReady(page);
  const unsubscribe = page.getByRole("button", { name: `Unsubscribe from Blog ${blog}` });
  await tabTo(page, unsubscribe);
  await page.keyboard.press("Enter");
  const question = page.getByRole("group", { name: `Keep what you saved from Blog ${blog}?` });
  await expect(question).toBeVisible();
  await expect(question).toContainText("You highlighted or noted 1 of their article.");
  await expect(question.getByRole("button", { name: "Keep them" })).toBeFocused();
  await question.getByRole("button", { name: "Keep them" }).click();
  await expect(page.getByText(`Unsubscribed from Blog ${blog}`)).toBeVisible();
});
