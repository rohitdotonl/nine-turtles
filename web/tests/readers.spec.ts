import { expect, test } from "@playwright/test";
import { TEST_PASSWORD } from "../playwright.config";
import { appReady, signIn } from "./screens";

// SPEC sections 1 and 18 (decision 0087): the owner's Readers and Sign-up in
// Settings, and joining through an invite link. Sign-up is one setting for
// the whole app, and both window sizes share one nine turtles, so the tests
// that change it run on the computer-sized window only.

const READER_PASSWORD = "slow mornings, long reads";

test("an invite link lets someone sign up, and closing sign-up stops it", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "sign-up is one setting for the whole app");
  await page.goto("/settings");
  await appReady(page);
  await signIn(page);
  await page.goto("/settings");

  const readers = page.getByRole("region", { name: "Readers", exact: true });
  await expect(readers.getByText("(you)")).toBeVisible();

  // Open waits for confirmation emails: shown, never chosen.
  const open = page.getByRole("radio", { name: "Open" });
  await expect(open).toBeDisabled();
  await expect(page.getByText(/Open, for anyone, becomes possible once/)).toBeVisible();

  await page.getByText("Invite link", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Invite link" })).toBeChecked();
  await page.getByRole("button", { name: "Make an invite link" }).click();
  // The keyboard goes to its Copy button, and the link shows this once.
  await expect(page.getByRole("button", { name: "Copy invite link" })).toBeFocused();
  // The ticket is after the #, which no server ever sees.
  const link = (await page.getByText(/\/sign-up#invite=[0-9a-f]{64}$/).textContent())!.trim();
  expect(link.startsWith(new URL(page.url()).origin)).toBe(true);

  // Someone else, in a browser of their own, follows the link.
  const stranger = await browser.newContext();
  const joining = await stranger.newPage();
  const asked: string[] = [];
  joining.on("request", (request) => asked.push(request.url()));
  await joining.goto(link);
  await expect(joining.getByLabel("Email")).toBeFocused();
  // Read, then taken out of the address bar at once, and never in an address sent anywhere.
  expect(new URL(joining.url()).hash).toBe("");
  expect(new URL(joining.url()).pathname).toBe("/sign-up");
  await expect(joining.getByLabel("Password")).toHaveAttribute("autocomplete", "new-password");
  const email = `reader-${Date.now()}@example.com`;
  await joining.keyboard.type(email);
  await joining.keyboard.press("Tab");
  await joining.keyboard.type("short");
  await joining.keyboard.press("Enter");
  await expect(joining.getByRole("status")).toHaveText("Choose a password of at least 12 characters.");
  await expect(joining.getByLabel("Password")).toHaveAttribute("aria-invalid", "true");
  await joining.getByLabel("Password").fill(READER_PASSWORD);
  await joining.keyboard.press("Enter");
  await expect(joining.locator("#sidebar")).toBeAttached();
  const ticket = new URL(link).hash.replace("#invite=", "");
  expect(asked.filter((address) => address.includes(ticket))).toEqual([]);
  // The new reader arrives in nine turtles, and isn't the owner: no Readers in their Settings.
  expect(new URL(joining.url()).pathname).not.toBe("/sign-up");
  const session = await joining.evaluate(async () => (await fetch("/api/session")).json());
  expect(session).toMatchObject({ signed_in: true, owner: false, email });
  await joining.goto("/settings");
  await expect(joining.getByText(/^Version /)).toBeVisible();
  await expect(joining.getByRole("heading", { name: "Readers", exact: true })).toHaveCount(0);

  // The owner sees them in the list, by email, and closes sign-up.
  await page.reload();
  await appReady(page);
  await expect(readers.getByText(email)).toBeVisible();
  await page.getByText("Closed", { exact: true }).click();
  await expect(page.getByText("Sign-up is closed. Any invite link no longer works.")).toBeVisible();

  // The old link now says calmly that sign-up isn't open.
  const late = await (await browser.newContext()).newPage();
  await late.goto(link);
  await late.getByLabel("Email").fill(`late-${Date.now()}@example.com`);
  await late.getByLabel("Password").fill(READER_PASSWORD);
  await late.getByRole("button", { name: "Sign up" }).click();
  await expect(late.getByRole("status")).toHaveText(
    "Sign-up isn't open. Ask whoever runs this nine turtles for a new invite link.",
  );
  await expect(late.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(late.locator("#sidebar")).toHaveCount(0);
  await stranger.close();
});

test("the sign-up page without an invite says sign-up isn't open", async ({ page }) => {
  await page.goto("/sign-up");
  await expect(page.getByRole("status")).toHaveText(
    "Sign-up isn't open. Ask whoever runs this nine turtles for an invite link.",
  );
  await expect(page.getByLabel("Password")).toHaveCount(0);
  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page.getByLabel("Email")).toBeFocused();
  expect(new URL(page.url()).pathname).toBe("/");
});

test("the owner sets their email and signs in with it", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "the owner has one email for the whole app");
  await page.goto("/");
  await appReady(page);
  await signIn(page);
  await page.goto("/settings");
  const field = page.getByLabel("Your email");
  // While the owner has no email, choosing Invite link says to save it first.
  const saveFirst = page.getByText(/^Save your own email under Readers before you send an invite link/);
  await page.getByText("Invite link", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Invite link" })).toBeChecked();
  await expect(saveFirst).toBeVisible();

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
  await expect(saveFirst).toHaveCount(0);

  // Closing Settings and opening it again shows the email just saved.
  await page.getByRole("button", { name: "Close settings" }).click();
  await page.locator("#sidebar").getByRole("link", { name: "Settings" }).click();
  await expect(field).toHaveValue("owner@example.com");
  await expect(saveFirst).toHaveCount(0);
  await page.getByText("Closed", { exact: true }).click();
  await expect(page.getByText("Sign-up is closed. Any invite link no longer works.")).toBeVisible();

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
