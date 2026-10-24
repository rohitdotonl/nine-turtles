import { expect, test } from "@playwright/test";
import { TEST_PASSWORD } from "../playwright.config";
import { appReady, signIn, tabTo } from "./screens";

// SPEC section 1, "How to check it", done by a browser. Everything here uses
// the keyboard only (the keyboard floor), except signIn, which other tests share.

test("a new browser sees only the password field", async ({ page }) => {
  await page.goto("/");
  await appReady(page);

  await expect(page.getByLabel("Password")).toBeFocused();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText("Nothing here yet.")).toHaveCount(0);
  await expect(page.locator("#sidebar")).toHaveCount(0);
});

test("a wrong password says so calmly and keeps you out", async ({ page }) => {
  await page.goto("/");
  await appReady(page);

  await page.keyboard.type("not the password");
  await page.keyboard.press("Enter");

  await expect(page.getByRole("status")).toHaveText("That isn't the password.");
  // The message sits between the field and the button, and the field is marked.
  await expect(page.getByLabel("Password")).toHaveAttribute("aria-invalid", "true");
  const message = (await page.getByRole("status").boundingBox())!;
  expect(message.y).toBeLessThan((await page.getByRole("button", { name: "Sign in" }).boundingBox())!.y);
  await expect(page.getByLabel("Password")).toHaveValue("");
  await expect(page.locator("#sidebar")).toHaveCount(0);
});

test("sign in with the keyboard, stay signed in, sign out", async ({ page }) => {
  await page.goto("/");
  await appReady(page);
  // The password field already has the keyboard's place.
  await page.keyboard.type(TEST_PASSWORD);
  await page.keyboard.press("Enter");
  await expect(page.locator("#sidebar")).toBeAttached();
  // The keyboard's place moves to the new screen's heading.
  await expect(page.getByRole("heading", { level: 1, name: "slowfeed" })).toBeFocused();

  // Still signed in after closing and reopening (a reload, here).
  await page.reload();
  await appReady(page);
  await expect(page.locator("#sidebar")).toBeAttached();

  // Sign out (in Settings) using only the keyboard.
  // A phone-narrow window shows one area at a time; Escape goes back to the feeds and Settings.
  if (!(await page.locator("#sidebar").isVisible())) await page.keyboard.press("Escape");
  await tabTo(page, page.getByRole("link", { name: "Settings" }));
  await page.keyboard.press("Enter");
  await expect(page.getByText(/^Version /)).toBeVisible();
  const signOut = page.getByRole("button", { name: "Sign out" });
  while (!(await signOut.evaluate((button) => button === document.activeElement))) {
    await page.keyboard.press("Tab");
  }
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Password")).toBeVisible();

  await page.reload();
  await appReady(page);
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("the browser's security rules block nothing slowfeed itself needs", async ({ page }) => {
  const blocked: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text())) blocked.push(message.text());
  });
  await page.goto("/");
  await appReady(page);
  await signIn(page);
  await page.evaluate(() => document.fonts.ready);

  expect(blocked).toEqual([]);
});
