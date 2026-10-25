import { expect, test } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// SPEC section 27: rules and mutes. Each run follows a blog of its own and
// keeps its rules to that blog, so tests running side by side never meet.
// The test nine turtles checks every feed every two seconds, so a rule can
// be seen acting on an article as it arrives.

test("a rule made from Edit feed mutes what matches, with the number asked first, and Muted articles brings it back", async ({ page }) => {
  const name = `rules-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/`);

  // Edit feed › Add a rule for this feed…: Settings, with the rule sheet set to this feed.
  await page.goto(new URL(`/feeds/${id}/edit`, FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("button", { name: "Add a rule for this feed…" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  const sheet = page.getByRole("dialog", { name: "New rule" }).or(page.getByRole("region", { name: "New rule" }));
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("combobox", { name: "In" })).toHaveValue(`feed:${id}`);

  // Nothing to look for is refused in words.
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet.getByRole("status")).toHaveText("Write a word, a phrase or an author to look for.");

  await sheet.getByRole("textbox", { name: "Word or phrase" }).fill("Long Way");
  await sheet.getByRole("radio", { name: /^Mute/ }).check();
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();

  // One plain sentence, and the question about what's already here, with the number first.
  const rules = page.getByRole("region", { name: "Rules" });
  await expect(rules).toContainText(`Mute articles with “Long Way” in the title, in ${title}.`);
  await expect(rules.getByRole("status")).toContainText("Also mute the 1 unread article that matches?");
  await rules.getByRole("button", { name: "Mute them" }).click();
  await expect(rules.getByRole("status")).toContainText("Muted 1 article.");
  await expect(rules.getByRole("button", { name: "Undo" })).toBeFocused();

  // It's gone from the feed's list, but kept: Settings › Muted articles lists it.
  const listed = await page.request.get(new URL(`/api/articles?feed=${id}`, FEEDS_APP).href);
  const titles = ((await listed.json()).articles as { title: string }[]).map((article) => article.title);
  expect(titles).not.toContain("Walking the long way home (2)");
  expect(titles).toHaveLength(2);

  await page.getByRole("link", { name: /Muted articles/ }).click();
  await expect(page).toHaveURL(/\/settings\/muted$/);
  await expect(page.getByRole("heading", { name: "Muted articles", level: 2 })).toBeVisible();
  const muted = page.getByRole("listitem").filter({ hasText: "Walking the long way home (2)" }).filter({ hasText: title });
  await expect(muted).toBeVisible();
  await muted.getByRole("button", { name: "Unmute Walking the long way home (2)" }).click();
  await expect(muted.getByRole("status")).toHaveText("Unmuted. It's back in your lists, unread.");
  // Nothing moves: it stays, with Undo.
  await expect(muted.getByRole("button", { name: "Undo unmuting Walking the long way home (2)" })).toBeFocused();

  // Escape goes back to Settings.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Settings", level: 2 })).toBeVisible();
});

test("a star rule acts on an article as it arrives; rules pause, and Delete has Undo", async ({ page }) => {
  const name = `rules-star-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/`);
  await page.reload();
  await appReady(page);

  const rules = page.getByRole("region", { name: "Rules" });
  await rules.getByRole("button", { name: "New rule…" }).click();
  const sheet = page.getByRole("dialog", { name: "New rule" }).or(page.getByRole("region", { name: "New rule" }));
  // Escape closes it unchanged, and Settings stays.
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("heading", { name: "Settings", level: 2 })).toBeVisible();

  await rules.getByRole("button", { name: "New rule…" }).click();
  await sheet.getByRole("textbox", { name: "Word or phrase" }).fill("river");
  await sheet.getByRole("radio", { name: "The title or the text" }).check();
  await sheet.getByRole("combobox", { name: "In" }).selectOption(`feed:${id}`);
  await sheet.getByRole("radio", { name: /^Star/ }).check();
  await sheet.getByRole("button", { name: "Save" }).click();
  const sentence = `Star articles with “river” in the title or text, in ${title}.`;
  await expect(rules).toContainText(sentence);
  await expect(rules.getByRole("status")).toContainText("Rule saved. It acts on new articles as they arrive.");

  // The blog publishes "What the river taught me (4)": it arrives starred.
  expect((await page.request.get(`${FEED_SITE}/grow/${name}`)).ok()).toBe(true);
  await expect
    .poll(
      async () => {
        const answer = await page.request.get(new URL(`/api/articles?feed=${id}`, FEEDS_APP).href);
        const articles = (await answer.json()).articles as { title: string; starred: boolean }[];
        return articles.find((article) => article.title === "What the river taught me (4)")?.starred ?? null;
      },
      { timeout: 30_000 },
    )
    .toBe(true);

  // Its switch pauses it, saying so in words.
  const on = rules.getByRole("switch", { name: `On: ${sentence}` });
  await expect(on).toBeChecked();
  await on.click();
  await expect(on).not.toBeChecked();
  await expect(rules).toContainText(`${sentence} Paused.`);
  await page.reload();
  await appReady(page);
  await expect(rules.getByRole("switch", { name: `On: ${sentence}` })).not.toBeChecked();

  // Edit › Delete: gone at once, with Undo bringing it back as it was.
  await rules.getByRole("button", { name: `Edit rule: ${sentence}` }).click();
  const editing = page.getByRole("dialog", { name: "Edit rule" }).or(page.getByRole("region", { name: "Edit rule" }));
  await editing.getByRole("button", { name: "Delete" }).click();
  await expect(rules.getByRole("status")).toContainText("Deleted the rule.");
  await expect(rules).not.toContainText(sentence);
  await rules.getByRole("button", { name: "Undo" }).click();
  await expect(rules.getByRole("status")).toContainText("The rule is back.");
  await expect(rules).toContainText(`${sentence} Paused.`);
});
