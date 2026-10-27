import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn, tabTo } from "./screens";

// SPEC section 17: a feed that stops working is listed on the feed health
// page in plain words, and Find new address moves it to where the site now
// keeps it. The test nine turtles checks every feed every two seconds, so a
// moved feed fails twice within moments. Each run follows a blog of its own.

test("a moved feed is listed in plain words, and Find new address moves it", async ({ page }) => {
  const name = `moving-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await follow(page, `${FEED_SITE}/blog/${name}/`);
  expect((await page.request.get(`${FEED_SITE}/move/${name}`)).ok()).toBe(true);

  // Settings › Feeds › Feed health.
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("link", { name: "Feed health" }).click();
  await expect(page.getByRole("heading", { name: "Feed health", level: 2 })).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/feed-health$/);

  const feed = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(async () => {
    await page.reload();
    await appReady(page);
    await expect(feed).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  // Grouped under words, never by color alone, and explained without codes.
  await expect(page.getByRole("heading", { name: "Having trouble" })).toBeVisible();
  await expect(feed).toContainText("Not found for less than a day.");
  await expect(feed).toContainText("The site says the feed isn't there any more.");
  // A word on its own: the title carries a timestamp, which may end in 404.
  await expect(feed).not.toContainText(/\b404\b/);
  // A card (decision 0118): its name, what happened, then Address and Last worked, on a computer and a phone alike.
  await expect(feed).toHaveCSS("border-top-left-radius", "12px");
  await expect(feed.locator("dt")).toHaveText(["Address", "Last worked"]);
  const tried = feed.locator("dd.tried");
  await expect(tried).toHaveText(`${FEED_SITE}/blog/${name}/feed.xml`);
  await expect(tried).toHaveCSS("font-family", /Mono|monospace/);
  await expect(feed.locator("dd").nth(1)).toHaveText(/^(Today|\d+ \w+|Not since you added it)/);
  const [triedSize, nameSize] = await Promise.all([
    tried.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
    feed.getByRole("heading", { name: title }).evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
  ]);
  expect(triedSize).toBeLessThan(nameSize);
  // Find new address first and filled, then Retry, then Unsubscribe; every one at least 44px tall.
  const find = feed.getByRole("button", { name: `Find new address for ${title}` });
  const retry = feed.getByRole("button", { name: `Retry ${title}` });
  const leave = feed.getByRole("button", { name: `Unsubscribe from ${title}` });
  await expect(feed.locator(".actions > button")).toHaveText(["Find new address", "Retry", "Unsubscribe"]);
  await expect(find).toHaveClass(/btn-primary/);
  const [findBox, retryBox, leaveBox, cardBox] = await Promise.all([find.boundingBox(), retry.boundingBox(), leave.boundingBox(), feed.boundingBox()]);
  for (const box of [findBox!, retryBox!, leaveBox!]) expect(box.height).toBeGreaterThanOrEqual(44);
  if (cardBox!.width < 24 * 16) {
    // A narrow card: the two buttons share their row equally, and Unsubscribe has a line of its own below.
    expect(Math.abs(findBox!.width - retryBox!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(findBox!.y - retryBox!.y)).toBeLessThanOrEqual(1);
    expect(leaveBox!.y).toBeGreaterThan(findBox!.y + findBox!.height - 1);
    expect(leaveBox!.width).toBeGreaterThan(cardBox!.width - 2 * 18 - 2);
  } else {
    // Unsubscribe at the right end of the same row.
    expect(Math.abs(leaveBox!.y - findBox!.y)).toBeLessThanOrEqual(1);
    expect(leaveBox!.x + leaveBox!.width).toBeGreaterThan(cardBox!.x + cardBox!.width - 18 - 2);
  }

  // The site names one feed: one plain question, rather than a list of one (decision 0106).
  await feed.getByRole("button", { name: `Find new address for ${title}` }).click();
  await expect(feed.getByText(new RegExp(`^Use ${FEED_SITE}/blog/${name}/new\\.xml instead\\?$`))).toBeVisible();
  await expect(feed).toContainText("Its name, folders, articles and stars stay.");
  await expect(feed.getByRole("radio")).toHaveCount(0);
  await feed.getByRole("button", { name: "Use it" }).click();
  await expect(feed.getByText(/It now reads from its new address and works again/)).toBeVisible();
  await expect(feed).toContainText("Working again.");
  // It stays where it was until the page is opened again; then it's gone.
  await page.reload();
  await appReady(page);
  await expect(page.getByRole("heading", { name: "Feed health", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: title })).toHaveCount(0);

  // Closing goes back to Settings.
  await page.getByRole("button", { name: "Close feed health" }).click();
  await expect(page.getByRole("heading", { name: "Settings", level: 2 })).toBeVisible();
});

test("a failing feed says so above its list, and Find its new address moves it with one question", async ({ page }) => {
  // Decision 0106: where the reader already is, not only on the health page.
  const name = `moving-line-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/`);
  expect((await page.request.get(`${FEED_SITE}/move/${name}`)).ok()).toBe(true);
  const failingSince = async () => {
    const library = await (await page.request.get(new URL("/api/feeds", FEEDS_APP).href)).json();
    return library.feeds.find((feed: { id: number }) => feed.id === id)?.failing_since ?? null;
  };
  // Two failed checks, as the health page needs before it lists a feed.
  await expect.poll(failingSince, { timeout: 30_000 }).not.toBeNull();

  // Edit feed offers it too, only while the feed is failing.
  await page.goto(new URL(`/feeds/${id}/edit`, FEEDS_APP).href);
  await appReady(page);
  await expect(page.getByRole("button", { name: "Find new address", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(new RegExp(`/feeds/${id}$`));

  const list = page.locator("#list-pane");
  await expect(list.getByText(/^This feed hasn't worked since (earlier today|\d+ \w+)\. Find its new address$/)).toBeVisible();
  const find = list.getByRole("button", { name: "Find its new address" });
  await tabTo(page, find);
  await page.keyboard.press("Enter");

  // One feed on the site: a plain question in place, and the keyboard on Use it.
  const question = list.getByRole("status").filter({ hasText: /instead\?$/ });
  await expect(question).toHaveText(`Use ${FEED_SITE}/blog/${name}/new.xml instead?`);
  await expect(list).toContainText("Its name, folders, articles and stars stay.");
  await expect(list.getByRole("radio")).toHaveCount(0);
  const useIt = list.getByRole("button", { name: "Use it" });
  await expect(useIt).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(list.getByRole("status").filter({ hasText: "It now reads from its new address and works again." })).toBeVisible();
  await expect(list.getByText(/This feed hasn't worked since/)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: title, level: 2 })).toBeFocused();
  expect(await failingSince()).toBeNull();
});

test("with the keyboard alone: Retry, Unsubscribe and Undo, Find new address and back, Escape", async ({ page }) => {
  const name = `moving-keys-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  await page.goto(new URL("/settings/feed-health", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await follow(page, `${FEED_SITE}/blog/${name}/`);
  expect((await page.request.get(`${FEED_SITE}/move/${name}`)).ok()).toBe(true);
  const feed = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(async () => {
    await page.reload();
    await appReady(page);
    await expect(feed).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  // The feed's own status line (Find new address has one of its own, after it).
  const status = feed.getByRole("status").first();

  // Retry: checked again at once, and still broken.
  await tabTo(page, feed.getByRole("button", { name: `Retry ${title}` }));
  await page.keyboard.press("Enter");
  await expect(status).toHaveText("Tried again just now: it still isn't working.");

  // Unsubscribe: the keyboard moves to Undo, and Undo brings it back.
  await tabTo(page, feed.getByRole("button", { name: `Unsubscribe from ${title}` }));
  await page.keyboard.press("Enter");
  await expect(status).toHaveText(`Unsubscribed from ${title}.`);
  const undo = feed.getByRole("button", { name: `Undo unsubscribing from ${title}` });
  await expect(undo).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(feed.getByRole("button", { name: `Unsubscribe from ${title}` })).toBeFocused();
  const library = await (await page.request.get(new URL("/api/feeds", FEEDS_APP).href)).json();
  expect(library.feeds.map((followed: { title: string }) => followed.title)).toContain(title);

  // Find new address: the keyboard lands on Use it, which says what it asks; Cancel goes back to the button.
  await tabTo(page, feed.getByRole("button", { name: `Find new address for ${title}` }));
  await page.keyboard.press("Enter");
  const useIt = feed.getByRole("button", { name: "Use it" });
  await expect(useIt).toBeFocused();
  await expect(useIt).toHaveAccessibleDescription(/^Use .*new\.xml instead\? Its name, folders, articles and stars stay\.$/);
  await page.keyboard.press("Shift+Tab");
  await expect(feed.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(feed.getByRole("button", { name: `Find new address for ${title}` })).toBeFocused();

  // Escape goes back to Settings.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Settings", level: 2 })).toBeVisible();
  await expect(page).toHaveURL(/\/settings$/);
});

/** Follows a new blog of its own, makes it fail (`/move` or `/break`), and waits until the health page would list it. */
async function failing(page: Page, name: string, how: "move" | "break"): Promise<number> {
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  if (await page.getByLabel("Password", { exact: true }).isVisible()) await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);
  expect((await page.request.get(`${FEED_SITE}/${how}/${name}`)).ok()).toBe(true);
  await expect
    .poll(
      async () => {
        const library = await (await page.request.get(new URL("/api/feeds", FEEDS_APP).href)).json();
        return library.feeds.find((feed: { id: number }) => feed.id === id)?.failing_since ?? null;
      },
      { timeout: 30_000 },
    )
    .not.toBeNull();
  return id;
}

test("when the site names several feeds, the list's line offers a choice; when it names none, it says so", async ({ page }) => {
  const several = `moving-two-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const id = await failing(page, several, "move");
  await page.goto(new URL(`/feeds/${id}`, FEEDS_APP).href);
  await appReady(page);
  const list = page.locator("#list-pane");
  await list.getByRole("button", { name: "Find its new address" }).click();
  const choice = list.getByRole("radiogroup", { name: `Feeds on Blog ${several}'s site` });
  await expect(choice.getByRole("radio")).toHaveCount(2);
  await expect(choice.getByRole("radio").first()).toBeChecked();
  await expect(choice.getByRole("radio").first()).toBeFocused();
  await expect(list.getByRole("button", { name: "Use it" })).toHaveCount(0);
  // Cancel puts it back as it was, the keyboard on the button.
  await list.getByRole("button", { name: "Cancel" }).click();
  await expect(choice).toHaveCount(0);
  await expect(list.getByRole("button", { name: "Find its new address" })).toBeFocused();

  // A feed whose site names nothing new: one plain sentence, in Edit feed too.
  const none = `moving-gone-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const gone = await failing(page, none, "break");
  await page.goto(new URL(`/feeds/${gone}/edit`, FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("button", { name: "Find new address", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /^The site doesn't name another feed/ })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: `Feeds on Blog ${none}'s site` })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Use it" })).toHaveCount(0);
});

test("Edit feed moves a failing feed at once, says so, and keeps what was typed", async ({ page }) => {
  const name = `moving-edit-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const id = await failing(page, name, "move");
  await page.goto(new URL(`/feeds/${id}/edit`, FEEDS_APP).href);
  await appReady(page);
  const nameField = page.getByRole("textbox", { name: "Name" });
  await nameField.fill(`Renamed ${name}`);
  await page.getByRole("button", { name: "Find new address", exact: true }).click();
  await page.getByRole("button", { name: "Use it" }).click();
  await expect(page.getByRole("status").filter({ hasText: "It now reads from its new address and works again." })).toBeVisible();
  await expect(page.getByText(/This feed hasn't worked since/)).toHaveCount(0);
  await expect(nameField).toHaveValue(`Renamed ${name}`);
  const library = await (await page.request.get(new URL("/api/feeds", FEEDS_APP).href)).json();
  const feed = library.feeds.find((each: { id: number }) => each.id === id);
  expect(feed.failing_since ?? null).toBeNull();
});

test("moving a feed to a new number (others follow the old address) keeps Edit feed and its confirmation", async ({ page }) => {
  // The new number only comes when another reader follows the old address;
  // here the server's answer is changed to another of this reader's feeds, to
  // stand in for it.
  const name = `moving-number-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const id = await failing(page, name, "move");
  const other = await follow(page, `${FEED_SITE}/blog/other-${name}/`);
  await page.route(`**/api/health/${id}/address`, async (route) => {
    await route.fetch();
    const health = await (await page.request.get(new URL("/api/feeds", FEEDS_APP).href)).json();
    const feed = health.feeds.find((each: { id: number }) => each.id === other);
    await route.fulfill({ json: { feed: { ...feed, state: "working", failing_since: null } } });
  });
  await page.goto(new URL(`/feeds/${id}/edit`, FEEDS_APP).href);
  await appReady(page);
  const nameField = page.getByRole("textbox", { name: "Name" });
  await nameField.fill("Typed before the move");
  await page.getByRole("button", { name: "Find new address", exact: true }).click();
  await page.getByRole("button", { name: "Use it" }).click();
  await expect(page).toHaveURL(new RegExp(`/feeds/${other}/edit$`));
  await expect(page.getByRole("status").filter({ hasText: "It now reads from its new address and works again." })).toBeVisible();
  await expect(nameField).toHaveValue("Typed before the move");
});

test("moving a dead feed on the health page keeps its place and its confirmation", async ({ page }) => {
  // A feed is dead only after a week; the page's list is changed to call this one dead.
  const name = `moving-dead-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  await failing(page, name, "move");
  await page.route("**/api/health", async (route) => {
    const real = await (await route.fetch()).json();
    for (const feed of real.feeds) if (feed.title === title) feed.state = "dead";
    await route.fulfill({ json: real });
  });
  await page.goto(new URL("/settings/feed-health", FEEDS_APP).href);
  await appReady(page);
  const dead = page.getByRole("region", { name: "Not working" });
  const feed = dead.getByRole("listitem").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(feed).toBeVisible();
  await feed.getByRole("button", { name: `Find new address for ${title}` }).click();
  await feed.getByRole("button", { name: "Use it" }).click();
  // It stays under Not working, saying it moved, with the keyboard on Retry.
  await expect(feed.getByText("It now reads from its new address and works again.", { exact: false })).toBeVisible();
  await expect(feed).toContainText("Working again.");
  await expect(feed.getByRole("button", { name: `Retry ${title}` })).toBeFocused();
});
