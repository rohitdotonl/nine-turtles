import { expect, test, type Page } from "@playwright/test";
import { TEST_PASSWORD } from "../playwright.config";
import { appReady } from "./screens";

// Passkeys (SPEC sections 1 and 18, decision 0109), with Chrome's own
// virtual authenticator standing in for a fingerprint reader. The test
// nine turtles has no public address, so its passkeys belong to localhost:
// these tests open it as http://localhost, where the other tests use
// 127.0.0.1 (a numeric address can't hold a passkey, so there they're hidden).

/** The tests' nine turtles, at localhost instead of 127.0.0.1. */
const local = () => (test.info().project.use.baseURL ?? "").replace("127.0.0.1", "localhost");

/** A virtual passkey device on this page, that says yes at once (as a finger on the reader would). */
async function virtualDevice(page: Page) {
  const session = await page.context().newCDPSession(page);
  await session.send("WebAuthn.enable");
  const { authenticatorId } = await session.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { session, authenticatorId };
}

test("a passkey added in Settings signs in from the sign-in page, and the password still works", async ({ page, isMobile }) => {
  test.skip(isMobile, "One device is enough: the phone's run would add a second passkey to the same reader.");
  const { session, authenticatorId } = await virtualDevice(page);

  await page.goto(`${local()}/`);
  await appReady(page);
  // Offered here, where passkeys belong; the email field offers them among its suggestions.
  await expect(page.getByRole("button", { name: "Sign in with a passkey" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "username webauthn");

  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("#sidebar")).toBeAttached();
  await page.locator("#sidebar").getByRole("link", { name: "Settings" }).click();

  const group = page.getByRole("region", { name: "Passkeys" });
  await expect(group).toContainText("Sign in with your fingerprint, face or device PIN instead of a password.");
  await group.getByRole("button", { name: "Add a passkey" }).click();
  // The password first; the keyboard is already in its box.
  await expect(group.getByLabel("Your password")).toBeFocused();
  await page.keyboard.type("not my password");
  await page.keyboard.press("Enter");
  await expect(group.getByRole("status")).toHaveText("That isn't your password.");
  await group.getByLabel("Your password").fill(TEST_PASSWORD);
  await group.getByRole("button", { name: "Continue adding a passkey" }).click();
  await expect(group.getByRole("status")).toContainText("Passkey added.");
  await expect(group).toContainText(/Passkey added \d+ \w+ \d{4}/);
  await expect(group).toContainText("Not used yet");
  const { credentials } = await session.send("WebAuthn.getCredentials", { authenticatorId });
  expect(credentials).toHaveLength(1);
  expect(credentials[0]?.isResidentCredential).toBe(true);

  // Renamed: the reader's own name takes the date's place.
  await group.getByRole("button", { name: /^Rename/ }).click();
  await expect(group.getByLabel("Name of this passkey")).toBeFocused();
  await page.keyboard.type("This laptop");
  await page.keyboard.press("Enter");
  await expect(group).toContainText("This laptop");

  // Signed out, the email field offers the passkey among its suggestions;
  // Chrome's virtual device picks it at once, as a reader would, and it signs
  // in: no email, no password.
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.locator("#sidebar")).toBeAttached();
  await page.locator("#sidebar").getByRole("link", { name: "Settings" }).click();
  await expect(group).toContainText("Last used today");

  // Now the button, in a browser without passkey autofill.
  await page.addInitScript(() => {
    PublicKeyCredential.isConditionalMediationAvailable = async () => false;
  });
  // Signed out behind the page, so its own autofill can't sign straight back in first.
  expect((await page.request.post(`${local()}/api/sign-out`)).ok()).toBe(true);
  await page.goto(`${local()}/`);
  await appReady(page);
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await expect(page.locator("#sidebar")).toBeAttached();
  await page.locator("#sidebar").getByRole("link", { name: "Settings" }).click();

  // Removed, with Undo straight afterwards, which brings it back.
  await group.getByRole("button", { name: "Remove This laptop" }).click();
  await expect(group.getByRole("button", { name: "Undo" })).toBeFocused();
  await expect(group.getByRole("status")).toContainText("Your password still works.");
  await expect(group.getByRole("button", { name: "Remove This laptop" })).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(group).toContainText("This laptop");

  // Removed for real: the device's passkey no longer signs in, the password does.
  await group.getByRole("button", { name: "Remove This laptop" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByLabel("Password")).toBeVisible();
  await page.goto(`${local()}/`);
  await appReady(page);
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await expect(page.getByRole("status")).toHaveText("That passkey isn't one this nine turtles knows. Sign in with your password.");
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("#sidebar")).toBeAttached();
});

test("passkeys aren't offered where they can't work", async ({ page }) => {
  // 127.0.0.1 is a numeric address, not where this nine turtles' passkeys belong.
  await page.goto("/");
  await appReady(page);
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with a passkey" })).toHaveCount(0);
  await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "username");
});
