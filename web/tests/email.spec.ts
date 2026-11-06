import { expect, test, type Browser, type Page } from "@playwright/test";
import { MAILBOX, MAIL_APP, OWNER_EMAIL, TEST_PASSWORD } from "../playwright.config";
import { settingsSaved } from "./screens";

// SPEC sections 1 and 18 (decision 0088): what email makes possible, against
// a nine turtles that sends its emails to a made-up mail server on this
// computer (tests/mail-server.mjs). Sign-up (which confirms the address by
// an emailed link first, decision 0154), "Forgot your password?", "Email me a sign-in link" (decision 0096),
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

/** Signs up, in a browser of its own, and follows the emailed link that makes the account (decision 0154). */
async function newReader(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext({ baseURL: MAIL_APP });
  const page = await context.newPage();
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(READER_PASSWORD);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  const { link } = await newestMail(email, "Confirm your email for nine turtles");
  await page.goto(link);
  await page.getByLabel("Password", { exact: true }).fill(READER_PASSWORD);
  await page.getByRole("button", { name: "Confirm email" }).click();
  await page.getByRole("link", { name: "Open nine turtles" }).click();
  await expect(page.locator("#sidebar")).toBeAttached();
  return page;
}

test("anyone can sign up by confirming their email, with only the keyboard", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ baseURL: MAIL_APP });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByLabel("Email")).toBeFocused();
  // Email, Password, Forgot?, Sign in, then Sign up (decision 0122).
  for (let step = 0; step < 4; step += 1) await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Sign up" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/sign-up$/);
  await expect(page.getByLabel("Email")).toBeFocused();
  // Each field named above it; the password's helper line under it; Sign in, for those who have an account, under Sign up.
  await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "email");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "new-password");
  await expect(page.getByText("At least 12 characters.")).toBeVisible();
  await expect(page.getByText("Have an account?")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

  const email = `open-${testInfo.project.name}-${Date.now()}@example.com`;
  await page.keyboard.type(email);
  await page.keyboard.press("Tab");
  await page.keyboard.type(READER_PASSWORD);
  await page.keyboard.press("Enter");
  // Nothing is made yet: "Check your email" takes the form's place, and the keyboard goes to it (decision 0154).
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeFocused();
  await expect(page.getByText(`A link is on its way to ${email}.`)).toBeVisible();
  await expect(page.getByText("Didn't get it? Look in your spam folder.")).toBeVisible();
  expect((await page.evaluate(async () => (await fetch("/api/session")).json())).signed_in).toBe(false);
  // Send again within the minute sends nothing and says so.
  await page.getByRole("button", { name: "Send again" }).click();
  await expect(page.getByText("The link went less than a minute ago.", { exact: false })).toBeVisible();
  // Use another email returns to the form with the email kept and the keyboard in it.
  await page.getByRole("link", { name: "Use another email" }).click();
  await expect(page.getByLabel("Email")).toBeFocused();
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await page.keyboard.press("Tab");
  await page.keyboard.type(READER_PASSWORD);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeFocused();

  // The email's link opens a page that asks for the password chosen, so only whoever signed up can finish it.
  const { mail, link } = await newestMail(email, "Confirm your email for nine turtles");
  expect(mail.body).toContain("24 hours");
  expect(link).toMatch(/^\/finish-sign-up#ticket=/);
  await page.goto(link);
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  await page.keyboard.type("not the password at all");
  await page.keyboard.press("Enter");
  await expect(page.getByText("That isn't the password you chose when you signed up.")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await page.keyboard.type(READER_PASSWORD);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "You're signed up" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Open nine turtles" })).toBeFocused();
  await page.keyboard.press("Enter");
  // In nine turtles, signed in as the new reader, their address confirmed.
  await expect(page.locator("#sidebar")).toBeAttached();
  const session = await page.evaluate(async () => (await fetch("/api/session")).json());
  expect(session).toMatchObject({ signed_in: true, owner: false, email, email_confirmed: true });
  // The same link again: the form gives way to why, and the keyboard goes there.
  await page.goto(link);
  await page.getByLabel("Password", { exact: true }).fill(READER_PASSWORD);
  await page.getByRole("button", { name: "Confirm email" }).click();
  await expect(page.getByText("This link has expired or was already used. Sign up again for a new one.")).toBeFocused();
  await context.close();
});

test("Forgot? emails a link that signs in, then a new password can be chosen, signing out other devices", async ({ browser }, testInfo) => {
  const email = `forgot-${testInfo.project.name}-${Date.now()}@example.com`;
  const laptop = await newReader(browser, email);

  const context = await browser.newContext({ baseURL: MAIL_APP });
  const page = await context.newPage();
  // A clock the test moves, to try Send again before and after its minute.
  await page.clock.install();
  await page.goto("/");
  await expect(page.getByLabel("Email")).toBeFocused();
  await page.keyboard.type(email);
  // Email, Password, then Forgot? (decision 0122).
  for (let step = 0; step < 2; step += 1) await page.keyboard.press("Tab");
  const forgot = page.getByRole("link", { name: "Forgot?" });
  await expect(forgot).toBeFocused();
  // Small to the eye, on the password name's line at the right, but 44px to touch, never over a field.
  const [forgotBox, name, field, emailBox] = [
    (await forgot.boundingBox())!,
    (await page.locator('label[for="password"]').boundingBox())!,
    (await page.getByLabel("Password", { exact: true }).boundingBox())!,
    (await page.getByLabel("Email").boundingBox())!,
  ];
  expect(forgotBox.height).toBeGreaterThanOrEqual(44);
  expect(forgotBox.width).toBeGreaterThanOrEqual(44);
  expect(Math.abs(forgotBox.x + forgotBox.width - (field.x + field.width))).toBeLessThan(1);
  expect(Math.abs(forgotBox.y + forgotBox.height - (name.y + name.height))).toBeLessThan(1);
  expect(forgotBox.y).toBeGreaterThanOrEqual(emailBox.y + emailBox.height - 0.5);
  expect(forgotBox.y + forgotBox.height).toBeLessThanOrEqual(field.y);
  await page.keyboard.press("Enter");
  // The email stays, and the keyboard goes back to it.
  await expect(page.getByLabel("Email")).toBeFocused();
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "email");
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await expect(page.getByText("We'll email you a link that signs you in. You can choose a new password after.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Email me a link" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to sign in" })).toBeVisible();
  await page.keyboard.press("Enter");
  // The form gives way to one clear answer, said once, with the keyboard on it;
  // Send again waits a minute, so it can't be pressed twice at once.
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeFocused();
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.locator("#link-sent")).toHaveText(
    `If ${email} has an account here, a link is on its way. It works once, within 15 minutes.`,
  );
  await expect(page.getByText("We'll email you a link")).toHaveCount(0);
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
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Forgot?" }).click();
  await page.getByLabel("Email").fill("nobody-here@example.com");
  await page.keyboard.press("Enter");
  await expect(page.locator("#link-sent")).toHaveText(
    "If nobody-here@example.com has an account here, a link is on its way. It works once, within 15 minutes.",
  );

  // The email is the sign-in link, saying a new password can be chosen once in.
  const { mail, link } = await newestMail(email, "Sign in to nine turtles");
  expect(mail.body).toContain("you can choose a new password");
  expect(link).toMatch(/^\/sign-in-link#ticket=[0-9a-f]{64}$/);
  await page.goto(link);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeFocused();
  await page.keyboard.press("Enter");
  // Signed in, and offered a new password, with the keyboard on what replaced the button.
  await expect(page.getByRole("heading", { name: "You're signed in" })).toBeFocused();
  await expect(page.getByText("Choose a new password, if you like.")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("New password", { exact: true })).toBeFocused();
  await expect(page.getByLabel("New password", { exact: true })).toHaveAttribute("autocomplete", "new-password");
  await page.keyboard.type("short");
  await page.keyboard.press("Enter");
  await expect(page.locator("#choose-message")).toHaveText("Choose a password of at least 12 characters.");
  await expect(page.getByLabel("New password", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
  await page.keyboard.press("Enter");
  await expect(page.locator("#sidebar")).toBeAttached();
  expect(new URL(page.url()).pathname).not.toBe("/sign-in-link");

  // The other device was signed out; the new password signs in, the old one doesn't.
  await laptop.reload();
  await expect(laptop.getByLabel("Password", { exact: true })).toBeVisible();
  await laptop.getByLabel("Email").fill(email);
  await laptop.getByLabel("Password", { exact: true }).fill(READER_PASSWORD);
  await laptop.keyboard.press("Enter");
  await expect(laptop.locator("#sign-in-message")).toHaveText("That email and password don't match.");
  await laptop.getByLabel("Password", { exact: true }).fill(NEW_PASSWORD);
  await laptop.keyboard.press("Enter");
  await expect(laptop.locator("#sidebar")).toBeAttached();
  await laptop.context().close();
  await context.close();
});

test("an older password link still sets a new password", async ({ browser }, testInfo) => {
  // Sent by "Forgot your password?" before decision 0122: such links keep working for their hour.
  const email = `old-link-${testInfo.project.name}-${Date.now()}@example.com`;
  const laptop = await newReader(browser, email);
  const asked = await laptop.request.post("/api/password/forgot", { data: { email } });
  expect(asked.status()).toBe(202);
  const { link } = await newestMail(email, "A new password for nine turtles");
  expect(link).toMatch(/^\/reset-password#ticket=[0-9a-f]{64}$/);
  const context = await browser.newContext({ baseURL: MAIL_APP });
  const page = await context.newPage();
  await page.goto(link);
  await expect(page.getByLabel("New password", { exact: true })).toBeFocused();
  await page.keyboard.type(NEW_PASSWORD);
  await page.keyboard.press("Enter");
  await expect(page.locator("#sidebar")).toBeAttached();
  await laptop.context().close();
  await context.close();
});

test("a reader changes their email by a link to the new one, then deletes their account", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "the phone's sheets are screens; the flow is the same");
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
  // Nothing starred yet: said, not offered as an empty file (decision 0191).
  await expect(sure.getByText("Nothing starred yet", { exact: true })).toBeVisible();
  await expect(sure.getByRole("link", { name: "Export starred articles" })).toHaveCount(0);
  // Escape keeps everything.
  await page.keyboard.press("Escape");
  await expect(sure).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete account…" })).toBeFocused();
  await page.keyboard.press("Enter");
  await sure.getByRole("button", { name: "Delete account" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();

  await page.getByLabel("Email").fill(next);
  await page.getByLabel("Password", { exact: true }).fill(READER_PASSWORD);
  await page.keyboard.press("Enter");
  await expect(page.locator("#sign-in-message")).toHaveText("That email and password don't match.");
  await page.context().close();
});

test("the owner's own account has no Delete account", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: MAIL_APP });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Email").fill(OWNER_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("#sidebar")).toBeAttached();
  await page.goto("/settings");
  await expect(page.getByText(/^Version /)).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete account…" })).toHaveCount(0);
  // Their data, though, they can delete (decision 0117).
  await expect(page.getByRole("button", { name: "Delete data…" })).toBeVisible();
  await expect(page.getByText(/^Whoever runs this nine turtles can see/)).toHaveCount(0);
  await context.close();
});

test("Delete data empties the account and keeps the reader signed in", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "the phone's sheets are screens; the flow is the same");
  const email = `empty-${testInfo.project.name}-${Date.now()}@example.com`;
  const page = await newReader(browser, email);
  const made = await page.request.post("/api/folders", { data: { name: "Essays" } });
  expect(made.ok()).toBe(true);
  const folders = async () => ((await (await page.request.get("/api/feeds")).json()) as { folders: unknown[] }).folders;
  expect(await folders()).toHaveLength(1);

  await page.goto("/settings");
  await page.getByRole("button", { name: "Delete data…" }).click();
  const sure = page.getByRole("dialog", { name: "Delete your data?" });
  await expect(sure.getByRole("heading", { name: "Delete your data?" })).toBeFocused();
  // The downloads first.
  await expect(sure.getByRole("link", { name: "Export OPML" })).toHaveAttribute("href", "/api/opml");
  // Nothing starred yet: said, not offered as an empty file (decision 0191).
  await expect(sure.getByText("Nothing starred yet", { exact: true })).toBeVisible();
  await expect(sure.getByRole("link", { name: "Export starred articles" })).toHaveCount(0);
  // Escape keeps everything.
  await page.keyboard.press("Escape");
  await expect(sure).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete data…" })).toBeFocused();
  expect(await folders()).toHaveLength(1);

  await page.keyboard.press("Enter");
  await expect(sure.getByRole("heading", { name: "Delete your data?" })).toBeFocused();
  // Past the two downloads to Delete data, with only the keyboard.
  for (let step = 0; step < 3; step += 1) await page.keyboard.press("Tab");
  await expect(sure.getByRole("button", { name: "Delete data" })).toBeFocused();
  await page.keyboard.press("Enter");
  // The app starts again at its start, empty, still signed in.
  await expect.poll(folders).toHaveLength(0);
  await expect(page).not.toHaveURL(/\/settings/);
  await expect(page.locator("#sidebar")).toBeAttached();
  await page.goto("/settings");
  await expect(page.getByText(email)).toBeVisible();
  await page.context().close();
});

test("a reader signs in by an emailed link, once, keeping their password, with only the keyboard", async ({ browser }, testInfo) => {
  const email = `link-${testInfo.project.name}-${Date.now()}@example.com`;
  const laptop = await newReader(browser, email);

  const context = await browser.newContext({ baseURL: MAIL_APP });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByLabel("Email")).toBeFocused();
  await page.keyboard.type(email);
  for (let step = 0; step < 2; step += 1) await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Forgot?" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Email")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeFocused();
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
  await expect(page.getByRole("heading", { name: "You're signed in" })).toBeFocused();
  // Not now: straight to reading, the password as it was.
  // New password, Set password, then Not now.
  for (let step = 0; step < 3; step += 1) await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Not now" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#sidebar")).toBeAttached();
  expect(new URL(page.url()).pathname).not.toBe("/sign-in-link");

  // The other device stays signed in, and the password still works.
  await laptop.reload();
  await expect(laptop.locator("#sidebar")).toBeAttached();
  const stillWorks = await page.request.post("/api/sign-in", { data: { email, password: READER_PASSWORD } });
  expect(stillWorks.ok()).toBe(true);

  // A second time, the link has run out.
  const again = await browser.newContext({ baseURL: MAIL_APP });
  const second = await again.newPage();
  await second.goto(link);
  await second.getByRole("button", { name: "Sign in" }).click();
  await expect(second.getByRole("status").filter({ hasText: "This link has expired or was already used." })).toBeVisible();
  await second.getByRole("link", { name: "Sign in" }).click();
  await expect(second.getByLabel("Password", { exact: true })).toBeVisible();

  await again.close();
  await laptop.context().close();
  await context.close();
});

test("choosing a password after the hour has run out says so, and the keyboard goes to what it says", async ({ browser }, testInfo) => {
  const email = `lapsed-${testInfo.project.name}-${Date.now()}@example.com`;
  const laptop = await newReader(browser, email);
  const context = await browser.newContext({ baseURL: MAIL_APP });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("link", { name: "Forgot?" }).click();
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  const { link } = await newestMail(email, "Sign in to nine turtles");
  await page.goto(link);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "You're signed in" })).toBeFocused();
  // As if the hour ran out, or nine turtles restarted, while the page was open.
  await page.route("**/api/password/reset", (route) => route.fulfill({ status: 410, contentType: "application/json", body: JSON.stringify({ error: "expired" }) }));
  await page.getByLabel("New password", { exact: true }).fill("a-new-long-password");
  await page.getByRole("button", { name: "Set password" }).click();
  await expect(page.getByText("That took too long, so your password stays as it is.")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Open nine turtles" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#sidebar")).toBeAttached();
  await laptop.context().close();
  await context.close();
});

test("the weekly email is off until switched on in Settings, and its stop page is honest", async ({ browser }, testInfo) => {
  // SPEC section 39 (decisions 0150 and 0184): once a week, or off.
  const email = `weekly-${testInfo.project.name}-${Date.now()}@example.com`;
  const page = await newReader(browser, email);
  await page.goto("/settings");
  const weekly = page.getByRole("switch", { name: "Weekly email" });
  await expect(weekly).not.toBeChecked();
  await expect(weekly).toBeEnabled();
  // With only the keyboard: Space switches it, as any switch.
  await weekly.focus();
  const savedWeekly = settingsSaved(page, "/api/weekly-email");
  await page.keyboard.press("Space");
  await expect(weekly).toBeChecked();
  await expect(page.getByText("Saturday mornings:")).toBeVisible();
  // It follows the reader: the server keeps it.
  await savedWeekly;
  await page.reload();
  await expect(page.getByRole("switch", { name: "Weekly email" })).toBeChecked();

  // A stop link that isn't one (or no longer is) says so, and changes nothing.
  await page.goto("/weekly-email#ticket=not-a-real-one");
  await expect(page).toHaveURL(/\/weekly-email$/);
  await expect(page.getByRole("button", { name: "Stop the weekly email" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("This link no longer works")).toBeVisible();
  await page.getByRole("link", { name: "Open nine turtles" }).click();
  await expect(page.locator("#sidebar")).toBeAttached();

  // Off from Settings.
  await page.goto("/settings");
  const savedOff = settingsSaved(page, "/api/weekly-email");
  await page.getByRole("switch", { name: "Weekly email" }).click();
  await savedOff;
  await page.reload();
  await expect(page.getByRole("switch", { name: "Weekly email" })).not.toBeChecked();
  await page.context().close();
});
