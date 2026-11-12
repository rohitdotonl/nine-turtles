import { expect, test, type Page } from "@playwright/test";
import { FEEDS_APP } from "../playwright.config";
import { appReady, openReadingRoom, signIn } from "./screens";

// Getting out of the way (decision 0242): on a phone a tap on the text puts
// the article's bars away and another brings them back; the list's search
// waits behind its magnifier on a computer too; Write back at an article's
// end is outlined. (Unread's one dot in the sidebar is checked in
// marking.spec.ts.)

const article = (page: Page) => page.getByRole("region", { name: "Article", exact: true });
const toolbar = (page: Page) => article(page).getByRole("group", { name: "Article actions" });
const back = (page: Page) => article(page).getByRole("button", { name: /^Back to / });

/** Signs in and opens The pleasure of a slow letter, in Reading Room. */
async function openLetter(page: Page) {
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await openReadingRoom(page);
  await page.getByRole("button", { name: /The pleasure of a slow letter/ }).click();
  await expect(article(page).getByRole("heading", { level: 2, name: "The pleasure of a slow letter" })).toBeVisible();
}

/** Where a line of the text sits on the screen. */
const lineTop = (page: Page) => article(page).getByText("Three things, mostly").evaluate((element) => Math.round(element.getBoundingClientRect().top));

test("on a phone, a tap on the text puts the bars away, and another brings them back", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the phone's bars only");
  await openLetter(page);
  await expect(toolbar(page)).toBeVisible();
  const before = await lineTop(page);

  await article(page).getByText("Three things, mostly").click();
  // Away, but still there for screen readers.
  await expect(toolbar(page)).toHaveClass(/sr-only/);
  await expect(back(page)).toHaveCount(1);
  await expect(toolbar(page).getByRole("button", { name: "Next" })).toHaveCount(1);
  // The text stays where it was on the screen.
  expect(Math.abs((await lineTop(page)) - before)).toBeLessThanOrEqual(1);

  await article(page).getByText("Three things, mostly").click();
  await expect(toolbar(page)).not.toHaveClass(/sr-only/);
  await expect(back(page)).toBeVisible();
  expect(Math.abs((await lineTop(page)) - before)).toBeLessThanOrEqual(1);

  // A link in the text is the link's own: the bars stay.
  const link = article(page).getByRole("link", { name: "letter", exact: true });
  await link.evaluate((element) => element.addEventListener("click", (event) => event.preventDefault()));
  await link.click();
  await expect(toolbar(page)).toBeVisible();

  // A tap that closes a menu only closes it: the bars stay.
  await toolbar(page).getByRole("button", { name: "More actions" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await article(page).getByText("Three things, mostly").click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(toolbar(page)).toBeVisible();

  // Away, the keyboard reaching a bar brings them back.
  await article(page).getByText("Three things, mostly").click();
  await expect(toolbar(page)).toHaveClass(/sr-only/);
  await toolbar(page).getByRole("button", { name: "Star" }).focus();
  await expect(toolbar(page)).toBeVisible();

  // Away, reaching the article's end brings them back, with the end in view.
  await article(page).getByText("Three things, mostly").click();
  await expect(toolbar(page)).toHaveClass(/sr-only/);
  await page.locator(".reading-scroller").evaluate((element) => (element.scrollTop = element.scrollHeight));
  await expect(toolbar(page)).toBeVisible();
  await expect(article(page).getByRole("link", { name: /^Write back to/ })).toBeInViewport();
});

test("on a computer, the text is only text: a tap leaves the top bar where it is", async ({ page, isMobile }) => {
  test.skip(isMobile, "the computer's layout only");
  await openLetter(page);
  await article(page).getByText("Three things, mostly").click();
  await expect(article(page).getByRole("button", { name: "Star" }).first()).toBeVisible();
});

test("the list's search waits behind its magnifier, on a computer too", async ({ page, isMobile }) => {
  test.skip(isMobile, "the phone has always had it (phone.spec.ts)");
  await openLetter(page);
  const field = page.getByRole("textbox", { name: "Search articles", exact: true });
  const button = page.getByRole("button", { name: "Search", exact: true });
  // At rest, one field on screen: the sidebar's.
  await expect(field).toHaveCount(0);
  await expect(button).toHaveAttribute("title", "Search (/)");
  await button.click();
  await expect(field).toBeFocused();
  // Pressed again with nothing searched, it goes.
  await button.click();
  await expect(field).toHaveCount(0);
  // `/` opens it too, and while a search is on it stays.
  await page.keyboard.press("/");
  await expect(field).toBeFocused();
  await page.keyboard.type("slow");
  await expect(page.locator("#list-heading")).toHaveText(/^Results in /);
  await button.click();
  await expect(field).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(field).toHaveCount(0);
});

test("Write back at the end of an article is outlined, quieter than the writing", async ({ page }) => {
  await openLetter(page);
  const writeBack = article(page).getByRole("link", { name: /^Write back to/ });
  await expect(writeBack).toHaveClass(/\bbtn\b/);
  await expect(writeBack).not.toHaveClass(/btn-primary/);
});
