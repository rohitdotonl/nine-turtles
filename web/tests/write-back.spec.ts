import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, choose, follow, signIn } from "./screens";

// SPEC section 37 (writing back), "How to check it", done by a browser: an
// article of someone whose feed gives no address asks for it once, keeps it on
// their page, and from then on Write back is a link that opens the email app
// with the address and "Re: the title". Uses a blog of its own, since every
// test shares the one nine turtles that has feeds.

const pane = (page: Page) => page.getByRole("region", { name: "Article", exact: true });
/** Their page, beside the list: "About Alpha" to screen readers, never the list's own name. */
const whoPage = (page: Page, name: string) => page.getByRole("region", { name: `About ${name}`, exact: true });

test.skip(({ isMobile }) => isMobile, "the person's page stands in the wide window's reading pane");

test("Write back asks once for an address, keeps it on their page, then opens the email app", async ({ page }) => {
  const name = `wb-ivy-${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);
  await page.goto(new URL(`/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  // Nothing known yet: their page has no address.
  await expect(whoPage(page, `Blog ${name}`).getByRole("heading", { level: 2, name: `Blog ${name}` })).toBeVisible();
  await expect(whoPage(page, `Blog ${name}`)).not.toContainText("Email");
  // "Write to", the outlined button under their name (decision 0267), opens the same box as Write back (the owner's core path, point 9).
  await expect(whoPage(page, `Blog ${name}`).getByRole("button", { name: `Write to Blog ${name}` })).toHaveClass(/\bbtn\b/);
  await expect(whoPage(page, `Blog ${name}`).locator(".btn-primary")).toHaveCount(0);
  await expect(whoPage(page, `Blog ${name}`)).not.toContainText("A person ·");
  await page.goto(new URL(`/${id}`, FEEDS_APP).href);
  await appReady(page);

  await page.locator(".item-row").first().click();
  const start = pane(page).getByRole("button", { name: `Write back to Blog ${name}` });
  // Outlined at an article's end too (decision 0242).
  await expect(start).not.toHaveClass(/btn-primary/);
  await start.focus();
  await page.keyboard.press("Enter");
  const field = pane(page).getByRole("textbox", { name: "Their email address" });
  await expect(field).toBeFocused();
  // nine turtles tries to look on their site; this made-up one can't be reached, and it says so.
  await expect(pane(page)).toContainText("Their site couldn't be checked for an address.");
  await expect(field).toHaveValue("");
  // Their site, to find the address on, opens in a new tab.
  const site = pane(page).getByRole("link", { name: "look on their site (opens in a new tab)" });
  await expect(site).toHaveAttribute("href", /^https?:\/\//);
  await expect(site).toHaveAttribute("target", "_blank");

  // The box's one solid button is Write back, though the button that opened it is outlined (decision 0259).
  await expect(pane(page).locator("form").getByRole("button", { name: "Write back", exact: true })).toHaveClass(/btn-primary/);
  await expect(pane(page)).toContainText("It sends from your own email, and nine turtles keeps the address for next time.");

  // Something that isn't an address is refused, in words, keeping what was typed.
  await field.fill("ivy at home");
  await pane(page).locator("form").getByRole("button", { name: "Write back", exact: true }).click();
  await expect(pane(page).getByRole("status").filter({ hasText: "doesn't look like an email address" })).toBeVisible();
  await expect(field).toHaveValue("ivy at home");

  // Not now gives the keyboard back to the button.
  await pane(page).getByRole("button", { name: "Not now" }).click();
  await expect(start).toBeFocused();

  await page.keyboard.press("Enter");
  await field.fill("ivy@ivy.example");
  await pane(page).locator("form").getByRole("button", { name: "Write back", exact: true }).click();
  const link = pane(page).getByRole("link", { name: `Write back to Blog ${name}` });
  await expect(link).toHaveAttribute("href", /^mailto:ivy@ivy\.example\?subject=Re%3A%20/);
  // The keyboard stays on Write back, now a link to the email app.
  await expect(link).toBeFocused();
  // Their address is never printed on the article's page (decision 0298): it's on their page, below.
  await expect(pane(page)).not.toContainText("ivy@ivy.example");

  // Write back is never in a bar (decision 0298), nor in More.
  await expect(pane(page).locator(".reading-bar").getByRole("button", { name: "Write back", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "More actions" }).click();
  await expect(page.getByRole("menuitem", { name: /Write back/ })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Words chosen offer Write back about this (decision 0205); once highlighted, Write back starts the email with them, quoted.
  await choose(page, "made-up summary");
  const words = page.getByRole("menu", { name: "Chosen words" });
  await expect(words.getByRole("menuitem", { name: "Write back about this" })).toBeVisible();
  await words.getByRole("menuitem", { name: /Highlight/ }).click();
  await page.getByRole("menu", { name: "Highlight" }).getByRole("menuitem", { name: "Done" }).click();
  await expect(link).toHaveAttribute("href", /^mailto:ivy@ivy\.example\?subject=Re%3A%20.*&body=%E2%80%9Cmade-up%20summary%E2%80%9D%0A%0A$/);
  await expect(pane(page)).toContainText("Your email starts with the words you highlighted.");
  // A highlight pressed offers it too.
  await pane(page).locator("mark.highlight").click();
  await expect(page.getByRole("menu", { name: "Highlight" }).getByRole("menuitem", { name: "Write back about this" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Their page keeps it, and Change beside it corrects it in place.
  await page.goto(new URL(`/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  const about = whoPage(page, `Blog ${name}`);
  // Write to opens the email app with the address only and an empty subject.
  await expect(about.getByRole("link", { name: `Write to Blog ${name}` })).toHaveAttribute("href", "mailto:ivy@ivy.example");
  await expect(about).toContainText("ivy@ivy.example");
  await about.getByRole("button", { name: `Change Blog ${name}'s email address` }).click();
  const edit = about.getByRole("textbox", { name: "Their email address" });
  await expect(edit).toHaveValue("ivy@ivy.example");
  await edit.fill("not an address");
  await about.getByRole("button", { name: "Save" }).click();
  await expect(about).toContainText("That doesn't look like an email address.");
  await edit.fill("ivy@letters.example");
  await about.getByRole("button", { name: "Save" }).click();
  await expect(about.getByRole("textbox", { name: "Their email address" })).toHaveCount(0);
  await expect(about.getByRole("link", { name: `Write to Blog ${name}` })).toHaveAttribute("href", "mailto:ivy@letters.example");
});

test("Write back fills in the address it finds on their site, for the reader to check", async ({ page }) => {
  const name = `wbsite${test.info().workerIndex}x${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/writer/${name}/feed.xml`);
  await page.goto(new URL(`/${id}`, FEEDS_APP).href);
  await appReady(page);
  await page.locator(".item-row").first().click();
  await pane(page).getByRole("button", { name: /^Write back to/ }).click();
  const field = pane(page).getByRole("textbox", { name: "Their email address" });
  await expect(pane(page)).toContainText("Found on their site. Check it, then press Write back.");
  await expect(field).toHaveValue(`${name}@${name}.example`);
  // The address is there, so the button to go and find it isn't.
  const site = pane(page).getByRole("link", { name: "look on their site (opens in a new tab)" });
  await expect(site).toHaveCount(0);
  // Changed, the box is as before.
  await field.fill("someone@else.example");
  await expect(site).toBeVisible();
  await expect(pane(page)).not.toContainText("Found on their site.");
});

test("A publication has no Write back and no Write to; A person brings them back, with the address kept", async ({ page }) => {
  const name = `wb-pub-${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);
  const kept = await page.request.post(new URL(`/api/feeds/${id}/write-to`, FEEDS_APP).href, { data: { address: "pub@pub.example" } });
  expect(kept.ok()).toBe(true);
  const who = () => whoPage(page, `Blog ${name}`);
  await page.goto(new URL(`/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  await expect(who().getByRole("link", { name: `Write to Blog ${name}` })).toHaveAttribute("href", /^mailto:pub@pub\.example/);

  // Made a publication, in their settings: Write to and its address go from their page as soon as it's chosen (decision 0192).
  await page.goto(new URL(`/${id}/settings`, FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("radio", { name: "A publication" }).check();
  await page.getByRole("button", { name: `Back to Blog ${name}` }).click();
  await expect(who().getByRole("heading", { level: 2, name: `Blog ${name}` })).toBeVisible();
  await expect(who().getByText(`Write to Blog ${name}`)).toHaveCount(0);
  await expect(who()).not.toContainText("pub@pub.example");

  // Its article ends with no Write back, there's no paper plane, and W (which would ask for the
  // unknown address, as in the first test) does nothing.
  await page.goto(new URL(`/${id}`, FEEDS_APP).href);
  await appReady(page);
  await page.locator(".item-row").first().click();
  await expect(pane(page).getByRole("heading", { level: 2 })).toBeVisible();
  await expect(pane(page).getByText(/^Write back/)).toHaveCount(0);
  await expect(pane(page).getByRole("button", { name: "Write back" })).toHaveCount(0);
  await page.locator(".item-row").first().focus();
  await page.keyboard.press("w");
  await expect(pane(page).getByRole("textbox", { name: "Their email address" })).toHaveCount(0);
  await pane(page).getByRole("button", { name: "More" }).click();
  await expect(page.getByRole("menuitem", { name: /Write back/ })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // A person again: Write to comes back, with the address kept through its spell as a publication.
  await page.goto(new URL(`/${id}/settings`, FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("radio", { name: "A person" }).check();
  await page.getByRole("button", { name: `Back to Blog ${name}` }).click();
  await expect(who().getByRole("link", { name: `Write to Blog ${name}` })).toHaveAttribute("href", /^mailto:pub@pub\.example/);
});

test("Write back's arrow offers every way back, and the one chosen is kept for that person; Write back switches off per person", async ({ page }) => {
  // Each post of a "talk-" blog names its comments page (RSS's <comments>, decision 0286).
  const name = `talk-wb-${test.info().workerIndex}-${Date.now()}`;
  // Tall enough that Write back sits high on the screen and its menu opens downwards, in the order the keys below expect
  // (one opening upwards puts the row nearest the button first).
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: FEEDS_APP });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);
  const kept = await page.request.post(new URL(`/api/feeds/${id}/write-to`, FEEDS_APP).href, { data: { address: "talk@talk.example" } });
  expect(kept.ok()).toBe(true);
  const openArticle = async () => {
    await page.goto(new URL(`/${id}`, FEEDS_APP).href);
    await appReady(page);
    await page.locator(".item-row").first().click();
    await expect(pane(page).getByRole("heading", { level: 2 })).toBeVisible();
  };
  await openArticle();

  // The arrow beside Write back holds the other ways, Your email app ticked.
  await expect(pane(page).getByRole("link", { name: `Write back to Blog ${name}` })).toHaveAttribute("href", /^mailto:talk@talk\.example/);
  const arrow = pane(page).getByRole("button", { name: `Other ways to reply to Blog ${name}` });
  const ways = pane(page).getByRole("menu");
  // By keyboard: Enter opens it on its first row (Write back about a line…, decision 0326), the arrows move, Escape closes it and gives the keyboard back to the arrow.
  await arrow.focus();
  await page.keyboard.press("Enter");
  await expect(ways.getByRole("menuitem", { name: "Write back about a line…" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(ways.getByRole("menuitemradio", { name: "Your email app" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(ways.getByRole("menuitemradio", { name: "Gmail" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(ways).toHaveCount(0);
  await expect(arrow).toBeFocused();
  await arrow.click();
  await expect(ways.getByRole("menuitemradio")).toHaveText([/^\s*Your email app\s+W\s*$/, /^\s*Gmail\s*$/, /^\s*Outlook\.com\s*$/, /^\s*Copy talk@talk\.example\s*$/, /^\s*Comment on their site\s*$/]);
  await expect(ways.getByRole("menuitemradio", { name: "Your email app" })).toHaveAttribute("aria-checked", "true");
  // No room under the arrow (a short window, at the article's end): it opens upwards, wholly in view, its first row nearest the arrow.
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1280, height: 480 });
  await pane(page).locator(".reading-scroller").evaluate((area) => (area.scrollTop = area.scrollHeight));
  await arrow.click();
  await expect(ways.getByRole("menuitemradio")).toHaveText([/Comment on their site/, /Copy talk@talk\.example/, /Outlook\.com/, /Gmail/, /Your email app/]);
  await expect(ways.getByRole("menuitem", { name: "Write back about a line…" })).toBeFocused();
  const [menuBox, arrowBox, areaBox] = await Promise.all([ways.boundingBox(), arrow.boundingBox(), pane(page).locator(".reading-scroller").boundingBox()]);
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(arrowBox!.y);
  expect(menuBox!.y).toBeGreaterThanOrEqual(areaBox!.y);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1280, height: 800 });
  await arrow.click();

  // Copy: copied at once, said so, and from then on the main button copies, for this person, after a reload too.
  await ways.getByRole("menuitemradio", { name: "Copy talk@talk.example" }).click();
  await expect(pane(page).locator(".write-back").getByText("Copied.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("talk@talk.example");
  await openArticle();
  const copy = pane(page).getByRole("button", { name: `Copy address of Blog ${name}` });
  await expect(copy).toBeVisible();
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await copy.click();
  await expect(pane(page).locator(".write-back").getByText("Copied.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("talk@talk.example");

  // Comment: opens the comments the feed names in a new tab, and the main button becomes Comment.
  await page.evaluate(() => {
    window.open = ((address: string) => ((document.body.dataset.opened = address), null)) as typeof window.open;
  });
  await arrow.click();
  await expect(ways.getByRole("menuitemradio", { name: "Copy talk@talk.example" })).toHaveAttribute("aria-checked", "true");
  await ways.getByRole("menuitemradio", { name: "Comment on their site" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-opened", new RegExp(`^https://${name}\\.example/\\d+#comments$`));
  const comment = pane(page).getByRole("link", { name: `Comment on Blog ${name}'s site` });
  await expect(comment).toHaveAttribute("href", new RegExp(`^https://${name}\\.example/\\d+#comments$`));
  await expect(comment).toHaveAttribute("target", "_blank");
  await expect(pane(page).getByText(`on ${name}.example`, { exact: true })).toBeVisible();


  // Back to email from the arrow: Your email app opens it, and Write back is the main button again.
  await arrow.click();
  await ways.getByRole("menuitemradio", { name: "Your email app" }).click();
  await expect(pane(page).getByRole("link", { name: `Write back to Blog ${name}` })).toBeVisible();
  await expect(pane(page).getByText(/^Opening your email app/)).toBeVisible();

  // Their page keeps Copy address beside Change.
  await page.goto(new URL(`/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  await expect(whoPage(page, `Blog ${name}`).getByRole("button", { name: `Copy address of Blog ${name}` })).toBeVisible();

  // Switched off in their settings: they stay a person, but Write to, Write back, the paper plane and W all go (a row's menu too: rowMenu.test.ts).
  await page.goto(new URL(`/${id}/settings`, FEEDS_APP).href);
  await appReady(page);
  const toggle = page.getByRole("switch", { name: "Write back" });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(page.getByRole("radio", { name: "A person" })).toBeChecked();
  await page.getByRole("button", { name: `Back to Blog ${name}` }).click();
  await expect(whoPage(page, `Blog ${name}`).getByRole("heading", { level: 2, name: `Blog ${name}` })).toBeVisible();
  await expect(whoPage(page, `Blog ${name}`).getByText(`Write to Blog ${name}`)).toHaveCount(0);
  await expect(whoPage(page, `Blog ${name}`)).not.toContainText("talk@talk.example");
  await page.goto(new URL(`/${id}`, FEEDS_APP).href);
  await appReady(page);
  await page.locator(".item-row").first().click();
  await expect(pane(page).getByRole("heading", { level: 2 })).toBeVisible();
  await expect(pane(page).getByText(/^Write back/)).toHaveCount(0);
  await expect(pane(page).getByRole("button", { name: /Other ways to reply/ })).toHaveCount(0);
  await expect(pane(page).getByRole("button", { name: "Write back" })).toHaveCount(0);
  // W writes nothing: no email opens (the address is known, so it would open at once, saying so).
  await pane(page).getByRole("heading", { level: 2 }).focus();
  await page.keyboard.press("w");
  await expect(page.getByText(/Opening your email app/)).toHaveCount(0);

  // On again: Write back comes back, with the address kept.
  await page.goto(new URL(`/${id}/settings`, FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("switch", { name: "Write back" }).check();
  await page.getByRole("button", { name: `Back to Blog ${name}` }).click();
  await expect(whoPage(page, `Blog ${name}`).getByRole("link", { name: `Write to Blog ${name}` })).toHaveAttribute("href", /^mailto:talk@talk\.example/);
});

test("Write back answers where it was pressed, names a post with no title, and Escape puts its box away", async ({ page }) => {
  const name = `wbnote${test.info().workerIndex}x${Date.now()}`;
  // Short enough that a note's end, and the line under its Write back, is below the screen.
  await page.setViewportSize({ width: 1280, height: 420 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/untitled/${name}/feed.xml`);
  expect((await page.request.post(new URL(`/api/feeds/${id}`, FEEDS_APP).href, { data: { kind: "person" } })).ok()).toBe(true);
  await page.goto(new URL(`/${id}`, FEEDS_APP).href);
  await appReady(page);
  await page.locator(".item-row").first().click();
  /** W, from anywhere in the article: Write back is never in a bar (decision 0298). */
  // A post with no title has no visible title (decision 0312), but its heading is still there to start from.
  const plane = { click: async () => { await pane(page).locator("article.article > h2").focus(); await page.keyboard.press("w"); } };

  // With no address known, W opens the box; Escape puts it away, as Not now does, and the keyboard goes back to Write back.
  await plane.click();
  const field = pane(page).getByRole("textbox", { name: "Their email address" });
  await expect(field).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(field).toHaveCount(0);
  await expect(pane(page).getByRole("button", { name: `Write back to Notes ${name}` })).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`/(?:[a-z0-9-]+-)?${id}/`));

  // A note has no title: the email is about its opening words, so the writer knows which post.
  expect((await page.request.post(new URL(`/api/feeds/${id}/write-to`, FEEDS_APP).href, { data: { address: "notes@notes.example" } })).ok()).toBe(true);
  await page.reload();
  await appReady(page);
  await expect(pane(page).getByRole("link", { name: `Write back to Notes ${name}` })).toHaveAttribute(
    "href",
    "mailto:notes@notes.example?subject=Re%3A%20Walked%20to%20the%20river%20before%20breakfast%20and%20watched%20the%20herons%E2%80%A6",
  );

  // W, with the line under Write back below the screen: the reading area's foot says the email app is opening (decision 0229), in one line (decision 0265).
  await plane.click();
  const note = pane(page).locator(".away");
  await expect(note).toContainText("Opening your email app…");
  await expect(note.getByRole("button", { name: "Write in Gmail" })).toHaveCount(0);
  // "Didn't open?" opens the other ways in the note, and the keyboard goes to the first of them.
  await note.getByRole("button", { name: "Didn't open?" }).click();
  await expect(note).toContainText("Didn't open?");
  await expect(note).not.toContainText("Opening your email app…");
  await expect(note.getByRole("button", { name: "Write in Gmail" })).toBeFocused();
  await expect(note.getByRole("button", { name: "Write in Outlook.com" })).toBeVisible();
  await note.getByRole("button", { name: "Copy address" }).click();
  await expect(note).toContainText(/^Copied\.|The address couldn't be copied\. It's notes@notes\.example/);
  await note.getByRole("button", { name: "Close the note" }).click();
  await expect(note.getByText(/Opening your email app|Copied/)).toHaveCount(0);

  // By keyboard: W says it at the foot, collapsed again; Didn't open? and Copy address are pressed with Enter, and the keyboard goes back to the article.
  await pane(page).getByRole("heading", { level: 2 }).focus();
  await page.keyboard.press("w");
  await expect(note).toContainText("Opening your email app…");
  await note.getByRole("button", { name: "Didn't open?" }).focus();
  await page.keyboard.press("Enter");
  await expect(note.getByRole("button", { name: "Write in Gmail" })).toBeFocused();
  await note.getByRole("button", { name: "Copy address" }).focus();
  await page.keyboard.press("Enter");
  await expect(note).toContainText(/Copied\.|The address couldn't be copied\. It's notes@notes\.example/);
  await expect(pane(page).getByRole("heading", { level: 2 })).toBeFocused();
  // It goes with the article.
  await page.keyboard.press("w");
  await expect(note).toContainText("Opening your email app…");
  // j, to the next article (the list is away while one is open, decision 0275).
  await pane(page).getByRole("heading", { level: 2 }).focus();
  await page.keyboard.press("j");
  await expect(note.getByText(/Opening your email app/)).toHaveCount(0);
});

test("Write in Gmail: chosen once under Write back, it opens a Gmail draft in a new tab from then on, on this device", async ({ page }) => {
  const name = `wbgmail${test.info().workerIndex}x${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.context().route("https://mail.google.com/**", (route) => route.fulfill({ body: "A made-up Gmail" }));
  await page.context().route("https://outlook.live.com/**", (route) => route.fulfill({ body: "A made-up Outlook" }));
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);
  expect((await page.request.post(new URL(`/api/feeds/${id}`, FEEDS_APP).href, { data: { kind: "person" } })).ok()).toBe(true);
  expect((await page.request.post(new URL(`/api/feeds/${id}/write-to`, FEEDS_APP).href, { data: { address: "gm@gm.example" } })).ok()).toBe(true);
  await page.goto(new URL(`/${id}`, FEEDS_APP).href);
  await appReady(page);
  await page.locator(".item-row").first().click();
  const link = pane(page).getByRole("link", { name: `Write back to Blog ${name}` });
  await expect(link).toHaveAttribute("href", /^mailto:gm@gm\.example\?subject=/);

  // Pressed: one line under it, on a computer; the other places wait behind "Didn't open?" (decision 0265).
  await link.click();
  const line = pane(page).locator(".write-back .opening-line");
  await expect(line).toContainText("Opening your email app…");
  const more = line.getByRole("button", { name: "Didn't open?" });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await expect(line.getByRole("button")).toHaveText(["Didn't open?"]);
  // A small gap from the words before it, and none once it stands alone.
  await expect(more).toHaveCSS("margin-left", "8px");
  // Back from the email app (the page was hidden while it opened): "Opening…" goes, the question stays, for an app that opened wrong.
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(line).not.toContainText("Opening your email app…");
  await expect(more).toBeVisible();
  await expect(more).toHaveCSS("margin-left", "0px");
  // By keyboard: Enter on Didn't open? shows the other places and keeps the keyboard on it; Enter again puts them away.
  await more.focus();
  await page.keyboard.press("Enter");
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await expect(more).toBeFocused();
  await expect(line.getByRole("button")).toHaveText(["Didn't open?", "Write in Gmail", "Write in Outlook.com", "Copy address"]);
  await page.keyboard.press("Enter");
  await expect(line.getByRole("button")).toHaveText(["Didn't open?"]);
  await page.keyboard.press("Enter");
  // Enter on Write in Gmail, and the keyboard goes back to Write back as the button goes.
  const gmail = page.context().waitForEvent("page");
  await line.getByRole("button", { name: "Write in Gmail" }).focus();
  await page.keyboard.press("Enter");
  // The same email, now in Gmail, at once.
  const draft = await gmail;
  expect(draft.url()).toMatch(/^https:\/\/mail\.google\.com\/mail\/\?view=cm&fs=1&to=gm%40gm\.example&su=Re%3A%20/);
  await draft.close();
  await expect(line).toContainText("Opening Gmail in a new tab…");
  await expect(link).toBeFocused();
  // A new press, a new line: the ways wait again, behind "Wrong place?" now.
  await expect(line.getByRole("button")).toHaveText(["Wrong place?"]);
  await line.getByRole("button", { name: "Wrong place?" }).click();
  await expect(line.getByRole("button", { name: "Write in your email app" })).toBeVisible();
  // Always said under the address while Gmail is chosen, so the choice is never stuck.
  await expect(pane(page)).toContainText("Opens Gmail in a new tab.");

  // Kept on this device: another article's Write back is a Gmail draft, in a new tab.
  await pane(page).getByRole("button", { name: /^Back to / }).click();
  await page.locator(".item-row").nth(1).click();
  await expect(link).toHaveAttribute("href", /^https:\/\/mail\.google\.com\/mail\/\?view=cm&fs=1&to=gm%40gm\.example&su=Re%3A%20/);
  await expect(link).toHaveAttribute("target", "_blank");
  await page.reload();
  await appReady(page);
  await expect(link).toHaveAttribute("href", /^https:\/\/mail\.google\.com\//);

  // And back, without writing: Use your email app, under the address, makes it the mailto: link again.
  await pane(page).getByRole("button", { name: "Use your email app" }).click();
  await expect(link).toHaveAttribute("href", /^mailto:gm@gm\.example/);
  await expect(link).not.toHaveAttribute("target", "_blank");
  await expect(link).toBeFocused();
  await expect(pane(page)).not.toContainText("Opens Gmail in a new tab.");
});

test("On a touch screen, whose email app always answers, the line offers only Copy address", async ({ page }) => {
  const name = `wbtouch${test.info().workerIndex}x${Date.now()}`;
  // A touch screen: no fine pointer.
  await page.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => (query.includes("pointer: fine") ? { ...real(query), matches: false } : real(query));
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.context().route("https://outlook.live.com/**", (route) => route.fulfill({ body: "A made-up Outlook" }));
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);
  expect((await page.request.post(new URL(`/api/feeds/${id}`, FEEDS_APP).href, { data: { kind: "person" } })).ok()).toBe(true);
  expect((await page.request.post(new URL(`/api/feeds/${id}/write-to`, FEEDS_APP).href, { data: { address: "t@t.example" } })).ok()).toBe(true);
  await page.goto(new URL(`/${id}`, FEEDS_APP).href);
  await appReady(page);
  await page.locator(".item-row").first().click();
  await pane(page).getByRole("link", { name: `Write back to Blog ${name}` }).click();
  const line = pane(page).locator(".write-back .opening-line");
  await expect(line).toContainText("Nothing opened?");
  await expect(line).not.toContainText("the wrong app");
  await expect(line.getByRole("button")).toHaveText(["Copy address"]);
});

test("A way back pressed is listed on their page under Replies you started, removed with Undo, and switched off with Record replies in Settings", async ({ page }) => {
  const name = `replied-${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: FEEDS_APP });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);
  const kept = await page.request.post(new URL(`/api/feeds/${id}/write-to`, FEEDS_APP).href, { data: { address: "replied@replied.example" } });
  expect(kept.ok()).toBe(true);
  const who = whoPage(page, `Blog ${name}`);
  const theirPage = async () => {
    await page.goto(new URL(`/${id}/about`, FEEDS_APP).href);
    await appReady(page);
    await expect(who.getByRole("heading", { level: 2, name: `Blog ${name}` })).toBeVisible();
  };
  // Nothing started yet: no list at all, not an empty one. Write to on their page, about no article, records nothing.
  await theirPage();
  await expect(who.getByRole("heading", { name: "Replies you started" })).toHaveCount(0);
  await who.getByRole("link", { name: `Write to Blog ${name}` }).evaluate((link) => link.addEventListener("click", (event) => event.preventDefault()));
  await who.getByRole("link", { name: `Write to Blog ${name}` }).click();
  await theirPage();
  await expect(who.getByRole("heading", { name: "Replies you started" })).toHaveCount(0);

  await page.goto(new URL(`/${id}`, FEEDS_APP).href);
  await appReady(page);
  await page.locator(".item-row").first().click();
  const title = (await pane(page).getByRole("heading", { level: 2 }).textContent())!.trim();
  // In the full ink at the usual size, as Write to is (decision 0307).
  const write = pane(page).getByRole("link", { name: `Write back to Blog ${name}` });
  const [writeLook, titleColor] = await Promise.all([
    write.evaluate((button) => ({ color: getComputedStyle(button).color, size: getComputedStyle(button).fontSize })),
    pane(page).getByRole("heading", { level: 2 }).evaluate((heading) => getComputedStyle(heading).color),
  ]);
  expect(writeLook.color).toBe(titleColor);
  expect(writeLook.size).toBe(await page.evaluate(() => getComputedStyle(document.body).fontSize));
  // Copying their address is a way back: it's noted, with the day, never what was written.
  await pane(page).getByRole("button", { name: `Other ways to reply to Blog ${name}` }).click();
  await pane(page).getByRole("menu").getByRole("menuitemradio", { name: "Copy replied@replied.example" }).click();
  await expect(pane(page).locator(".write-back").getByText("Copied.", { exact: true })).toBeVisible();

  await theirPage();
  const replies = who.getByRole("region", { name: "Replies you started" });
  await expect(replies.getByRole("listitem")).toHaveCount(1);
  await expect(replies.getByRole("button", { name: title, exact: true })).toBeVisible();
  // Its heading says only that it was started: no line under it (the owner's choice).
  await expect(replies.locator("p.text-muted")).toHaveCount(0);
  // Its settings are the cog at the bar's right, across from ‹, not a row at the page's end (decision 0307).
  await expect(page.locator(".reading-bar").getByRole("link", { name: `Settings for Blog ${name}`, exact: true })).toBeVisible();
  await expect(page.locator(".reading-bar").getByRole("button", { name: `Back to Blog ${name}`, exact: true })).toBeVisible();

  // Removed by the keyboard alone, with Undo in its place, which brings it back.
  await replies.getByRole("button", { name: `Remove ${title} from Replies you started` }).focus();
  await page.keyboard.press("Enter");
  const undo = replies.getByRole("button", { name: "Undo", exact: true });
  await expect(undo).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(replies.getByRole("button", { name: title, exact: true })).toBeVisible();
  await expect(replies.getByRole("button", { name: `Remove ${title} from Replies you started` })).toBeFocused();
  // The title opens the article.
  await replies.getByRole("button", { name: title, exact: true }).click();
  await expect(pane(page).getByRole("heading", { level: 2, name: title })).toBeVisible();

  // Switched off in Settings: their page shows no list; back on, it's there again.
  const settingsSwitch = page.getByRole("switch", { name: "Record replies" });
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  await expect(settingsSwitch).toBeChecked();
  await expect(page.getByText("Their page lists what you started a reply to.", { exact: true })).toBeVisible();
  // Each switch waits for the server to keep it before leaving Settings, which would cut the save short.
  const saved = () => page.waitForResponse((response) => response.url().endsWith("/api/settings") && response.request().method() !== "GET");
  await Promise.all([saved(), settingsSwitch.click()]);
  await expect(settingsSwitch).not.toBeChecked();
  await expect(page.getByText("Nothing is recorded, and their pages show no list.")).toBeVisible();
  await theirPage();
  await expect(who.getByRole("heading", { name: "Replies you started" })).toHaveCount(0);
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  await Promise.all([saved(), settingsSwitch.click()]);
  await expect(settingsSwitch).toBeChecked();
  await theirPage();
  await expect(who.getByRole("region", { name: "Replies you started" }).getByRole("listitem")).toHaveCount(1);

  // When the list can't be loaded, one quiet line says so, rather than letting it seem gone.
  await page.route("**/api/feeds/*/replies", (route) => route.fulfill({ status: 500, body: "{}" }));
  await theirPage();
  await expect(who).toContainText("Replies you started couldn't be loaded.");
  await expect(who.getByRole("button", { name: "Add a note…" })).toBeVisible();
  // Try again keeps the keyboard on the group's heading while it asks again, and says so again if it fails.
  await who.getByRole("region", { name: "Replies you started" }).getByRole("button", { name: "Try again" }).click();
  await expect(who.getByRole("heading", { name: "Replies you started" })).toBeFocused();
  await expect(who).toContainText("Replies you started couldn't be loaded.");
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
