import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn, tabTo } from "./screens";

// SPEC section 27: hiding articles about… Each run follows a blog of its own
// and keeps its rules to that blog, so tests running side by side never
// meet. The test nine turtles checks every feed every two seconds, so a rule
// can be seen acting on an article as it arrives.

const article = (page: Page) => page.getByRole("region", { name: "Article", exact: true });
const field = (page: Page) => page.getByRole("textbox", { name: /^Hide articles (from .+ )?about$/ });

test("Hide articles about… from someone's page hides what matches at once, and Hidden articles brings it back", async ({ page }) => {
  const name = `rules-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/`);

  // Their page › Hide articles about…: Settings › Hiding, the field set to them and waiting.
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("button", { name: "Hide articles about…" }).click();
  await expect(page).toHaveURL(/\/settings\/hiding$/);
  const rules = page.getByRole("region", { name: "Hiding" }).last();
  await expect(page.getByRole("textbox", { name: `Hide articles from ${title} about` })).toBeFocused();
  await expect(rules).toContainText(`Only from ${title}`);

  // Nothing to hide is refused in words, and the field says so.
  await rules.getByRole("button", { name: "Add" }).click();
  await expect(rules).toContainText("Type a word or phrase first.");
  await expect(field(page)).toHaveAttribute("aria-invalid", "true");

  // For good is the usual choice. Adding hides at once what's unread and about it, with no question first.
  await expect(rules.getByRole("radio", { name: "For good" })).toBeChecked();
  await field(page).fill("Long Way");
  await page.keyboard.press("Enter");
  await expect(rules.getByRole("status")).toContainText("Hid 1 unread article about “Long Way”.");
  await expect(field(page)).toBeFocused();
  await expect(field(page)).toHaveValue("");
  // Its row: the word, then whose and how long, and Remove, 44px to press.
  const remove = rules.getByRole("button", { name: `Remove “Long Way”, ${title} · for good` });
  await expect(remove).toBeVisible();
  expect((await remove.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // The same word again says so, and adds nothing.
  await field(page).fill("long way");
  await page.keyboard.press("Enter");
  await expect(rules.getByRole("status")).toContainText("“long way” is already hidden.");
  await field(page).fill("");

  // It's gone from their list, but kept: Hidden articles lists it.
  const listed = await page.request.get(new URL(`/api/articles?feed=${id}`, FEEDS_APP).href);
  const titles = ((await listed.json()).articles as { title: string }[]).map((article) => article.title);
  expect(titles).not.toContain("Walking the long way home (2)");
  expect(titles).toHaveLength(2);

  await page.getByRole("link", { name: "Hidden articles" }).click();
  await expect(page).toHaveURL(/\/settings\/hidden$/);
  await expect(page.getByRole("heading", { name: "Hidden articles", level: 2 })).toBeVisible();
  // Two pages down, Escape steps back one page at a time, each to the row that opened it, in history (decision 0120).
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/settings\/hiding$/);
  await expect(page.getByRole("link", { name: "Hidden articles" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.locator('[data-settings-row="hiding"]')).toBeFocused();
  // Hiding opened from Settings, then Back and Forward onto it: its Escape is still a step back in
  // history, so Forward finds Hiding again rather than a second Settings.
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/settings\/hiding$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/settings$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/settings\/hiding$/);
  await expect(page.getByRole("heading", { name: "Hiding", level: 2 })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/settings$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/settings\/hiding$/);
  await page.getByRole("link", { name: "Hidden articles" }).click();
  await expect(page).toHaveURL(/\/settings\/hidden$/);
  const hidden = page.getByRole("listitem").filter({ hasText: "Walking the long way home (2)" }).filter({ hasText: title });
  await expect(hidden).toBeVisible();
  await hidden.getByRole("button", { name: "Unhide Walking the long way home (2)" }).click();
  await expect(hidden.getByRole("status")).toHaveText("Unhidden. It's back in your lists, unread.");
  // Nothing moves: it stays, with Undo.
  await expect(hidden.getByRole("button", { name: "Undo unhiding Walking the long way home (2)" })).toBeFocused();

  // Escape goes back to Hiding (decision 0120).
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Hiding", level: 2 })).toBeVisible();
});

test("an article's More menu starts the same word, set to whoever wrote it", async ({ page }) => {
  const name = `rules-more-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/`);
  await page.goto(new URL(`/people/${id}`, FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("button", { name: /On keeping a commonplace book \(3\)/ }).first().click();
  await article(page).getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Hide articles about…" }).click();
  await expect(page).toHaveURL(/\/settings\/hiding$/);
  await expect(page.getByRole("textbox", { name: `Hide articles from Blog ${name} about` })).toBeFocused();
  // Everyone instead: the word is for everyone again.
  await page.getByRole("button", { name: "Everyone instead" }).click();
  await expect(page.getByRole("textbox", { name: "Hide articles about", exact: true })).toBeVisible();
});

test("a word hides an article as it arrives; a week says so, and Remove has Undo", async ({ page }) => {
  const name = `rules-new-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  await page.goto(new URL("/settings/hiding", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/`);
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("button", { name: "Hide articles about…" }).click();

  const rules = page.getByRole("region", { name: "Hiding" }).last();
  await rules.getByRole("radio", { name: "For a week" }).check();
  await field(page).fill("river");
  await rules.getByRole("button", { name: "Add" }).click();
  await expect(rules.getByRole("status")).toContainText("Hiding “river”, for a week. Nothing unread is about it yet.");
  // Back to For good for the next word.
  await expect(rules.getByRole("radio", { name: "For good" })).toBeChecked();
  const line = `${title} · 7 days left`;
  await expect(rules.getByRole("button", { name: `Remove “river”, ${line}` })).toBeVisible();

  // The blog publishes "What the river taught me (4)": it arrives hidden.
  expect((await page.request.get(`${FEED_SITE}/grow/${name}`)).ok()).toBe(true);
  await expect
    .poll(
      async () => {
        const answer = await page.request.get(new URL("/api/muted", FEEDS_APP).href);
        const articles = (await answer.json()).articles as { title: string; feed_id?: number }[];
        return articles.some((article) => article.title === "What the river taught me (4)");
      },
      { timeout: 30_000 },
    )
    .toBe(true);

  // No switch and no Edit: Remove, at once, with Undo bringing it back for the time it had left.
  await expect(rules.getByRole("switch")).toHaveCount(0);
  await expect(rules.getByRole("button", { name: /^Edit/ })).toHaveCount(0);
  await rules.getByRole("button", { name: `Remove “river”, ${line}` }).click();
  await expect(rules.getByRole("status")).toContainText("Removed “river”.");
  await expect(rules).not.toContainText(line);
  await rules.getByRole("button", { name: "Undo" }).click();
  await expect(rules.getByRole("status")).toContainText("“river” is back.");
  await expect(rules.getByRole("button", { name: `Remove “river”, ${line}` })).toBeVisible();
});

test("with the keyboard alone: a word added, then undone, keeps the keyboard's place", async ({ page }) => {
  const name = `rules-keys-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  await page.goto(new URL("/settings/hiding", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/`);
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("button", { name: "Hide articles about…" }).click();

  const rules = page.getByRole("region", { name: "Hiding" }).last();
  await expect(field(page)).toBeFocused();
  await page.keyboard.type("commonplace");
  await tabTo(page, rules.getByRole("button", { name: "Add" }));
  await page.keyboard.press("Enter");
  // "On keeping a commonplace book (3)" already matched: hidden at once.
  await expect(rules.getByRole("status")).toContainText("Hid 1 unread article about “commonplace”.");
  await expect(field(page)).toBeFocused();
  await tabTo(page, rules.getByRole("button", { name: "Undo" }));
  await page.keyboard.press("Enter");
  await expect(rules.getByRole("status")).toContainText("Put back the article about “commonplace”. It's no longer hidden.");
  await expect(field(page)).toBeFocused();
  const listed = await page.request.get(new URL(`/api/articles?feed=${id}&view=unread`, FEEDS_APP).href);
  expect(((await listed.json()).articles as unknown[]).length).toBe(3);
});
