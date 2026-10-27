import { expect, test } from "@playwright/test";
import { OWNER_EMAIL, TEST_PASSWORD } from "../playwright.config";
import { appReady, ownerHasEmail, signIn, tabTo } from "./screens";

// SPEC section 1, "How to check it", done by a browser. Everything here uses
// the keyboard only (the keyboard floor), except signIn, which other tests share.

test("a new browser sees only the email and password fields", async ({ page }) => {
  await page.goto("/");
  await appReady(page);

  // The email first, as password managers expect; everyone, the owner too, fills in both (decision 0116).
  await expect(page.getByLabel("Email")).toBeFocused();
  await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "username");
  await expect(page.getByLabel("Password")).toHaveAttribute("autocomplete", "current-password");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText("Nothing here yet.")).toHaveCount(0);
  await expect(page.locator("#sidebar")).toHaveCount(0);
});

test("sign-in is one centred column, at the phone's one 20px margin, the button 12px under the field", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  await appReady(page);
  const email = (await page.getByLabel("Email").boundingBox())!;
  const field = page.getByLabel("Password");
  // The two fields 12px apart, the email above, at the same margins.
  expect(Math.abs((await field.boundingBox())!.y - (email.y + email.height) - 12)).toBeLessThan(1);
  expect(Math.abs(email.x - 20)).toBeLessThan(1);
  await expect(page.getByLabel("Email")).toHaveAttribute("placeholder", "Email");
  const button = page.getByRole("button", { name: "Sign in" });
  const [fieldBox, buttonBox] = [(await field.boundingBox())!, (await button.boundingBox())!];
  // The same margin as every other phone screen (decision 0048).
  expect(Math.abs(fieldBox.x - 20)).toBeLessThan(1);
  expect(Math.abs(fieldBox.x + fieldBox.width - 370)).toBeLessThan(1);
  // Nothing kept between them while there's no message; the field's name is its placeholder.
  expect(Math.abs(buttonBox.y - (fieldBox.y + fieldBox.height) - 12)).toBeLessThan(1);
  await expect(field).toHaveAttribute("placeholder", "Password");
  // The button's corners match the field's.
  await expect(button).toHaveCSS("border-top-left-radius", "8px");
  await expect(field).toHaveCSS("border-top-left-radius", "8px");
});

test("the logo stands above the name on sign-in and before it in the sidebar, hidden from screen readers", async ({ page }) => {
  await page.goto("/");
  await appReady(page);
  // Sign-in: the nine turtles above the wordmark (decision 0067).
  const logo = page.locator("svg.logo");
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute("aria-hidden", "true");
  const name = page.getByRole("heading", { level: 1, name: "nine turtles" });
  expect((await logo.boundingBox())!.y).toBeLessThan((await name.boundingBox())!.y);

  // The sidebar: the logo inside the wordmark, before the words, which alone name it.
  await signIn(page);
  const wordmark = page.getByRole("heading", { level: 1 });
  await expect(wordmark).toHaveText("nine turtles");
  const sidebarLogo = wordmark.locator("svg.logo");
  await expect(sidebarLogo).toBeVisible();
  await expect(sidebarLogo).toHaveAttribute("aria-hidden", "true");
  await expect(sidebarLogo).toHaveAttribute("focusable", "false");
});

test("a wrong password says so calmly and keeps you out", async ({ page, request }, testInfo) => {
  await ownerHasEmail(request);
  await page.goto("/");
  await appReady(page);
  const fieldBefore = (await page.getByLabel("Password").boundingBox())!;

  // An email of its own, so these wrong tries never make the owner wait.
  await page.keyboard.type(`wrong-${testInfo.project.name}@example.com`);
  await page.keyboard.press("Tab");
  await page.keyboard.type("not the password");
  await page.keyboard.press("Enter");

  await expect(page.getByRole("status")).toHaveText("That email and password don't match.");
  expect((await page.getByLabel("Password").boundingBox())!.y).toBe(fieldBefore.y);
  // The message sits between the field and the button, and the field is marked. The room for
  // it is kept below the button, so the field and the title above it don't move (decision 0048).
  await expect(page.getByLabel("Password")).toHaveAttribute("aria-invalid", "true");
  const message = (await page.getByRole("status").boundingBox())!;
  expect(message.y).toBeLessThan((await page.getByRole("button", { name: "Sign in" }).boundingBox())!.y);
  await expect(page.getByLabel("Password")).toHaveValue("");
  await expect(page.locator("#sidebar")).toHaveCount(0);
});

test("while signing in, the button says it's busy and a second press sends nothing more", async ({ page, request }, testInfo) => {
  await ownerHasEmail(request);
  await page.goto("/");
  await appReady(page);
  // Hold the answer back, so the page stays busy for as long as the test needs.
  let requests = 0;
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/sign-in", async (route) => {
    requests += 1;
    await held;
    await route.continue();
  });

  await page.keyboard.type(`busy-${testInfo.project.name}@example.com`);
  await page.keyboard.press("Tab");
  await page.keyboard.type("not the password");
  await page.keyboard.press("Enter");
  const button = page.getByRole("button", { name: "Sign in" });
  // Busy is said with aria-disabled, not disabled, so the button keeps its look and the keyboard's place (decision 0045).
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await expect(button).not.toHaveAttribute("disabled");
  await page.keyboard.press("Enter");
  // A press on the button itself (forced: Playwright waits for anything aria-disabled).
  await button.click({ force: true });
  expect(requests).toBe(1);

  release();
  await expect(page.getByRole("status")).toHaveText("That email and password don't match.");
  await expect(button).not.toHaveAttribute("aria-disabled", "true");
  expect(requests).toBe(1);
});

test("sign in with the keyboard, stay signed in, sign out", async ({ page, isMobile }) => {
  await page.goto("/");
  await appReady(page);
  // The email field has the keyboard's place: the email, then Tab on to the password.
  await page.keyboard.type(OWNER_EMAIL);
  await page.keyboard.press("Tab");
  await page.keyboard.type(TEST_PASSWORD);
  await page.keyboard.press("Enter");
  await expect(page.locator("#sidebar")).toBeAttached();
  // The keyboard's place moves to the new screen's heading: what there is to read (here, with no
  // feeds yet, the welcome's), or on a phone's feeds screen its name (decision 0118).
  if (isMobile) await expect(page.getByRole("heading", { level: 1, name: "nine turtles" })).toBeFocused();
  else await expect(page.getByRole("heading", { level: 2, name: "A quiet place to read." })).toBeFocused();

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
  // The sign-in page's own field, not Settings › Readers' "Your password".
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();

  await page.reload();
  await appReady(page);
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("without an email, nothing is sent and the email field is asked for", async ({ page }) => {
  await page.goto("/");
  await appReady(page);
  let requests = 0;
  await page.route("**/api/sign-in", async (route) => {
    requests += 1;
    await route.continue();
  });
  // The password alone signs nobody in (decision 0116).
  await page.keyboard.press("Tab");
  await page.keyboard.type(TEST_PASSWORD);
  await page.keyboard.press("Enter");

  await expect(page.getByRole("status")).toHaveText("Type your email too.");
  await expect(page.getByLabel("Email")).toBeFocused();
  expect(requests).toBe(0);
  await expect(page.locator("#sidebar")).toHaveCount(0);
});

test("a wrong password never says whether the email has an account", async ({ page, request }) => {
  await ownerHasEmail(request);
  await page.goto("/");
  await appReady(page);
  await page.keyboard.type("nobody-here@example.com");
  await page.keyboard.press("Tab");
  await page.keyboard.type("not the password");
  await page.keyboard.press("Enter");

  await expect(page.getByRole("status")).toHaveText("That email and password don't match.");
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Password")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#sidebar")).toHaveCount(0);
});

test("the browser's security rules block nothing nine turtles itself needs", async ({ page }) => {
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
