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


test("Settings' first page keeps the everyday settings, and the rest are rows that open pages", async ({ page }) => {
  await openSettings(page);
  const groups = page.locator('section[aria-labelledby="settings-heading"] h3');
  await expect(groups).toHaveText(["Reading", "Look and feel", "Your library", "More", /^Your nine turtles/, "Account", "Leaving"]);
  // Reading and Look and feel hold their controls on the page itself.
  await expect(page.getByRole("switch", { name: "Unread", exact: true })).toBeVisible();
  for (const name of ["Sort order", "Page", "Font"])
    await expect(page.getByRole("group", { name, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Smaller text" })).toBeVisible();
  // One line width for everyone (decision 0187).
  await expect(page.getByRole("group", { name: "Line width" })).toHaveCount(0);
  const rows = page.locator("[data-settings-row]");
  const expected = ["feeds", "data", "install", "hiding", "newsletters", "assistants", "readers"];
  const shown = await rows.evaluateAll((all) => all.filter((row) => (row as HTMLElement).offsetParent !== null).map((row) => (row as HTMLElement).dataset.settingsRow));
  expect(shown).toEqual(expected);
  // No Sign-up row: sign-up is always open (decision 0115).
  await expect(page.getByText("Sign-up", { exact: true })).toHaveCount(0);
  // Screen readers hear that each row opens a page.
  const rules = page.getByRole("link", { name: "Hiding", exact: true });
  await expect(rules).toHaveAccessibleDescription("Opens its own page.");
  // Account: Email, Password, then Sign out; Delete data… under Leaving at the end; the owner has no Delete account….
  await expect(page.getByText("Email", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Change… password" })).toBeVisible();
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
  // Rows with a description under the name (Unread, Email) and rows without one.
  expect(offsets.length).toBeGreaterThan(14);
  for (const { row, off } of offsets) expect(off, row ?? "").toBeLessThanOrEqual(1);
});

test("a row opens its own page at its own address; ‹ Settings, Escape and Back go back to the row", async ({ page }, testInfo) => {
  await openSettings(page);
  const rules = page.getByRole("link", { name: "Hiding", exact: true });
  await tabTo(page, rules);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/settings\/hiding$/);
  await expect(page).toHaveTitle("Hiding · nine turtles");
  await expect(page.getByRole("heading", { level: 2, name: "Hiding" })).toBeFocused();
  await expect(page.getByRole("textbox", { name: "Hide articles about" })).toBeVisible();
  const back = page.getByRole("button", { name: "Back to Settings" });
  await expect(back).toHaveText("Settings");
  // Escape goes back to Settings, with the keyboard on the row that opened the page.
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(rules).toBeFocused();

  // ‹ Settings does the same.
  await page.getByRole("link", { name: "Connected assistants", exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/assistants$/);
  await back.click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("link", { name: "Connected assistants", exact: true })).toBeFocused();

  // The browser's Back and Forward.
  await page.getByRole("link", { name: "Install the app on any device", exact: true }).click();
  await expect(page.getByText("Follow the blog you're on")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("link", { name: "Install the app on any device", exact: true })).toBeFocused();
  await page.goForward();
  await expect(page).toHaveURL(/\/settings\/install$/);
  await expect(page.getByText("Follow the blog you're on")).toBeVisible();

  // An address opens its page straight away, and ‹ Settings still goes back.
  await page.goto("/settings/data");
  await expect(page.getByRole("heading", { level: 2, name: "Your data" })).toBeVisible();
  await page.getByRole("button", { name: "Back to Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("link", { name: "Your data", exact: true })).toBeFocused();
  // The pages that went (decision 0187) open Settings itself.
  await page.goto("/settings/font");
  await expect(page).toHaveURL(/\/settings$/);

  // Everyone you follow keeps its X; it and Escape go back to its row too.
  await page.getByRole("link", { name: "Everyone you follow", exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/feeds$/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "Everyone you follow", exact: true })).toBeFocused();

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
  const name = page.locator("#unread-name");
  const hint = page.locator("#unread-hint");
  await expect(name).toHaveCSS("font-weight", "500");
  await expect(hint).toHaveCSS("line-height", /^\d+(\.\d+)?px$/);
  const [n, h] = [await name.boundingBox(), await hint.boundingBox()];
  expect(h!.y).toBeGreaterThanOrEqual(n!.y + n!.height - 1);
  expect(h!.y - (n!.y + n!.height)).toBeLessThan(6);
  await expect(page.getByRole("switch", { name: "Unread" })).toHaveAccessibleDescription(/Unread list/);
  await expect(page.locator("#reading-heading")).toHaveCSS("text-transform", "uppercase");
});

test("Install the app on any device says what an installed app is, then the steps for this device, with a tab for each other", async ({ page }, testInfo) => {
  await openSettings(page);
  await page.getByRole("link", { name: "Install the app on any device", exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/install$/);
  await expect(page.getByRole("heading", { level: 2, name: "Install the app on any device" })).toBeVisible();
  await expect(page.getByText("Sign in once on each device", { exact: false })).toBeVisible();
  // Desktop Chrome and the Pixel each open on their own tab, with their own steps, numbered.
  const phone = testInfo.project.name === "phone";
  const tabs = page.getByRole("group", { name: "Device" });
  await expect(tabs.getByRole("radio", { name: phone ? "Android" : "Computer" })).toBeChecked();
  await expect(page.getByRole("heading", { level: 4, name: phone ? "On this Android phone" : /^On this (Linux computer|computer|Mac|Windows computer), in Chrome$/ })).toBeVisible();
  const install = page.locator('section[aria-labelledby="install-heading"]');
  // The numbered steps are the page's one ordered list.
  const steps = install.locator("ol").getByRole("listitem");
  await expect(steps).toHaveCount(3);
  await expect(steps.last()).toHaveText(phone ? "3Tap Install." : "3Click Install.");
  // Another device's tab gives its steps for any browser, and its own way to follow a blog.
  await tabs.getByText("iPhone & iPad").click();
  await expect(page.getByRole("heading", { level: 4, name: "On an iPhone or iPad" })).toBeVisible();
  await expect(install.getByText("Copy the blog's address, then paste it into + Add.")).toBeVisible();
  await tabs.getByText(phone ? "Android" : "Computer").click();
  // With the keyboard alone: the arrow keys move between the tabs, with a visible focus.
  const own = tabs.getByRole("radio", { name: phone ? "Android" : "Computer" });
  await own.focus();
  await page.keyboard.press("ArrowRight");
  const next = tabs.getByRole("radio", { name: phone ? "iPhone & iPad" : "Android" });
  await expect(next).toBeChecked();
  await expect(next).toBeFocused();
  await expect(tabs.getByText(phone ? "iPhone & iPad" : "Android", { exact: true })).not.toHaveCSS("outline-style", "none");
  await page.keyboard.press("ArrowLeft");
  await expect(own).toBeChecked();

  // When the browser offers to install, one press shows its own dialog, and the page then says it's done.
  const offer = (outcome: string) =>
    page.evaluate((outcome) => {
      const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome }),
      });
      dispatchEvent(event);
    }, outcome);
  // Said no: the button goes (the browser offers once), the page says so, and the keyboard lands on those words.
  await offer("dismissed");
  const button = page.getByRole("button", { name: "Install nine turtles" });
  await button.focus();
  await page.keyboard.press("Enter");
  const answer = page.getByRole("status").filter({ hasText: "Not installed. The steps below still work, any time." });
  await expect(answer).toBeFocused();
  await expect(button).toHaveCount(0);
  await expect(steps).toHaveCount(3);
  // Said yes, by keyboard too: the steps give way to "Installed."
  await offer("accepted");
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Installed. Open nine turtles from its icon." })).toBeFocused();
  await expect(button).toHaveCount(0);
  await expect(steps).toHaveCount(0);
});

test("in the installed app, Install the app on any device says it's installed instead of the steps", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { value: true }));
  await openSettings(page, "/settings/install");
  await expect(page.getByText("You're using the installed app now.")).toBeVisible();
  await expect(page.getByRole("group", { name: "Device" })).toBeVisible();
});

test("the foot of Settings links to Help on the website, in a tab of its own, reached by the keyboard", async ({ page }) => {
  // SPEC sections 18 and 40 (decision 0157).
  await openSettings(page);
  const help = page.getByRole("link", { name: "Help (on the nine turtles website, opens in a new tab)" });
  await expect(help).toHaveAttribute("href", "https://nineturtles.app/help/");
  await expect(help).toHaveAttribute("target", "_blank");
  expect((await help.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await tabTo(page, help);
  await expect(help).toBeFocused();
});
