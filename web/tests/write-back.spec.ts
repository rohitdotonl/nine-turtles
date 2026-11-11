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
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  // Nothing known yet: their page has no address.
  await expect(whoPage(page, `Blog ${name}`).getByRole("heading", { level: 2, name: `Blog ${name}` })).toBeVisible();
  await expect(whoPage(page, `Blog ${name}`)).not.toContainText("Email");
  // "Write to", the solid button under their name, opens the same box as Write back (the owner's core path, point 9).
  await expect(whoPage(page, `Blog ${name}`).getByRole("button", { name: `Write to Blog ${name}` })).toHaveClass(/btn-primary/);
  await expect(whoPage(page, `Blog ${name}`)).not.toContainText("A person ·");
  await page.goto(new URL(`/people/${id}`, FEEDS_APP).href);
  await appReady(page);

  await page.locator(".item-row").first().click();
  const start = pane(page).getByRole("button", { name: `Write back to Blog ${name}` });
  // Outlined at an article's end (decision 0242); solid on their page, above.
  await expect(start).not.toHaveClass(/btn-primary/);
  await start.focus();
  await page.keyboard.press("Enter");
  const field = pane(page).getByRole("textbox", { name: "Their email address" });
  await expect(field).toBeFocused();
  // nine turtles tries to look on their site; this made-up one can't be reached, and it says so.
  await expect(pane(page)).toContainText("Their site couldn't be checked for an address.");
  await expect(field).toHaveValue("");
  // Their site, to find the address on, opens in a new tab.
  const site = pane(page).getByRole("link", { name: "Find it on their site (opens in a new tab)" });
  await expect(site).toHaveAttribute("href", /^https?:\/\//);
  await expect(site).toHaveAttribute("target", "_blank");

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
  await expect(pane(page)).toContainText("ivy@ivy.example");

  // The paper plane beside Star has it too, one press from the text (decision 0214); More doesn't any more.
  await expect(pane(page).locator(".reading-bar").getByRole("button", { name: "Write back", exact: true })).toHaveAttribute("title", "Write back (W)");
  await page.getByRole("button", { name: "More actions" }).click();
  await expect(page.getByRole("menuitem", { name: /Write back/ })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Words chosen offer Write back about this (decision 0205); once highlighted, Write back starts the email with them, quoted.
  await choose(page, "made-up summary");
  const words = page.getByRole("menu", { name: "Chosen words" });
  await expect(words.getByRole("menuitem", { name: "Write back about this" })).toBeVisible();
  await words.getByRole("menuitem", { name: /Highlight/ }).click();
  await page.getByRole("menu", { name: "Highlight" }).getByRole("menuitem", { name: "Done" }).click();
  await expect(link).toHaveAttribute("href", /^mailto:ivy@ivy\.example\?subject=Re%3A%20.*&body=%3E%20made-up%20summary%0A%0A$/);
  await expect(pane(page)).toContainText("Your email starts with the words you highlighted.");
  // A highlight pressed offers it too.
  await pane(page).locator("mark.highlight").click();
  await expect(page.getByRole("menu", { name: "Highlight" }).getByRole("menuitem", { name: "Write back about this" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Their page keeps it, and Change beside it corrects it in place.
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
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
  await page.goto(new URL(`/people/${id}`, FEEDS_APP).href);
  await appReady(page);
  await page.locator(".item-row").first().click();
  await pane(page).getByRole("button", { name: /^Write back to/ }).click();
  const field = pane(page).getByRole("textbox", { name: "Their email address" });
  await expect(pane(page)).toContainText("Found on their site. Check it, then press Write back.");
  await expect(field).toHaveValue(`${name}@${name}.example`);
  // The address is there, so the button to go and find it isn't.
  const site = pane(page).getByRole("link", { name: "Find it on their site (opens in a new tab)" });
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
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  await expect(who().getByRole("link", { name: `Write to Blog ${name}` })).toHaveAttribute("href", /^mailto:pub@pub\.example/);

  // Made a publication: Write to and its address go as soon as it's chosen (decision 0192).
  await who().getByRole("radio", { name: "A publication" }).check();
  await expect(who().getByText(`Write to Blog ${name}`)).toHaveCount(0);
  await expect(who()).not.toContainText("pub@pub.example");

  // Its article ends with no Write back, there's no paper plane, and W (which would ask for the
  // unknown address, as in the first test) does nothing.
  await page.goto(new URL(`/publications/${id}`, FEEDS_APP).href);
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
  await page.goto(new URL(`/publications/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  await who().getByRole("radio", { name: "A person" }).check();
  await expect(who().getByRole("link", { name: `Write to Blog ${name}` })).toHaveAttribute("href", /^mailto:pub@pub\.example/);
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
  await page.goto(new URL(`/people/${id}`, FEEDS_APP).href);
  await appReady(page);
  await page.locator(".item-row").first().click();
  const plane = pane(page).locator(".reading-bar").getByRole("button", { name: "Write back", exact: true });

  // With no address known, the paper plane opens the box; Escape puts it away, as Not now does, and the keyboard goes back to Write back.
  await plane.click();
  const field = pane(page).getByRole("textbox", { name: "Their email address" });
  await expect(field).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(field).toHaveCount(0);
  await expect(pane(page).getByRole("button", { name: `Write back to Notes ${name}` })).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`/people/${id}/`));

  // A note has no title: the email is about its opening words, so the writer knows which post.
  expect((await page.request.post(new URL(`/api/feeds/${id}/write-to`, FEEDS_APP).href, { data: { address: "notes@notes.example" } })).ok()).toBe(true);
  await page.reload();
  await appReady(page);
  await expect(pane(page).getByRole("link", { name: `Write back to Notes ${name}` })).toHaveAttribute(
    "href",
    "mailto:notes@notes.example?subject=Re%3A%20Walked%20to%20the%20river%20before%20breakfast%20and%20watched%20the%20herons%E2%80%A6",
  );

  // The paper plane at the top, with the line under Write back below the screen: the reading area's foot says the email app is opening (decision 0229).
  await plane.click();
  const note = pane(page).locator(".away");
  await expect(note).toContainText("Opening your email app… Nothing opened?");
  await note.getByRole("button", { name: "Copy their address" }).click();
  await expect(note).toContainText(/^Copied\.|The address couldn't be copied\. It's notes@notes\.example/);
  await note.getByRole("button", { name: "Close the note" }).click();
  await expect(note.getByText(/Opening your email app|Copied/)).toHaveCount(0);

  // By keyboard: W says it at the foot; Copy their address is pressed with Enter, and the keyboard goes back to the article.
  await page.locator(".item-row").first().focus();
  await page.keyboard.press("w");
  await expect(note).toContainText("Opening your email app… Nothing opened?");
  await note.getByRole("button", { name: "Copy their address" }).focus();
  await page.keyboard.press("Enter");
  await expect(note).toContainText(/Copied\.|The address couldn't be copied\. It's notes@notes\.example/);
  await expect(pane(page).getByRole("heading", { level: 2 })).toBeFocused();
  // It goes with the article.
  await page.keyboard.press("w");
  await expect(note).toContainText("Opening your email app…");
  await page.locator(".item-row").nth(1).click();
  await expect(note.getByText(/Opening your email app/)).toHaveCount(0);
});
