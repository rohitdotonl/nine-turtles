import { expect, test, type Browser, type Page } from "@playwright/test";
import { MAILBOX, MAIL_APP, TEST_PASSWORD } from "../playwright.config";

// SPEC sections 1 and 18 (decision 0088): what email makes possible, against
// a nine turtles that sends its emails to a made-up mail server on this
// computer (tests/mail-server.mjs). Open sign-up with a confirmation link,
// "Forgot your password?", "Email me a sign-in link" (decision 0095),
// changing an email and deleting an account. Each
// test uses addresses of its own, so the two window sizes never meet.

const READER_PASSWORD = "slow mornings, long reads";
const NEW_PASSWORD = "a new page every morning";

type Mail = { to: string; subject: string; body: string };

/** The newest email to `to` with this subject, waiting for it to arrive; answers it and its link's path and fragment. */
async function newestMail(to: string, subject: string, count = 1): Promise<{ mail: Mail; link: string }> {
  let found: Mail[] = [];
  await expect
    .poll(async () => {
      found = ((await (await fetch(`${MAILBOX}/mail?to=${encodeURIComponent(to)}`)).json()) as Mail[]).filter(
        (one) => one.subject === subject,
      );
      return found.length;
    })
    .toBeGreaterThanOrEqual(count);
  const mail = found[found.length - 1]!;
  const url = /https?:\/\/\S+/.exec(mail.body)?.[0];
  return { mail, link: url ? url.replace(MAIL_APP, "") : "" };
}

/** The owner switches sign-up to Open (it's one setting for the whole app; doing it twice is harmless). */
async function openSignUp(browser: Browser) {
  const context = await browser.newContext({ baseURL: MAIL_APP });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("#sidebar")).toBeAttached();
  await page.goto("/settings");
  const open = page.getByRole("radio", { name: "Open" });
  await expect(open).toBeEnabled();
  await page.getByText("Open", { exact: true }).click();
  await expect(open).toBeChecked();
  await context.close();
}

/** Signs up while Open and follows the emailed link, in a browser of its own. */
async function newReader(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext({ baseURL: MAIL_APP });
  const page = await context.newPage();
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(READER_PASSWORD);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.locator("#sign-up-sent")).toContainText("A link to finish signing up is on its way");
  const { link } = await newestMail(email, "Confirm your email for nine turtles");
  await page.goto(link);
  await page.getByRole("button", { name: "Confirm email" }).click();
  await expect(page.locator("#sidebar")).toBeAttached();
  return page;
}

test("anyone can sign up while it's open, by the link emailed to them, with only the keyboard", async ({ browser }, testInfo) => {
  await openSignUp(browser);
  const context = await browser.newContext({ baseURL: MAIL_APP });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByLabel("Email")).toBeFocused();
  // Email, Password, Sign in, Email me a sign-in link, Forgot your password?, then Sign up.
  for (let step = 0; step < 5; step += 1) await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Sign up" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/sign-up$/);
  await expect(page.getByLabel("Email")).toBeFocused();

  const email = `open-${testInfo.project.name}-${Date.now()}@example.com`;
  await page.keyboard.type(email);
  await page.keyboard.press("Tab");
  await page.keyboard.type(READER_PASSWORD);
  await page.keyboard.press("Enter");
  // The form gives way to "Check your email", with the keyboard on it.
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeFocused();
  await expect(page.locator("#sign-up-sent")).toContainText(`A link to finish signing up is on its way to ${email}.`);
  await expect(page.getByText("Didn't get it? Look in your spam folder.")).toBeVisible();

  // Signing in before the link is opened says so calmly, and sends it again.
  await page.goto("/");
  await expect(page.getByLabel("Email")).toBeFocused();
  await page.keyboard.type(email);
  await page.keyboard.press("Tab");
  await page.keyboard.type(READER_PASSWORD);
  await page.keyboard.press("Enter");
  await expect(page.locator("#sign-in-message")).toHaveText(
    "Your email isn't confirmed yet. A new link is on its way: open it to finish signing up.",
  );

  const { mail, link } = await newestMail(email, "Confirm your email for nine turtles", 2);
  expect(mail.body).not.toContain("!");
  expect(link).toMatch(/^\/confirm-email#ticket=[0-9a-f]{64}$/);
  await page.goto(link);
  await expect(page.getByRole("button", { name: "Confirm email" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#sidebar")).toBeAttached();
  expect(new URL(page.url()).hash).toBe("");
  const session = await page.evaluate(async () => (await fetch("/api/session")).json());
  expect(session).toMatchObject({ signed_in: true, owner: false, email });

  // The link works once.
  await page.goto(link);
  await page.getByRole("button", { name: "Confirm email" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "This link has expired or was already used. Sign in, or sign up again for a new link.",
  );
  await context.close();
});

test("a forgotten password is set again by an emailed link, signing out other devices", async ({ browser }, testInfo) => {
  await openSignUp(browser);
  const email = `forgot-${testInfo.project.name}-${Date.now()}@example.com`;
  const laptop = await newReader(browser, email);

  const context = await browser.newContext({ baseURL: MAIL_APP });
  const page = await context.newPage();
  // A clock the test moves, to try Send again before and after its minute.
  await page.clock.install();
  await page.goto("/");
  await expect(page.getByLabel("Email")).toBeFocused();
  await page.keyboard.type(email);
  for (let step = 0; step < 4; step += 1) await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Forgot your password?" })).toBeFocused();
  await page.keyboard.press("Enter");
  // The email stays, and the keyboard goes back to it.
  await expect(page.getByLabel("Email")).toBeFocused();
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await expect(page.getByLabel("Password")).toHaveCount(0);
  await page.keyboard.press("Enter");
  // The form gives way to one clear answer, said once, with the keyboard on it;
  // Send again waits a minute, so it can't be pressed twice at once.
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeFocused();
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.locator("#link-sent")).toHaveText(
    `If ${email} has an account here, a link to choose a new password is on its way. It works for an hour.`,
  );
  await expect(page.getByText("nine turtles emails you a link")).toHaveCount(0);
  // Send again is there from the start, by keyboard too; within the minute it sends nothing.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Send again" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Give it a minute" })).toBeVisible();
  await page.clock.fastForward("01:01");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Another link is on its way." })).toBeVisible();
  // An address with no account hears exactly the same.
  await page.getByRole("link", { name: "Back to sign in" }).click();
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await page.getByLabel("Email").fill("nobody-here@example.com");
  await page.keyboard.press("Enter");
  await expect(page.locator("#link-sent")).toHaveText(
    "If nobody-here@example.com has an account here, a link to choose a new password is on its way. It works for an hour.",
  );

  const { link } = await newestMail(email, "A new password for nine turtles");
  expect(link).toMatch(/^\/reset-password#ticket=[0-9a-f]{64}$/);
  await page.goto(link);
  await expect(page.getByLabel("New password")).toBeFocused();
  await page.keyboard.type("short");
  await page.keyboard.press("Enter");
  await expect(page.locator("#reset-message")).toHaveText("Choose a password of at least 12 characters.");
  await expect(page.getByLabel("New password")).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("New password").fill(NEW_PASSWORD);
  await page.keyboard.press("Enter");
  await expect(page.locator("#sidebar")).toBeAttached();
  expect(new URL(page.url()).pathname).not.toBe("/reset-password");

  // The other device was signed out.
  await laptop.reload();
  await expect(laptop.getByLabel("Password")).toBeVisible();
  await laptop.context().close();
  await context.close();
});

test("a reader changes their email by a link to the new one, then deletes their account", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "the phone's sheets are screens; the flow is the same");
  await openSignUp(browser);
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const old = `move-${stamp}@example.com`;
  const next = `moved-${stamp}@example.com`;
  const page = await newReader(browser, old);

  await page.goto("/settings");
  const account = page.getByRole("region", { name: "Account", exact: true });
  await expect(account.getByText(old)).toBeVisible();
  await page.getByRole("button", { name: "Change… email" }).click();
  const sheet = page.getByRole("dialog", { name: "Change email" });
  await expect(sheet.getByLabel("New email")).toBeFocused();
  await page.keyboard.type(next);
  await page.keyboard.press("Tab");
  await page.keyboard.type("not my password");
  await page.keyboard.press("Enter");
  await expect(sheet.getByRole("status")).toHaveText("That isn't your password.");
  await sheet.getByLabel("Your password").fill(READER_PASSWORD);
  await page.keyboard.press("Enter");
  await expect(sheet).toHaveCount(0);
  await expect(account.getByRole("status").first()).toContainText(`A link is on its way to ${next}.`);
  // The keyboard is back on Change…, and nothing has changed yet.
  await expect(page.getByRole("button", { name: "Change… email" })).toBeFocused();
  await expect(account.getByText(old)).toBeVisible();

  const { link } = await newestMail(next, "Confirm your new email for nine turtles");
  await page.goto(link);
  // The page appears only once nine turtles has answered who is signed in, so
  // wait for its button to take the keyboard before pressing Enter.
  await expect(page.getByRole("button", { name: "Confirm email" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText(`Your email is now ${next}.`);
  const told = await newestMail(old, "Your nine turtles email was changed");
  expect(told.mail.body).toContain(next);
  await page.keyboard.press("Enter");
  await expect(page.locator("#sidebar")).toBeAttached();

  // Deleting: the downloads first, then the one "Are you sure?".
  await page.goto("/settings");
  // Told what the owner's Readers page shows of them (decision 0093).
  await expect(page.getByText(/^Whoever runs this nine turtles can see your email/)).toBeVisible();
  await page.getByRole("button", { name: "Delete account…" }).click();
  const sure = page.getByRole("dialog", { name: "Delete your account?" });
  await expect(sure.getByRole("heading", { name: "Delete your account?" })).toBeFocused();
  await expect(sure.getByRole("link", { name: "Export OPML" })).toHaveAttribute("href", "/api/opml");
  await expect(sure.getByRole("link", { name: "Export starred articles" })).toHaveAttribute("href", "/api/starred/export");
  // Escape keeps everything.
  await page.keyboard.press("Escape");
  await expect(sure).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete account…" })).toBeFocused();
  await page.keyboard.press("Enter");
  await sure.getByRole("button", { name: "Delete account" }).click();
  await expect(page.getByLabel("Password")).toBeVisible();

  await page.getByLabel("Email").fill(next);
  await page.getByLabel("Password").fill(READER_PASSWORD);
  await page.keyboard.press("Enter");
  await expect(page.locator("#sign-in-message")).toHaveText("That email and password don't match.");
  await page.context().close();
});

test("the owner's own account has no Delete account", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: MAIL_APP });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("#sidebar")).toBeAttached();
  await page.goto("/settings");
  await expect(page.getByText(/^Version /)).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete account…" })).toHaveCount(0);
  await expect(page.getByText(/^Whoever runs this nine turtles can see/)).toHaveCount(0);
  await context.close();
});

test("a reader signs in by an emailed link, once, with only the keyboard", async ({ browser }, testInfo) => {
  await openSignUp(browser);
  const email = `link-${testInfo.project.name}-${Date.now()}@example.com`;
  const laptop = await newReader(browser, email);

  const context = await browser.newContext({ baseURL: MAIL_APP });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByLabel("Email")).toBeFocused();
  await page.keyboard.type(email);
  for (let step = 0; step < 3; step += 1) await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Email me a sign-in link" })).toBeFocused();
  await page.keyboard.press("Enter");
  // The email stays, and the keyboard goes back to it.
  await expect(page.getByLabel("Email")).toBeFocused();
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await expect(page.getByLabel("Password")).toHaveCount(0);
  await expect(page.getByText("nine turtles emails you a link that signs you in.")).toBeVisible();
  await page.keyboard.press("Enter");
  // Said once, with the keyboard on it.
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeFocused();
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.locator("#link-sent")).toHaveText(
    `If ${email} has an account here, a link to sign in is on its way. It works once, for 15 minutes.`,
  );
  await expect(page.getByText("nine turtles emails you a link")).toHaveCount(0);
  // Send again within the minute sends nothing.
  await page.getByRole("button", { name: "Send again" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Give it a minute" })).toBeVisible();

  const { link } = await newestMail(email, "Sign in to nine turtles");
  expect(link).toMatch(/^\/sign-in-link#ticket=[0-9a-f]{64}$/);
  await page.goto(link);
  // Nothing happens until Sign in is pressed; the ticket leaves the address bar at once.
  await expect(page.getByRole("button", { name: "Sign in" })).toBeFocused();
  expect(new URL(page.url()).hash).toBe("");
  await page.keyboard.press("Enter");
  await expect(page.locator("#sidebar")).toBeAttached();
  expect(new URL(page.url()).pathname).not.toBe("/sign-in-link");

  // The other device stays signed in.
  await laptop.reload();
  await expect(laptop.locator("#sidebar")).toBeAttached();

  // A second time, the link has run out.
  const again = await browser.newContext({ baseURL: MAIL_APP });
  const second = await again.newPage();
  await second.goto(link);
  await second.getByRole("button", { name: "Sign in" }).click();
  await expect(second.getByRole("status").filter({ hasText: "This link has expired or was already used." })).toBeVisible();
  await second.getByRole("link", { name: "Sign in" }).click();
  await expect(second.getByLabel("Password")).toBeVisible();

  await again.close();
  await laptop.context().close();
  await context.close();
});
