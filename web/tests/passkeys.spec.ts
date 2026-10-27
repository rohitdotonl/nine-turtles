import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { OWNER_EMAIL, TEST_PASSWORD } from "../playwright.config";
import { appReady } from "./screens";

// Passkeys (SPEC sections 1 and 18, decision 0109), with Chrome's own
// virtual authenticator standing in for a fingerprint reader. The test
// nine turtles has no public address, so its passkeys belong to localhost:
// these tests open it as http://localhost, where the other tests use
// 127.0.0.1 (a numeric address can't hold a passkey, so there they're hidden,
// and so the accessibility checks for them run here).

// One after another: the tests that add passkeys share one reader.
test.describe.configure({ mode: "serial" });

/** The tests' nine turtles, at localhost instead of 127.0.0.1. */
const local = () =>
  (test.info().project.use.baseURL ?? "").replace("127.0.0.1", "localhost");

/** The automatic WCAG checks, as tests/accessibility.spec.ts runs them. */
async function passesAccessibilityChecks(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags([
      "wcag2a",
      "wcag2aa",
      "wcag21a",
      "wcag21aa",
      "wcag22aa",
      "best-practice",
    ])
    .analyze();
  expect(results.violations).toEqual([]);
}

/** Presses Tab until `target` has the keyboard, as a reader without a mouse would. */
async function tabTo(page: Page, target: Locator) {
  for (let presses = 0; presses < 300; presses += 1) {
    if (
      await target
        .evaluate((element) => element === document.activeElement)
        .catch(() => false)
    )
      return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

/** A virtual passkey device on this page, that says yes at once (as a finger on the reader would). */
async function virtualDevice(page: Page) {
  const session = await page.context().newCDPSession(page);
  await session.send("WebAuthn.enable");
  const { authenticatorId } = await session.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  );
  return { session, authenticatorId };
}

test("a passkey added in Settings signs in from the sign-in page, and the password still works", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "One device is enough: the phone's run would add a second passkey to the same reader.",
  );
  const { session, authenticatorId } = await virtualDevice(page);
  let challenges = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/sign-in/passkey")) challenges += 1;
  });

  await page.goto(`${local()}/`);
  await appReady(page);
  // A device with no passkey for this site turns the email field's offer down
  // at once; it's asked again only after a pause, never in a loop that would
  // use up the server's challenges.
  await page.waitForTimeout(2_000);
  expect(challenges).toBeLessThanOrEqual(2);
  // Offered here, where passkeys belong; the email field offers them among its suggestions.
  await expect(
    page.getByRole("button", { name: "Sign in with a passkey" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveAttribute(
    "autocomplete",
    "username webauthn",
  );
  await passesAccessibilityChecks(page);

  await page.getByLabel("Email").fill(OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("#sidebar")).toBeAttached();
  await page
    .locator("#sidebar")
    .getByRole("link", { name: "Settings" })
    .click();

  const group = page.getByRole("region", { name: "Passkeys" });
  await expect(group).toContainText(
    "Sign in with your fingerprint, face or device PIN instead of a password.",
  );
  await group.getByRole("button", { name: "Add a passkey" }).click();
  // The password first; the keyboard is already in its box.
  await expect(group.getByLabel("Your password")).toBeFocused();
  await page.keyboard.type("not my password");
  await page.keyboard.press("Enter");
  await expect(group.getByRole("status")).toHaveText(
    "That isn't your password.",
  );
  await group.getByLabel("Your password").fill(TEST_PASSWORD);
  await group
    .getByRole("button", { name: "Continue adding a passkey" })
    .click();
  await expect(group.getByRole("status")).toContainText("Passkey added.");
  await expect(group).toContainText(/Passkey added \d+ \w+ \d{4}/);
  await expect(group).toContainText("Not used yet");
  const { credentials } = await session.send("WebAuthn.getCredentials", {
    authenticatorId,
  });
  expect(credentials).toHaveLength(1);
  expect(credentials[0]?.isResidentCredential).toBe(true);
  await passesAccessibilityChecks(page);

  // Renamed: the reader's own name takes the date's place.
  await group.getByRole("button", { name: /^Rename/ }).click();
  await expect(group.getByLabel("Name of this passkey")).toBeFocused();
  await passesAccessibilityChecks(page);
  await page.keyboard.type("This laptop");
  await page.keyboard.press("Enter");
  await expect(group).toContainText("This laptop");

  // Signed out, the email field offers the passkey among its suggestions;
  // Chrome's virtual device picks it at once, as a reader would, and it signs
  // in: no email, no password.
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.locator("#sidebar")).toBeAttached();
  await page
    .locator("#sidebar")
    .getByRole("link", { name: "Settings" })
    .click();
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
  await page
    .locator("#sidebar")
    .getByRole("link", { name: "Settings" })
    .click();

  // Removed, with Undo straight afterwards, which brings it back.
  await group.getByRole("button", { name: "Remove This laptop" }).click();
  await expect(group.getByRole("button", { name: "Undo" })).toBeFocused();
  await expect(group.getByRole("status")).toContainText(
    "Your password still works.",
  );
  await expect(
    group.getByRole("button", { name: "Remove This laptop" }),
  ).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(group).toContainText("This laptop");

  // Removed for real: the device's passkey no longer signs in, the password does.
  await group.getByRole("button", { name: "Remove This laptop" }).click();
  await expect(group.getByRole("status")).toContainText(
    "Your password still works.",
  );
  await page.getByRole("button", { name: "Sign out" }).click();
  // The sign-in page's own field: Settings › Readers has a "Your password"
  // box too, so a loose match would go on before signing out had finished.
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await page.goto(`${local()}/`);
  await appReady(page);
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "That passkey isn't one this nine turtles knows. Sign in with your password.",
  );
  await page.getByLabel("Email").fill(OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("#sidebar")).toBeAttached();
});

test("passkeys aren't offered where they can't work", async ({ page }) => {
  // 127.0.0.1 is a numeric address, not where this nine turtles' passkeys belong.
  await page.goto("/");
  await appReady(page);
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in with a passkey" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Email")).toHaveAttribute(
    "autocomplete",
    "username",
  );
});

test("a passkey is added, renamed and removed from the keyboard alone", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Keys are for screens with a keyboard.");
  const { session, authenticatorId } = await virtualDevice(page);

  await page.goto(`${local()}/`);
  await appReady(page);
  await tabTo(page, page.getByLabel("Email"));
  await page.keyboard.type(OWNER_EMAIL);
  await page.keyboard.press("Tab");
  await page.keyboard.type(TEST_PASSWORD);
  await page.keyboard.press("Enter");
  await expect(page.locator("#sidebar")).toBeAttached();
  await tabTo(
    page,
    page.locator("#sidebar").getByRole("link", { name: "Settings" }),
  );
  await page.keyboard.press("Enter");

  const group = page.getByRole("region", { name: "Passkeys" });
  const addButton = group.getByRole("button", { name: "Add a passkey" });
  await tabTo(page, addButton);

  // Escape in the password box goes back to Add a passkey, and Settings stays open.
  await page.keyboard.press("Enter");
  await expect(group.getByLabel("Your password")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(addButton).toBeFocused();
  await expect(group.getByLabel("Your password")).toHaveCount(0);
  // So does Cancel, the next key along.
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(
    group.getByRole("button", { name: "Cancel adding a passkey" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(addButton).toBeFocused();

  // Added: the password, then Enter, and the device says yes.
  await page.keyboard.press("Enter");
  await page.keyboard.type(TEST_PASSWORD);
  await page.keyboard.press("Enter");
  await expect(group.getByRole("status")).toContainText("Passkey added.");
  await expect(addButton).toBeFocused();
  const { credentials } = await session.send("WebAuthn.getCredentials", {
    authenticatorId,
  });
  expect(credentials).toHaveLength(1);

  // Renamed: Rename (back past Remove), the name, Enter; the keyboard comes back to Rename.
  const rename = group.getByRole("button", { name: /^Rename Passkey added/ });
  await page.keyboard.press("Shift+Tab");
  await expect(
    group.getByRole("button", { name: /^Remove Passkey added/ }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(rename).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(group.getByLabel("Name of this passkey")).toBeFocused();
  await page.keyboard.type("Keyboard");
  await page.keyboard.press("Enter");
  await expect(
    group.getByRole("button", { name: "Rename Keyboard" }),
  ).toBeFocused();

  // Removed, Undo has the keyboard; Enter brings it back. Removed again to leave things tidy.
  await page.keyboard.press("Tab");
  await expect(
    group.getByRole("button", { name: "Remove Keyboard" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(group.getByRole("button", { name: "Undo" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(group).toContainText("Keyboard");
  await tabTo(page, group.getByRole("button", { name: "Remove Keyboard" }));
  await page.keyboard.press("Enter");
  await expect(group.getByRole("button", { name: "Undo" })).toBeFocused();
});

test("Settings › Passkeys passes the accessibility checks, and Cancel leaves the password row", async ({
  page,
}) => {
  await page.goto(`${local()}/`);
  await appReady(page);
  await page.getByLabel("Email").fill(OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("#sidebar")).toBeAttached();
  await page.goto(`${local()}/settings`);
  const group = page.getByRole("region", { name: "Passkeys" });
  await expect(group).toBeVisible();
  await passesAccessibilityChecks(page);

  await group.getByRole("button", { name: "Add a passkey" }).click();
  await expect(group.getByLabel("Your password")).toBeFocused();
  await page.getByRole("button", { name: "Continue adding a passkey" }).click();
  await expect(group.getByRole("status")).toHaveText(
    "Type your password first, to add a passkey.",
  );
  await passesAccessibilityChecks(page);

  await group.getByRole("button", { name: "Cancel adding a passkey" }).click();
  await expect(group.getByLabel("Your password")).toHaveCount(0);
  await expect(
    group.getByRole("button", { name: "Add a passkey" }),
  ).toBeFocused();
});
