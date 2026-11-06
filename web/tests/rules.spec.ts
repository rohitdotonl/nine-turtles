import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn, tabTo } from "./screens";

// SPEC section 27: hiding articles about… Each run follows a blog of its own
// and keeps its rules to that blog, so tests running side by side never
// meet. The test nine turtles checks every feed every two seconds, so a rule
// can be seen acting on an article as it arrives.

const article = (page: Page) => page.getByRole("region", { name: "Article", exact: true });
const editor = (page: Page, name: string) => page.getByRole("dialog", { name }).or(page.getByRole("region", { name }));

test("Hide articles about… from someone's page hides what matches, asks first, and Hidden articles brings it back", async ({ page }) => {
  const name = `rules-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/`);

  // Their page › Hide articles about…: Settings › Hiding, the sentence set to them.
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("button", { name: "Hide articles about…" }).click();
  await expect(page).toHaveURL(/\/settings\/hiding$/);
  const sheet = editor(page, "Hide articles");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("combobox", { name: "From" })).toHaveValue(String(id));

  // Nothing to hide is refused in words.
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet.getByRole("status")).toHaveText("Write a word or phrase to hide articles about.");

  // One sentence whose blanks are named fields, each 44px to press (decision 0123).
  for (const blank of [sheet.getByRole("textbox", { name: "About" }), sheet.getByRole("combobox", { name: "From" })]) {
    expect((await blank.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await sheet.getByRole("textbox", { name: "About" }).fill("Long Way");
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();

  // The sentence, and the question about what's already here, with the number first.
  const rules = page.getByRole("region", { name: "Hiding" }).last();
  await expect(rules).toContainText(`Hide articles about “Long Way” from ${title}.`);
  await expect(rules.getByRole("status")).toContainText("Also hide the 1 unread article that matches?");
  await rules.getByRole("button", { name: "Hide them" }).click();
  await expect(rules.getByRole("status")).toContainText("Hid 1 article.");
  await expect(rules.getByRole("button", { name: "Undo" })).toBeFocused();

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

test("an article's More menu starts the same sentence, set to whoever wrote it", async ({ page }) => {
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
  const sheet = editor(page, "Hide articles");
  await expect(sheet.getByRole("combobox", { name: "From" })).toHaveValue(String(id));
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});

test("a rule hides an article as it arrives; rules pause, and Delete has Undo", async ({ page }) => {
  const name = `rules-new-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  await page.goto(new URL("/settings/hiding", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/`);
  await page.reload();
  await appReady(page);

  const rules = page.getByRole("region", { name: "Hiding" }).last();
  await rules.getByRole("button", { name: "Hide articles about…" }).click();
  const sheet = editor(page, "Hide articles");
  // Escape closes it unchanged, and Hiding stays.
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("heading", { name: "Hiding", level: 2 })).toBeVisible();

  await rules.getByRole("button", { name: "Hide articles about…" }).click();
  await sheet.getByRole("textbox", { name: "About" }).fill("river");
  await sheet.getByRole("combobox", { name: "From" }).selectOption(String(id));
  await sheet.getByRole("button", { name: "Save" }).click();
  const sentence = `Hide articles about “river” from ${title}.`;
  await expect(rules).toContainText(sentence);
  await expect(rules.getByRole("status")).toContainText("Rule saved. New articles about it are hidden as they arrive.");

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

  // Its switch pauses it, saying so in words.
  const on = rules.getByRole("switch", { name: `On: ${sentence}` });
  await expect(on).toBeChecked();
  // The switch flips at once; wait for the server to keep it before reloading.
  const kept = page.waitForResponse((answer) => answer.url().endsWith("/paused") && answer.ok());
  await on.click();
  await expect(on).not.toBeChecked();
  await expect(rules).toContainText(`${sentence} Paused.`);
  await kept;
  await page.reload();
  await appReady(page);
  await expect(rules.getByRole("switch", { name: `On: ${sentence}` })).not.toBeChecked();

  // Edit › Delete: gone at once, with Undo bringing it back as it was.
  await rules.getByRole("button", { name: `Edit: ${sentence}` }).click();
  const editing = editor(page, "Edit");
  await editing.getByRole("button", { name: "Delete" }).click();
  await expect(rules.getByRole("status")).toContainText("Rule deleted.");
  await expect(rules).not.toContainText(sentence);
  await rules.getByRole("button", { name: "Undo" }).click();
  await expect(rules.getByRole("status")).toContainText("Undone.");
  await expect(rules).toContainText(`${sentence} Paused.`);
});

test("with the keyboard alone: a new rule, its switch, and Not now keep the keyboard's place", async ({ page }) => {
  const name = `rules-keys-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  await page.goto(new URL("/settings/hiding", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/`);
  await page.reload();
  await appReady(page);

  const rules = page.getByRole("region", { name: "Hiding" }).last();
  // Past every feed the other tests have added to the sidebar, then Settings' rows.
  await tabTo(page, rules.getByRole("button", { name: "Hide articles about…" }), 200);
  await page.keyboard.press("Enter");
  const sheet = editor(page, "Hide articles");
  await expect(sheet.getByRole("heading", { name: "Hide articles" })).toBeFocused();
  await tabTo(page, sheet.getByRole("textbox", { name: "About" }));
  await page.keyboard.type("commonplace");
  await tabTo(page, sheet.getByRole("combobox", { name: "From" }));
  await sheet.getByRole("combobox", { name: "From" }).selectOption(String(id));
  await tabTo(page, sheet.getByRole("button", { name: "Save" }));
  await page.keyboard.press("Enter");
  await expect(sheet).toBeHidden();

  // "On keeping a commonplace book (3)" already matches: the question takes the keyboard.
  await expect(rules.getByRole("button", { name: "Hide them" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(rules.getByRole("button", { name: "Not now" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#rules-heading")).toBeFocused();

  const sentence = `Hide articles about “commonplace” from Blog ${name}.`;
  const on = rules.getByRole("switch", { name: `On: ${sentence}` });
  await tabTo(page, on);
  await page.keyboard.press("Space");
  await expect(on).not.toBeChecked();
  await expect(rules).toContainText(`${sentence} Paused.`);
});

test("on a phone, the back gesture closes the editor and stays in Hiding", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "Only a phone's editor is a screen of its own.");
  await page.goto(new URL("/settings/hiding", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await page.getByRole("button", { name: "Hide articles about…" }).click();
  await expect(page.getByRole("heading", { name: "Hide articles", level: 2 })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Hide articles", level: 2 })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Hiding", level: 2 })).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/hiding$/);
});
