import { expect, test, type Locator, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, choose, follow, signIn, tabTo } from "./screens";

// SPEC section 36, their page (decisions 0211, 0215, 0254 and 0267): no
// Edit mode. Their name and where they publish, Write to (outlined), then one
// card with your note and Your highlights from their writing, each one press
// from reading, then one row, Settings, which opens their settings on a page
// of its own, each changing as it's touched; no Lately, as their list already
// shows their newest.
// Uses a blog of its own, since every test shares the one nine turtles that has feeds.

const pane = (page: Page) => page.getByRole("region", { name: "Article", exact: true });
const about = (page: Page, name: string) => page.getByRole("region", { name: `About ${name}` });
/** Their settings, a page of its own (decision 0267). */
const settingsFor = (page: Page, name: string) => page.getByRole("region", { name: `Settings for ${name}` });

test("their page shows the words you highlighted in their writing, each one press from reading, and no Lately", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same page on a phone, a screen of its own");
  const name = `their-${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);
  await page.goto(new URL(`/people/${id}`, FEEDS_APP).href);
  await appReady(page);

  // Highlight words in their newest article.
  await page.locator(".item-row").first().click();
  const title = (await pane(page).locator("h2.article-title").innerText()).trim();
  await choose(page, "made-up summary");
  await page.getByRole("menu", { name: "Chosen words" }).getByRole("menuitem", { name: /Highlight/ }).click();
  await page.getByRole("menu", { name: "Highlight" }).getByRole("menuitem", { name: "Done" }).click();

  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  const who = about(page, `Blog ${name}`);
  await expect(who.getByRole("region", { name: "Lately" })).toHaveCount(0);
  // No Edit mode, no solid button (Write to is outlined, decision 0267), and no setting to change here.
  await expect(who.getByRole("button", { name: /^Edit Blog/ })).toHaveCount(0);
  await expect(who.locator(".btn-primary")).toHaveCount(0);
  await expect(who.getByRole("textbox", { name: "Name" })).toHaveCount(0);
  const highlights = who.getByRole("region", { name: "Your highlights" });
  await expect(highlights.getByRole("listitem")).toHaveCount(1);
  await expect(highlights).toContainText("made-up summary");
  await expect(highlights.getByRole("button", { name: title })).toBeVisible();

  // In order: Write to, then the card with your note and Your highlights, then the one row, Settings.
  const text = await who.innerText();
  const at = (words: string) => text.search(new RegExp(words, "i"));
  expect(at(`Write to Blog ${name}`)).toBeLessThan(at("Your highlights"));
  const row = who.getByRole("link", { name: `Settings for Blog ${name}`, exact: true });
  await expect(row).toHaveAttribute("href", `/people/${id}/settings`);
  const card = who.locator(".yours");
  await expect(card.getByRole("button", { name: "Add a note…" })).toBeVisible();
  await expect(card.getByRole("region", { name: "Your highlights" })).toBeVisible();
  expect((await row.boundingBox())!.y).toBeGreaterThan((await card.boundingBox())!.y + (await card.boundingBox())!.height);

  // The title in Your highlights opens the article.
  await highlights.getByRole("button", { name: title }).click();
  await expect(pane(page).getByRole("heading", { level: 2, name: title })).toBeVisible();

  // And from the keyboard alone: Tab reaches the title, Enter opens it.
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  await tabTo(page, highlights.getByRole("button", { name: title }));
  await page.keyboard.press("Enter");
  await expect(pane(page).getByRole("heading", { level: 2, name: title })).toBeVisible();

});

test("on a phone, their page's quiet words are still 44px each way to touch", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the touch floor is a phone's");
  const name = `their-phone-${test.info().workerIndex}-${Date.now()}`;
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  const who = about(page, `Blog ${name}`);
  const row = who.getByRole("link", { name: `Settings for Blog ${name}`, exact: true });
  for (const target of [who.getByRole("button", { name: "Add a note…" }), row]) {
    const box = await target.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  // Their settings, one press on: the way back and each quiet row are 44px too.
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/people/${id}/settings$`));
  const settings = settingsFor(page, `Blog ${name}`);
  for (const target of [settings.getByRole("button", { name: `Back to Blog ${name}` }), settings.getByRole("button", { name: /^Folders/ }), settings.getByRole("button", { name: "Hide articles about…" })]) {
    const box = await target.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  // ‹ their name goes back to their page.
  await settings.getByRole("button", { name: `Back to Blog ${name}` }).click();
  await expect(page).toHaveURL(new RegExp(`/people/${id}/about$`));
  await expect(who.getByRole("heading", { level: 2, name: `Blog ${name}` })).toBeVisible();
});

test("their settings change the moment they're touched, with no Edit, Cancel or Done", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same page on a phone");
  const name = `their-prefs-${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);

  // The old Edit address opens their settings, a page of its own, with the keyboard on its title.
  await page.goto(new URL(`/people/${id}/edit`, FEEDS_APP).href);
  await appReady(page);
  await expect(page).toHaveURL(new RegExp(`/people/${id}/settings$`));
  const who = settingsFor(page, `Blog ${name}`);
  await expect(who.getByRole("heading", { level: 2, name: "Settings" })).toBeFocused();
  await expect(who.getByRole("button", { name: `Back to Blog ${name}` })).toBeVisible();
  const field = who.getByRole("textbox", { name: "Name" });
  await expect(who.getByRole("button", { name: /^(Cancel|Done)$/ })).toHaveCount(0);

  // Escape puts a half-typed name back; Enter keeps a new one, at once.
  await field.fill("Someone else");
  await page.keyboard.press("Escape");
  await expect(field).toHaveValue(`Blog ${name}`);
  await field.fill(`Mira ${name}`);
  await page.keyboard.press("Enter");
  const renamed = settingsFor(page, `Mira ${name}`);
  const theirs = about(page, `Mira ${name}`);
  const back = renamed.getByRole("button", { name: `Back to Mira ${name}` });
  const row = theirs.getByRole("link", { name: `Settings for Mira ${name}`, exact: true });
  await expect(back).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Sidebar" }).getByRole("link", { name: new RegExp(`Mira ${name}`) })).toBeVisible();

  // Folders: the ones they're in, in words, opening to the tick list; a new folder is made and chosen as it's named.
  await renamed.getByRole("button", { name: /^Folders/ }).click();
  await renamed.getByRole("textbox", { name: "New folder" }).fill(`Shelf ${name}`);
  await page.keyboard.press("Enter");
  await expect(renamed.getByRole("checkbox", { name: `Shelf ${name}` })).toBeChecked();
  await expect(renamed.getByRole("button", { name: /^Folders/ })).toContainText(`Shelf ${name}`);
  await renamed.getByRole("checkbox", { name: `Shelf ${name}` }).uncheck();
  await expect(renamed.getByRole("button", { name: /^Folders/ })).toContainText("None");

  // A publication has no Write to on their page: choosing it takes the button away, and choosing A person brings it back.
  // ‹ their name goes back to their page, with the keyboard on the row that opened this one; Enter opens it again.
  const writeTo = theirs.getByRole("link", { name: /^Write to/ }).or(theirs.getByRole("button", { name: /^Write to/ }));
  await renamed.getByRole("radio", { name: "A publication" }).check();
  await back.click();
  await expect(page).toHaveURL(new RegExp(`/(people|publications)/${id}/about$`));
  await expect(theirs.getByRole("heading", { level: 2, name: `Mira ${name}` })).toBeVisible();
  await expect(row).toBeFocused();
  await expect(writeTo).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/(people|publications)/${id}/settings$`));
  await expect(renamed.getByRole("heading", { level: 2, name: "Settings" })).toBeFocused();
  await renamed.getByRole("radio", { name: "A person" }).check();
  // Escape does what ‹ their name does.
  await page.locator("body").focus();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(new RegExp(`/(people|publications)/${id}/about$`));
  await expect(row).toBeFocused();
  await expect(writeTo).toHaveCount(1);

  // Pause for a while: on as it's switched, and the line at the top of their page says so, with Resume.
  await page.keyboard.press("Enter");
  await renamed.getByRole("switch", { name: "Pause for a while" }).check();
  await back.click();
  await expect(theirs.getByRole("button", { name: "Resume" })).toBeVisible();
  await theirs.getByRole("button", { name: "Resume" }).click();
  await row.click();
  await expect(renamed.getByRole("switch", { name: "Pause for a while" })).not.toBeChecked();

  // The X at the bar's right end goes back to their list, from their settings as from their page.
  await renamed.getByRole("button", { name: "Close" }).click();
  await expect(page).toHaveURL(new RegExp(`/(people|publications)/${id}$`));
});

test("back from their settings, the Settings row has the keyboard and is in view, and nothing loads again to push it away", async ({ page, isMobile }) => {
  const name = `their-back-${test.info().workerIndex}-${Date.now()}`;
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);
  // Enough highlights that the row sits below the fold, on a computer and on a phone.
  const listed = await (await page.request.get(new URL(`/api/articles?feed=${id}`, FEEDS_APP).href)).json();
  for (let n = 1; n <= 8; n++) {
    const made = await page.request.post(new URL(`/api/articles/${listed.articles[0].id}/highlights`, FEEDS_APP).href, {
      data: { quote: `Made-up words, number ${n}, kept long enough to take a line or two of their page` },
      headers: { Origin: FEEDS_APP },
    });
    expect(made.status()).toBe(201);
  }
  // Each load of Your highlights takes a moment, as on a slow connection.
  let asked = 0;
  await page.route(`**/api/feeds/${id}/highlights`, async (route) => {
    asked += 1;
    await new Promise((done) => setTimeout(done, 400));
    await route.continue();
  });
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  const who = about(page, `Blog ${name}`);
  const items = who.getByRole("region", { name: "Your highlights" }).getByRole("listitem");
  await expect(items).toHaveCount(8);
  await expect(page).toHaveTitle(`Blog ${name} · nine turtles`);
  // The row is named for them, so it isn't mistaken for the app's own Settings; what's seen is still "Settings".
  const row = who.getByRole("link", { name: `Settings for Blog ${name}`, exact: true });
  await expect(row).toHaveText("Settings", { useInnerText: true });
  if (!isMobile) await expect(who.getByRole("button", { name: "Close" })).toHaveAttribute("title", "Close (Esc)");
  const scroller = page.locator(".who-page > div").first();
  const inView = async () => {
    const [shown, area] = [(await row.boundingBox())!, (await scroller.boundingBox())!];
    return shown.y >= area.y && shown.y + shown.height <= area.y + area.height;
  };
  expect(await inView()).toBe(false);

  for (const way of ["Escape", "‹ their name"]) {
    await row.focus();
    await page.keyboard.press("Enter");
    const settings = settingsFor(page, `Blog ${name}`);
    await expect(settings.getByRole("heading", { level: 2, name: "Settings" })).toBeFocused();
    await expect(page).toHaveTitle(`Settings for Blog ${name} · nine turtles`);
    // Escape belongs to ‹ their name here, so the × says only Close.
    if (!isMobile) await expect(settings.getByRole("button", { name: "Close" })).toHaveAttribute("title", "Close");
    if (way === "Escape") await page.keyboard.press("Escape");
    else await settings.getByRole("button", { name: `Back to Blog ${name}` }).click();
    await expect(page).toHaveURL(new RegExp(`/people/${id}/about$`));
    await expect(items).toHaveCount(8);
    await expect(row).toBeFocused();
    expect(await inView()).toBe(true);
  }
  // What was loaded stayed: their page didn't load it again on the way back.
  expect(asked).toBe(1);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("when Your highlights can't be loaded, their page says so", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same words on a phone");
  const name = `their-failing-${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);
  await page.route(`**/api/feeds/${id}/highlights`, (route) => route.fulfill({ status: 500, json: { error: "trouble" } }));
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  const who = about(page, `Blog ${name}`);
  await expect(who).toContainText("Your highlights from their writing couldn't be loaded.");
  await expect(who.getByRole("region", { name: "Your highlights" })).toHaveCount(0);
});

test("by keyboard alone: Change corrects the address in place, Escape closes the box, and the keyboard goes back to Change", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same page on a phone");
  const name = `their-change-${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);
  await page.request.post(new URL(`/api/feeds/${id}/write-to`, FEEDS_APP).href, { data: { address: "old@there.example" } });
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  const who = about(page, `Blog ${name}`);
  const change = who.getByRole("button", { name: `Change Blog ${name}'s email address` });
  await tabTo(page, change);
  await page.keyboard.press("Enter");
  const field = who.getByRole("textbox", { name: "Their email address" });
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("old@there.example");
  // Escape closes the box only, never the page, and the keyboard is back on Change.
  await page.keyboard.press("Escape");
  await expect(field).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/people/${id}/about$`));
  await expect(change).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("new@there.example");
  await page.keyboard.press("Enter");
  await expect(who.getByRole("link", { name: `Write to Blog ${name}` })).toHaveAttribute("href", "mailto:new@there.example");
  await expect(change).toBeFocused();
  // Emptied, it forgets it: no address, no Change, and the keyboard lands on Write to.
  await page.keyboard.press("Enter");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Enter");
  await expect(who.getByRole("button", { name: `Write to Blog ${name}` })).toBeFocused();
});

test("with nothing yet, their page says so; the × and Escape go back to their list, and Hiding opened there leads back to it", async ({ page, isMobile }) => {
  test.skip(isMobile, "the × is a computer's; a phone has ‹ back");
  const name = `their-empty-${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  const who = about(page, `Blog ${name}`);
  await expect(who.getByRole("region", { name: "Your highlights" })).toContainText("Nothing highlighted yet.");
  await expect(who.getByRole("button", { name: "Add a note…" })).toBeVisible();

  // The × by keyboard.
  await tabTo(page, who.getByRole("button", { name: "Close" }));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/people/${id}$`));

  // Hide articles about…, in their settings, opens Hiding with "‹ Blog …" as its way back; the button and Escape both lead back to their settings.
  await page.goto(new URL(`/people/${id}/settings`, FEEDS_APP).href);
  await appReady(page);
  const settings = settingsFor(page, `Blog ${name}`);
  await settings.getByRole("button", { name: "Hide articles about…" }).click();
  await expect(page).toHaveURL(/\/settings\/hiding$/);
  const back = page.getByRole("button", { name: new RegExp(`Blog ${name}`) }).first();
  await expect(back).toBeVisible();
  await back.click();
  await expect(page).toHaveURL(new RegExp(`/people/${id}/settings$`));
  await settings.getByRole("button", { name: "Hide articles about…" }).click();
  await expect(page).toHaveURL(/\/settings\/hiding$/);
  await page.locator("body").focus();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(new RegExp(`/people/${id}/settings$`));
});

test("a name that couldn't be saved stays as typed, with why, and Enter keeps the keyboard in the field", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same page on a phone");
  const name = `their-refused-${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);
  await page.goto(new URL(`/people/${id}/settings`, FEEDS_APP).href);
  await appReady(page);
  const who = settingsFor(page, `Blog ${name}`);
  const field = who.getByRole("textbox", { name: "Name" });
  await page.route(`**/api/feeds/${id}`, (route) => (route.request().method() === "GET" ? route.continue() : route.fulfill({ status: 500, json: { error: "trouble" } })));
  await field.fill(`Kept ${name}`);
  await field.press("Enter");
  await expect(who).toContainText("That couldn't be saved. Try again in a moment.");
  await expect(field).toBeFocused();
  await expect(field).toHaveValue(`Kept ${name}`);
  await expect(who).not.toContainText("feed");
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("on a phone, each place under their name is 44px to touch", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the touch floor is a phone's");
  const name = `their-places-${test.info().workerIndex}-${Date.now()}`;
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  const place = about(page, `Blog ${name}`).locator(".who-places a").first();
  expect((await place.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test("on a phone, a very long name in ‹ their name shortens inside the top line, and is still said in full", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the narrowest top line is a phone's");
  const name = `their-long-${test.info().workerIndex}-${Date.now()}-with-a-made-up-name-far-too-long-for-any-phone-screen`;
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);
  const width = page.viewportSize()!.width;
  /** The button stays inside the screen, its name cut short with an ellipsis, on one line. */
  const fits = async (back: Locator) => {
    const box = (await back.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.height).toBeLessThan(60);
    const words = back.locator("bdi");
    await expect(words).toHaveCSS("text-overflow", "ellipsis");
    expect(await words.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  };

  // Their page's own way back, to their list.
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  const who = about(page, `Blog ${name}`);
  await fits(who.getByRole("button", { name: `Blog ${name}`, exact: true }));
  // Their settings' way back, to their page.
  await who.getByRole("link", { name: `Settings for Blog ${name}`, exact: true }).click();
  const settings = settingsFor(page, `Blog ${name}`);
  await fits(settings.getByRole("button", { name: `Back to Blog ${name}`, exact: true }));
  // Hiding's, opened from their settings, back to them.
  await settings.getByRole("button", { name: "Hide articles about…" }).click();
  await expect(page).toHaveURL(/\/settings\/hiding$/);
  await fits(page.getByRole("button", { name: `Back to Blog ${name}`, exact: true }));
});

test("an article chosen while their page or their settings shows beside the list takes the page's place", async ({ page, isMobile }) => {
  test.skip(isMobile, "on a phone their page takes the list's place: there's no list beside it to choose from");
  const name = `their-choose-${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);
  await page.goto(new URL(`/people/${id}`, FEEDS_APP).href);
  await appReady(page);
  const rows = page.locator(".item-row");
  const who = about(page, `Blog ${name}`);
  const title = pane(page).locator("h2.article-title");

  // Their page opened from an open article, and closed, brings that article back, as before.
  await rows.nth(0).click();
  const first = (await title.innerText()).trim();
  await page.keyboard.press("i");
  await expect(who).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(title).toHaveText(first);

  // A click on another row: the article shows in the page's place, under their list's address, and the keyboard stays on the row.
  await page.keyboard.press("i");
  await expect(who).toBeVisible();
  await rows.nth(1).click();
  await expect(who).toHaveCount(0);
  await expect(title).not.toHaveText(first);
  const second = (await title.innerText()).trim();
  await expect(page).toHaveURL(new RegExp(`/people/${id}/articles/\\d+$`));
  await expect(rows.nth(1)).toBeFocused();
  // Back goes to their page, as after its Close.
  await page.goBack();
  await expect(who).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/people/${id}/about$`));

  // By keyboard: j moves to the next article and shows it, the keyboard on its row.
  await page.keyboard.press("j");
  await expect(who).toHaveCount(0);
  await expect(title).not.toHaveText(second);
  await expect(rows.nth(2)).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`/people/${id}/articles/\\d+$`));

  // From their settings, Enter (the keyboard on their title, not a control) opens the chosen article, the keyboard on its title.
  await page.keyboard.press("e");
  await expect(settingsFor(page, `Blog ${name}`).getByRole("heading", { level: 2, name: "Settings" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(settingsFor(page, `Blog ${name}`)).toHaveCount(0);
  await expect(title).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`/people/${id}/articles/\\d+$`));

  // k, from their page again: the article before shows in the page's place, the keyboard on its row.
  await page.keyboard.press("i");
  await expect(who).toBeVisible();
  await page.keyboard.press("k");
  await expect(who).toHaveCount(0);
  await expect(title).toHaveText(second);
  await expect(rows.nth(1)).toBeFocused();

  // Write back in a row's menu, from their page: the article shows, and writing back starts (their address isn't known yet, so its box opens).
  await page.keyboard.press("i");
  await expect(who).toBeVisible();
  await rows.nth(0).click({ button: "right" });
  await page.getByRole("menu", { name: /^Actions for / }).getByRole("menuitem", { name: "Write back" }).click();
  await expect(who).toHaveCount(0);
  await expect(title).toHaveText(first);
  await expect(pane(page).getByRole("textbox", { name: "Their email address" })).toBeFocused();
});
