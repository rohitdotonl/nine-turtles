import { expect, test } from "@playwright/test";
import { OWNER_EMAIL, TEST_PASSWORD } from "../playwright.config";
import { appReady, signIn } from "./screens";

// Connecting an AI assistant through MCP: the "Connect this assistant?" page
// and Settings › Connected assistants. The server's answers are stood in for
// here, so these check the screens; the server's own tests check the rest.

const QUERY = "?response_type=code&client_id=abc&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb&state=s1&code_challenge=x&code_challenge_method=S256";

test("the connect page comes after sign-in, says what the assistant may do, and Connect follows the server's answer", async ({ page }) => {
  let asked = "";
  let sent: unknown;
  await page.route(/\/api\/oauth\/request/, (route) => {
    asked = new URL(route.request().url()).search;
    return route.fulfill({ json: { client_name: "Claude <b>bold</b>", redirect_host: "claude.ai" } });
  });
  await page.route("**/api/oauth/approve", (route) => {
    sent = route.request().postDataJSON();
    // Back to nine turtles itself, so the test never leaves this computer.
    return route.fulfill({ json: { redirect: new URL("/unread?connected", page.url()).href } });
  });

  await page.goto(`/oauth/authorize${QUERY}`);
  await appReady(page);
  // Signed out, sign-in comes first; the address, with its query, stays.
  await page.getByLabel("Email").fill(OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  const heading = page.getByRole("heading", { level: 1, name: "Connect Claude <b>bold</b> to nine turtles?" });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  // The assistant's name is plain words, never markup.
  await expect(page.locator("main b")).toHaveCount(0);
  expect(asked).toBe(QUERY);
  await expect(page.getByText("Afterwards you'll go back to claude.ai.")).toBeVisible();
  await expect(page.getByText("Feeds it unsubscribes from are kept for 30 days; you can bring them back in Settings.")).toBeVisible();

  // The keyboard alone: Cancel first, then Connect, as in a sheet.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Tab");
  const connect = page.getByRole("button", { name: "Connect" });
  await expect(connect).toBeFocused();
  for (const button of [connect, page.getByRole("button", { name: "Cancel" })]) {
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/unread\?connected$/);
  expect(sent).toEqual({ query: QUERY });
});

test("a connection link that isn't valid says so and sends the reader nowhere", async ({ page }) => {
  await page.route(/\/api\/oauth\/request/, (route) => route.fulfill({ status: 400, json: { error: "unknown-client" } }));
  await page.goto("/unread");
  await appReady(page);
  await signIn(page);
  await page.goto(`/oauth/authorize${QUERY}`);
  await expect(page.getByText("This connection link isn't valid. Start again from your assistant.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/oauth\/authorize/);
});

test("Settings › Connected assistants: the address, each connection, a key shown once, and feeds to bring back", async ({ page }) => {
  await page.route("**/api/assistants", (route) =>
    route.fulfill({
      json: {
        assistants: [{ id: 3, name: "Claude", connected_at: 1793000000, last_used_at: null }],
        unsubscribed: [{ feed_id: 999999, title: "Some blog", unsubscribed_at: 1793000000, kept_until: 1795592000 }],
      },
    }),
  );
  await page.route("**/api/assistants/3/disconnect", (route) => route.fulfill({ status: 204 }));
  await page.route("**/api/assistants/key", (route) =>
    route.fulfill({
      status: 201,
      json: { key: `nt_${"0123456789abcdef".repeat(4)}`, assistant: { id: 7, name: "My helper", connected_at: 1793000000, last_used_at: null } },
    }),
  );
  await page.route("**/api/feeds/999999/resubscribe", (route) => route.fulfill({ status: 409, json: { error: "too-late" } }));

  await page.goto("/settings/assistants");
  await appReady(page);
  await signIn(page);
  const group = page.getByRole("region", { name: "Connected assistants" });
  await expect(group.getByText(/\/mcp$/)).toBeVisible();
  await expect(group.getByRole("button", { name: "Copy server address" })).toBeVisible();
  await expect(group.getByText(/Not used yet/)).toBeVisible();

  // Disconnect: the row goes, and the keyboard stays in the group.
  await group.getByRole("button", { name: "Disconnect Claude" }).focus();
  await page.keyboard.press("Enter");
  await expect(group.getByText("No assistants connected.")).toBeVisible();
  await expect(group.getByRole("status").filter({ hasText: "Claude is disconnected" })).toBeVisible();

  // A key: shown once, with Copy, which has the keyboard's place.
  await group.getByLabel(/Name for a new assistant key/).fill("My helper");
  await group.getByRole("button", { name: "Make an assistant key" }).click();
  await expect(group.getByRole("button", { name: "Copy assistant key" })).toBeFocused();
  await expect(group.getByText(/^nt_[0-9a-f]{64}$/)).toBeVisible();
  await expect(group.getByText("Copy it now: it won't be shown again.", { exact: false })).toBeVisible();
  await expect(group.getByRole("button", { name: "Disconnect My helper" })).toBeVisible();

  // Too late to bring back: said calmly, and the row goes.
  await group.getByRole("button", { name: "Bring back Some blog" }).click();
  await expect(group.getByRole("status").filter({ hasText: "Some blog can't be brought back: it's already gone." })).toBeVisible();
  await expect(group.getByText("Unsubscribed by an assistant")).toHaveCount(0);
});
