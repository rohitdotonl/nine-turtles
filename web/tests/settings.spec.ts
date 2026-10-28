import { expect, test, type Page } from "@playwright/test";
import { appReady, signIn, tabTo } from "./screens";

// SPEC section 18 (decision 0120): a shorter Settings. Its first page keeps the
// everyday settings; every other group is a row ending in › that opens a page
// of its own at /settings/<name>, with ‹ Settings, Escape and the browser's
// Back to go back, and the keyboard back on the row. Each row's icon sits on
// its name's first line.

async function openSettings(page: Page, path = "/settings") {
  await page.goto(path);
  await appReady(page);
  await signIn(page);
  await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
}


test("Settings' first page keeps the everyday settings, and the rest are rows that open pages", async ({ page }, testInfo) => {
  await openSettings(page);
  const phone = testInfo.project.name === "phone";
  const groups = page.locator('section[aria-labelledby="settings-heading"] h3');
  await expect(groups).toHaveText(["Reading", "Look and feel", "Your library", "More", /^Your nine turtles/, "Account"]);
  // Reading and Look and feel hold their controls on the page itself.
  for (const name of ["Reading mode", "Unread counts", "Let unread go after", "Sort order", "Appearance"])
    await expect(page.getByRole("group", { name, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Smaller text" })).toBeVisible();
  // Theme, font and line width are one page further in.
  await expect(page.getByRole("group", { name: "Theme" })).toHaveCount(0);
  const rows = page.locator("[data-settings-row]");
  const expected = ["font", "feeds", "feed-health", "sidebar", "data", ...(phone ? [] : ["keyboard"]), "add-from-anywhere", "rules", "newsletters", "other-apps", "assistants", "readers"];
  const shown = await rows.evaluateAll((all) => all.filter((row) => (row as HTMLElement).offsetParent !== null).map((row) => (row as HTMLElement).dataset.settingsRow));
  expect(shown).toEqual(expected);
  // No Sign-up row: sign-up is always open (decision 0115).
  await expect(page.getByText("Sign-up", { exact: true })).toHaveCount(0);
  // Screen readers hear that each row opens a page.
  const rules = page.getByRole("link", { name: "Rules", exact: true });
  await expect(rules).toHaveAccessibleDescription("Opens its own page.");
  // Account: Email, then Sign out, then Delete data…; the owner has no Delete account….
  await expect(page.getByText("Email", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete data…" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete account…" })).toHaveCount(0);
  // Every icon is in the muted grey, never the accent.
  const colors = await page.locator(".setting-icon").evaluateAll((icons) => [...new Set(icons.map((icon) => getComputedStyle(icon).color))]);
  const muted = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--muted)";
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
  expect(colors).toEqual([muted]);
});

test("each row's icon sits on the centre of its name's first line", async ({ page }) => {
  await openSettings(page);
  const offsets = await page.locator(".setting").evaluateAll((rows) =>
    rows
      .filter((row) => (row as HTMLElement).offsetParent !== null && row.querySelector(".setting-icon svg"))
      .map((row) => {
        const svg = row.querySelector(".setting-icon svg")!.getBoundingClientRect();
        const name = row.querySelector(".setting-name")!;
        const range = document.createRange();
        range.selectNodeContents(name);
        const line = range.getClientRects()[0]!;
        return { row: name.textContent, off: Math.abs(svg.top + svg.height / 2 - (line.top + line.height / 2)) };
      }),
  );
  // Rows with a description under the name (Reading mode, Email) and rows without one.
  expect(offsets.length).toBeGreaterThan(15);
  for (const { row, off } of offsets) expect(off, row ?? "").toBeLessThanOrEqual(1);
});

test("a row opens its own page at its own address; ‹ Settings, Escape and Back go back to the row", async ({ page }, testInfo) => {
  await openSettings(page);
  const rules = page.getByRole("link", { name: "Rules", exact: true });
  await tabTo(page, rules);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/settings\/rules$/);
  await expect(page).toHaveTitle("Rules · nine turtles");
  await expect(page.getByRole("heading", { level: 2, name: "Rules" })).toBeFocused();
  await expect(page.getByRole("button", { name: "New rule…" })).toBeVisible();
  const back = page.getByRole("button", { name: "Back to Settings" });
  await expect(back).toHaveText("Settings");
  // Escape goes back to Settings, with the keyboard on the row that opened the page.
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(rules).toBeFocused();

  // ‹ Settings does the same.
  await page.getByRole("link", { name: "Other apps", exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/other-apps$/);
  await back.click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("link", { name: "Other apps", exact: true })).toBeFocused();

  // The browser's Back and Forward.
  await page.getByRole("link", { name: "Add from anywhere", exact: true }).click();
  await expect(page.getByText("Bookmark for your browser")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("link", { name: "Add from anywhere", exact: true })).toBeFocused();
  await page.goForward();
  await expect(page).toHaveURL(/\/settings\/add-from-anywhere$/);
  await expect(page.getByText("Bookmark for your browser")).toBeVisible();

  // An address opens its page straight away, and ‹ Settings still goes back.
  await page.goto("/settings/font");
  await expect(page.getByRole("heading", { level: 2, name: "Font, theme and line width" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Theme" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Reading font" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Line width" })).toBeVisible();
  await page.getByRole("button", { name: "Back to Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("link", { name: /^Font, theme and line width/ })).toBeFocused();

  // Feed health keeps its X; it and Escape go back to its row too.
  await page.getByRole("link", { name: "Feed health", exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/feed-health$/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "Feed health", exact: true })).toBeFocused();

  if (testInfo.project.name === "phone") {
    // On a phone, a control sits under its name, across the row.
    const control = page.getByRole("group", { name: "Sort order" });
    const name = page.locator("#sort-name");
    const [box, words] = [await control.boundingBox(), await name.boundingBox()];
    expect(box!.y).toBeGreaterThan(words!.y + words!.height - 1);
  } else {
    const control = page.getByRole("group", { name: "Sort order" });
    const name = page.locator("#sort-name");
    const [box, words] = [await control.boundingBox(), await name.boundingBox()];
    expect(box!.x).toBeGreaterThan(words!.x + words!.width);
  }
});

test("Readers is only the owner's", async ({ browser, page }, testInfo) => {
  await openSettings(page, "/settings/readers");
  await expect(page.getByRole("heading", { level: 2, name: "Readers" })).toBeVisible();
  await page.getByRole("link", { name: /^All readers/ }).click();
  await expect(page).toHaveURL(/\/settings\/readers\/all$/);
  await expect(page.getByRole("heading", { level: 2, name: "All readers" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/settings\/readers$/);
  await expect(page.getByRole("link", { name: /^All readers/ })).toBeFocused();

  const other = await browser.newContext({ ...testInfo.project.use });
  const reader = await other.newPage();
  const email = `settings-${testInfo.project.name}-${Date.now()}@example.com`;
  await reader.goto("/");
  const joined = await reader.request.post("/api/sign-up", {
    data: { email, password: "slow mornings, long reads" },
    headers: { "sec-fetch-site": "same-origin" },
  });
  expect(joined.ok()).toBe(true);
  await reader.goto("/settings");
  await expect(reader.getByText(/^Version /)).toBeVisible();
  await expect(reader.locator('[data-settings-row="readers"]')).toHaveCount(0);
  await expect(reader.getByText(/^Your nine turtles/)).toHaveCount(0);
  await expect(reader.getByRole("button", { name: "Delete account…" })).toBeVisible();
  await reader.goto("/settings/readers");
  await expect(reader.getByText("Only whoever runs this nine turtles sees Readers.")).toBeVisible();
  await other.close();
});

test("a setting's description sits straight under its name, and group names are small capitals", async ({ page }) => {
  await openSettings(page);
  // Settings' Reading rows: the description straight under the name, smaller and muted.
  const name = page.locator("#mode-name");
  const hint = page.locator("#mode-hint");
  await expect(name).toHaveCSS("font-weight", "500");
  await expect(hint).toHaveCSS("line-height", /^\d+(\.\d+)?px$/);
  const [n, h] = [await name.boundingBox(), await hint.boundingBox()];
  expect(h!.y).toBeGreaterThanOrEqual(n!.y + n!.height - 1);
  expect(h!.y - (n!.y + n!.height)).toBeLessThan(6);
  await expect(page.getByRole("group", { name: "Reading mode" })).toHaveAccessibleDescription(/Unread list|flows past/);
  await expect(page.locator("#reading-heading")).toHaveCSS("text-transform", "uppercase");
});
