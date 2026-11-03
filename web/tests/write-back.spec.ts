import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// SPEC section 37 (writing back), "How to check it", done by a browser: an
// article of someone whose feed gives no address asks for it once, keeps it on
// their page, and from then on Write back is a link that opens the email app
// with the address and "Re: the title". Uses a blog of its own, since every
// test shares the one nine turtles that has feeds.

const pane = (page: Page) => page.getByRole("region", { name: "Article" });
/** Their page or its Edit, beside the list: "About Alpha" or "Edit Alpha" to screen readers, never the list's own name. */
const whoPage = (page: Page, name: string) => page.getByRole("region", { name: new RegExp(`^(About|Edit) ${name}$`) });

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
  await page.goto(new URL(`/people/${id}`, FEEDS_APP).href);
  await appReady(page);

  await page.locator(".item-row").first().click();
  const start = pane(page).getByRole("button", { name: `Write back to Blog ${name}` });
  await start.focus();
  await page.keyboard.press("Enter");
  const field = pane(page).getByRole("textbox", { name: "Their email address" });
  await expect(field).toBeFocused();
  // nine turtles looks on their site once; this made-up one can't be reached, so it asks.
  await expect(pane(page)).toContainText("nine turtles looked on their site and didn't find an address.");
  await expect(field).toHaveValue("");
  // Their site, to find the address on, opens in a new tab.
  const site = pane(page).getByRole("link", { name: "Find it on their site (opens in a new tab)" });
  await expect(site).toHaveAttribute("href", /^https?:\/\//);
  await expect(site).toHaveAttribute("target", "_blank");

  // Something that isn't an address is refused, in words, keeping what was typed.
  await field.fill("ivy at home");
  await pane(page).getByRole("button", { name: "Write back", exact: true }).click();
  await expect(pane(page).getByRole("status").filter({ hasText: "doesn't look like an email address" })).toBeVisible();
  await expect(field).toHaveValue("ivy at home");

  // Not now gives the keyboard back to the button.
  await pane(page).getByRole("button", { name: "Not now" }).click();
  await expect(start).toBeFocused();

  await page.keyboard.press("Enter");
  await field.fill("ivy@ivy.example");
  await pane(page).getByRole("button", { name: "Write back", exact: true }).click();
  const link = pane(page).getByRole("link", { name: `Write back to Blog ${name}` });
  await expect(link).toHaveAttribute("href", /^mailto:ivy@ivy\.example\?subject=Re%3A%20/);
  // The keyboard stays on Write back, now a link to the email app.
  await expect(link).toBeFocused();
  await expect(pane(page)).toContainText("ivy@ivy.example");

  // The More menu has it too.
  await page.getByRole("button", { name: "More actions" }).click();
  await expect(page.getByRole("menuitem", { name: /Write back/ })).toBeVisible();
  await page.keyboard.press("Escape");

  // Their page keeps it, and Edit can change it.
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  const about = whoPage(page, `Blog ${name}`);
  await expect(about.getByRole("link", { name: "ivy@ivy.example" })).toHaveAttribute("href", "mailto:ivy@ivy.example");
  await about.getByRole("button", { name: `Edit Blog ${name}` }).click();
  const edit = page.getByRole("textbox", { name: "Email address" });
  await expect(edit).toHaveValue("ivy@ivy.example");
  await edit.fill("ivy@letters.example");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page).toHaveURL(new RegExp(`/people/${id}/about$`));
  await expect(about.getByRole("link", { name: "ivy@letters.example" })).toBeVisible();
});
