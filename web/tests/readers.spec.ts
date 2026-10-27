import { expect, test } from "@playwright/test";
import { TEST_PASSWORD } from "../playwright.config";
import { appReady, signIn } from "./screens";

// SPEC sections 1 and 18 (decisions 0087 and 0115): the owner's Readers in
// Settings, and joining from the sign-up page, which is open to anyone.

const READER_PASSWORD = "slow mornings, long reads";

test("anyone can sign up from the sign-in page, and the owner sees them", async ({ page, browser }, testInfo) => {
  // Someone else, in a browser of their own, finds Sign up under the sign-in form.
  const stranger = await browser.newContext();
  const joining = await stranger.newPage();
  await joining.goto("/");
  await appReady(joining);
  await joining.getByRole("link", { name: "Sign up" }).click();
  await expect(joining).toHaveURL(/\/sign-up$/);
  await expect(joining.getByLabel("Email")).toBeFocused();
  await expect(joining.getByLabel("Password")).toHaveAttribute("autocomplete", "new-password");
  const email = `reader-${testInfo.project.name}-${Date.now()}@example.com`;
  await joining.keyboard.type(email);
  await joining.keyboard.press("Tab");
  await joining.keyboard.type("short");
  await joining.keyboard.press("Enter");
  await expect(joining.getByRole("status")).toHaveText("Choose a password of at least 12 characters.");
  await expect(joining.getByLabel("Password")).toHaveAttribute("aria-invalid", "true");
  await joining.getByLabel("Password").fill(READER_PASSWORD);
  await joining.keyboard.press("Enter");
  await expect(joining.locator("#sidebar")).toBeAttached();
  // The new reader arrives in nine turtles, and isn't the owner: no Readers in their Settings.
  expect(new URL(joining.url()).pathname).not.toBe("/sign-up");
  const session = await joining.evaluate(async () => (await fetch("/api/session")).json());
  expect(session).toMatchObject({ signed_in: true, owner: false, email });
  await joining.goto("/settings");
  await expect(joining.getByText(/^Version /)).toBeVisible();
  await expect(joining.getByRole("heading", { name: "Readers", exact: true })).toHaveCount(0);

  // The same email can't sign up twice: Sign in is offered instead.
  const again = await (await browser.newContext()).newPage();
  await again.goto("/sign-up");
  await again.getByLabel("Email").fill(email);
  await again.getByLabel("Password").fill(READER_PASSWORD);
  await again.getByRole("button", { name: "Sign up" }).click();
  await expect(again.getByRole("status")).toHaveText("That email already has an account. Sign in instead.");
  await expect(again.getByRole("link", { name: "Sign in" })).toBeVisible();

  // The owner opens the Readers page from the keyboard and sees them, by
  // email, with how many feeds (decision 0090), and goes back with Escape.
  await page.goto("/settings");
  await appReady(page);
  await signIn(page);
  await page.goto("/settings");
  const readers = page.getByRole("region", { name: "Readers", exact: true });
  await expect(page.getByRole("heading", { name: "Sign-up" })).toHaveCount(0);
  await readers.getByRole("link", { name: /^All readers/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Readers", level: 2 })).toBeFocused();
  await expect(page).toHaveURL(/\/settings\/readers$/);
  const everyone = page.getByRole("region", { name: /^\d+ readers$/ });
  await expect(everyone.getByText("(you)")).toBeVisible();
  await expect(everyone.getByRole("listitem").filter({ hasText: email })).toContainText(/Joined .* · 0 feeds\s*Last here today\s*$/);
  await expect(page.getByRole("region", { name: "This nine turtles" }).getByText("Readers", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/settings$/);
  await stranger.close();
});

test("the owner sets their email and signs in with it", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "the owner has one email for the whole app");
  await page.goto("/");
  await appReady(page);
  await signIn(page);
  await page.goto("/settings");
  const field = page.getByLabel("Your email");
  await field.fill("not an email");
  await page.getByRole("button", { name: "Save your email" }).click();
  await expect(page.getByText("That doesn't look like an email address.")).toBeVisible();
  await expect(field).toHaveAttribute("aria-invalid", "true");

  // Saving it asks for the owner's password, so a device left signed in
  // can't send the owner's password links somewhere else.
  const password = page.getByLabel("Your password");
  await field.fill("owner@example.com");
  await page.getByRole("button", { name: "Save your email" }).click();
  await expect(page.getByText("Type your password too, to save your email.")).toBeVisible();
  await expect(password).toHaveAttribute("aria-invalid", "true");
  await password.fill("not the owner's password");
  await password.press("Enter");
  await expect(page.getByText("That isn't your password.")).toBeVisible();
  await expect(password).toHaveValue("");

  await password.fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Save your email" }).click();
  await expect(page.getByText(/^Saved\. You can sign in with owner@example\.com/)).toBeVisible();
  await expect(password).toHaveValue("");

  // Closing Settings and opening it again shows the email just saved.
  await page.getByRole("button", { name: "Close settings" }).click();
  await page.locator("#sidebar").getByRole("link", { name: "Settings" }).click();
  await expect(field).toHaveValue("owner@example.com");

  const other = await (await browser.newContext()).newPage();
  await other.goto("/");
  await appReady(other);
  await other.getByLabel("Email").fill("Owner@Example.com");
  await other.getByLabel("Password").fill(TEST_PASSWORD);
  await other.getByRole("button", { name: "Sign in" }).click();
  await expect(other.locator("#sidebar")).toBeAttached();
  const session = await other.evaluate(async () => (await fetch("/api/session")).json());
  expect(session).toMatchObject({ owner: true, email: "owner@example.com" });
});
