import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn, tabTo } from "./screens";

// SPEC section 15: a feed that stops working is listed at the top of
// Everyone you follow in plain words, and Find new address moves it to where the site now
// keeps it. The test nine turtles checks every feed every two seconds, so a
// moved feed fails twice within moments. Each run follows a blog of its own.

test("who isn't working is one quiet row, then a line each, and their page leads with the fix", async ({ page, isMobile }) => {
  const name = `moving-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/`);
  expect((await page.request.get(`${FEED_SITE}/move/${name}`)).ok()).toBe(true);

  // Everyone you follow: a row of its own in the sidebar, under the lists (decision 0266).
  await page.goto(new URL("/", FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("navigation", { name: "Sidebar" }).getByRole("link", { name: "Everyone you follow" }).click();
  await expect(page.getByRole("heading", { name: "Everyone you follow", level: 2 })).toBeVisible();
  await expect(page).toHaveURL(/\/following$/);

  // One quiet row (decision 0279): how many, and what went wrong in a few words; nothing else until it's pressed.
  // Listed once two checks in a row have failed; other tests' feeds may be listed already, so this one is waited for.
  await expect
    .poll(async () => (await (await page.request.get(new URL("/api/health", FEEDS_APP).href)).json()).feeds.some((sick: { id: number }) => sick.id === id), { timeout: 30_000 })
    .toBe(true);
  const summary = page.locator("#health-summary");
  await page.reload();
  await appReady(page);
  await expect(summary).toBeVisible();
  // Only having trouble so far (it fails for a week before it's not working): it says how many, and that they usually come back.
  await expect(summary).toHaveText(/\d+ having trouble\s*(Usually back soon|.*having trouble)/);
  await expect(summary).toHaveAttribute("aria-expanded", "false");
  const feed = page.getByRole("link", { name: new RegExp(`^${title}\\s*Feed gone$`) });
  await expect(feed).toHaveCount(0);
  await summary.click();
  await expect(summary).toHaveAttribute("aria-expanded", "true");

  // A line each: the icon for what went wrong, their name, a few words on it, and ›; no address, no codes, no
  // buttons but the row above them.
  await expect(feed).toBeVisible();
  const list = feed.locator("xpath=ancestor::section[1]");
  await expect(list).not.toContainText(FEED_SITE);
  await expect(list).not.toContainText(/\b404\b/);
  await expect(list.getByRole("button")).toHaveCount(1);
  await expect(feed.locator(".why svg")).toHaveCount(1);
  const [iconBox, nameBox, rowBox] = await Promise.all([feed.locator(".why svg").boundingBox(), feed.getByText(title).boundingBox(), feed.boundingBox()]);
  expect(rowBox!.height).toBeGreaterThanOrEqual(44);
  expect(iconBox!.x + iconBox!.width).toBeLessThanOrEqual(nameBox!.x);
  await expect(feed.locator("xpath=../..")).toHaveCSS("border-top-left-radius", "12px");

  // The row opens their page, which leads with one box: what went wrong and since when, what it may mean, and
  // what can be done, the likeliest first.
  await feed.click();
  await expect(page).toHaveURL(new RegExp(`/(people|publications)/${id}/about$`));
  const box = page.getByRole("group", { name: "Not working" });
  await expect(box).toContainText("Feed gone since earlier today");
  await expect(box).toContainText("The site says the feed isn't there any more. It may have moved.");
  const find = box.getByRole("button", { name: "Find new address", exact: true });
  await expect(find).toHaveClass(/\bbtn\b/);
  const [findBox, boxBox] = await Promise.all([find.boundingBox(), box.boundingBox()]);
  expect(findBox!.height).toBeGreaterThanOrEqual(44);
  expect(findBox!.y).toBeGreaterThan(boxBox!.y);
  // The site names one feed: one plain question, rather than a list of one (decision 0106).
  await find.click();
  await expect(box.getByText(new RegExp(`^Use ${FEED_SITE}/blog/${name}/new\\.xml instead\\?$`))).toBeVisible();
  await expect(box.getByRole("radio")).toHaveCount(0);
  await box.getByRole("button", { name: "Use it" }).click();
  await expect(box.getByText(/It now reads from its new address and works again/)).toBeVisible();
  await expect(box.getByRole("button", { name: "Find new address", exact: true })).toHaveCount(0);

  // Back in Everyone you follow, it's gone from the top.
  await page.goto(new URL("/following", FEEDS_APP).href);
  await appReady(page);
  await expect(page.getByRole("heading", { name: "Everyone you follow", level: 2 })).toBeVisible();
  if (await summary.isVisible()) await summary.click();
  await expect(page.getByRole("link", { name: new RegExp(`^${title}\\s*Feed gone`) })).toHaveCount(0);

  // A place of its own, not one of Settings' pages (decision 0266): no ‹ Settings. On a phone, ‹ Home goes back to the
  // feeds screen (decision 0231); on a computer the sidebar is beside it, so there's no way back to press.
  await expect(page.getByRole("button", { name: "Back to Settings" })).toHaveCount(0);
  if (isMobile) {
    await page.getByRole("button", { name: "Back to Home" }).click();
    await expect(page.getByRole("navigation", { name: "Sidebar" }).getByRole("link", { name: "Everyone you follow" })).toBeVisible();
  } else {
    await expect(page.getByRole("button", { name: "Back to Home" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Sidebar" }).getByRole("link", { name: "Everyone you follow" })).toHaveAttribute("aria-current", "page");
  }
});

test("a failing feed says so above its list, and Find its new address moves it with one question", async ({ page }) => {
  // Decision 0106: where the reader already is, not only in Everyone you follow.
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

  // Their page offers it too, only while the feed is failing, naming what isn't working.
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  await expect(page.getByRole("button", { name: "Find new address", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: /^About / }).getByRole("group", { name: "Not working" })).toContainText(/^\s*Feed gone since/);
  // Escape goes back to their list.
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(new RegExp(`/(people|publications)/${id}$`));

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

test("with the keyboard alone: the row, their page, Find new address and back, Unsubscribe and Undo", async ({ page, isMobile }) => {
  const name = `moving-keys-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  // The old Feed health address opens Everyone you follow.
  await page.goto(new URL("/settings/feed-health", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/`);
  expect((await page.request.get(`${FEED_SITE}/move/${name}`)).ok()).toBe(true);
  // Listed once two checks in a row have failed; other tests' feeds may be listed already, so this one is waited for.
  await expect
    .poll(async () => (await (await page.request.get(new URL("/api/health", FEEDS_APP).href)).json()).feeds.some((sick: { id: number }) => sick.id === id), { timeout: 30_000 })
    .toBe(true);
  const summary = page.locator("#health-summary");
  await page.reload();
  await appReady(page);
  await expect(summary).toBeVisible();

  // Escape: on a phone, back to the feeds screen, as on every phone screen; on a computer the page is a place of
  // its own beside the sidebar (decision 0266), so it stays.
  await page.keyboard.press("Escape");
  if (isMobile) {
    await expect(page.getByRole("navigation", { name: "Sidebar" })).toBeVisible();
    await page.getByRole("navigation", { name: "Sidebar" }).getByRole("link", { name: "Everyone you follow" }).click();
  } else {
    await expect(page.getByRole("heading", { name: "Everyone you follow", level: 2 })).toBeVisible();
    await expect(page).toHaveURL(/\/following$/);
  }

  // The quiet row opens with Enter and keeps the keyboard; each line is one stop, and Enter opens their page.
  await tabTo(page, summary);
  await page.keyboard.press("Enter");
  await expect(summary).toHaveAttribute("aria-expanded", "true");
  await expect(summary).toBeFocused();
  const feed = summary.locator("xpath=ancestor::section[1]").getByRole("link", { name: new RegExp(`^${title}\\b`) });
  await tabTo(page, feed);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/(people|publications)/${id}/about$`));

  // Find new address: the keyboard lands on Use it, which says what it asks; Cancel goes back to the button.
  const box = page.getByRole("group", { name: "Not working" });
  const find = box.getByRole("button", { name: "Find new address", exact: true });
  await tabTo(page, find);
  await page.keyboard.press("Enter");
  const useIt = box.getByRole("button", { name: "Use it" });
  await expect(useIt).toBeFocused();
  await expect(useIt).toHaveAccessibleDescription(/^Use .*new\.xml instead\? Its name, folders, articles and stars stay\.$/);
  await page.keyboard.press("Shift+Tab");
  await expect(box.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(find).toBeFocused();

  // Unsubscribe, in the same box: it says so with Undo, and Undo brings them back.
  await tabTo(page, box.getByRole("button", { name: "Unsubscribe" }));
  await page.keyboard.press("Enter");
  const undo = page.getByRole("button", { name: "Undo" });
  await expect(undo).toBeVisible();
  await undo.click();
  await expect
    .poll(async () => (await (await page.request.get(new URL("/api/feeds", FEEDS_APP).href)).json()).feeds.map((followed: { id: number }) => followed.id))
    .toContain(id);
});

/** Follows a new blog of its own, makes it fail (`/move` or `/break`), and waits until Everyone you follow would list it. */
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
  await page.goto(new URL(`/people/${id}`, FEEDS_APP).href);
  await appReady(page);
  const list = page.locator("#list-pane");
  await list.getByRole("button", { name: "Find its new address" }).click();
  const choice = list.getByRole("radiogroup", { name: `Feeds on Blog ${several}'s site` });
  await expect(choice.getByRole("radio")).toHaveCount(2);
  await expect(choice.getByRole("radio").first()).toBeChecked();
  await expect(choice.getByRole("radio").first()).toBeFocused();
  // A grouped list of whole-width rows, one under another (never drawn as a segmented control).
  const [groupBox, firstBox, secondBox] = await Promise.all([choice.boundingBox(), choice.locator("label").first().boundingBox(), choice.locator("label").nth(1).boundingBox()]);
  expect(firstBox!.width).toBeGreaterThan(groupBox!.width - 2);
  expect(secondBox!.y).toBeGreaterThanOrEqual(firstBox!.y + firstBox!.height - 1);
  await expect(list.getByRole("button", { name: "Use it" })).toHaveCount(0);
  // Cancel puts it back as it was, the keyboard on the button.
  await list.getByRole("button", { name: "Cancel" }).click();
  await expect(choice).toHaveCount(0);
  await expect(list.getByRole("button", { name: "Find its new address" })).toBeFocused();

  // A feed whose site names nothing new: one plain sentence, on their page too.
  const none = `moving-gone-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const gone = await failing(page, none, "break");
  await page.goto(new URL(`/people/${gone}/about`, FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("button", { name: "Find new address", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /^The site doesn't name another feed/ })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: `Feeds on Blog ${none}'s site` })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Use it" })).toHaveCount(0);
});

test("their page moves a failing feed at once, says so, and keeps what was typed", async ({ page }) => {
  const name = `moving-edit-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const id = await failing(page, name, "move");
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  // A note half written on their page.
  await page.getByRole("button", { name: "Add a note…" }).click();
  const note = page.getByRole("textbox", { name: `A note on Blog ${name}` });
  await note.fill("Moved house in the spring");
  await page.getByRole("button", { name: "Find new address", exact: true }).click();
  await page.getByRole("button", { name: "Use it" }).click();
  await expect(page.getByRole("status").filter({ hasText: "It now reads from its new address and works again." })).toBeVisible();
  await expect(page.getByText(/This feed hasn't worked since/)).toHaveCount(0);
  await expect(note).toHaveValue("Moved house in the spring");
  const library = await (await page.request.get(new URL("/api/feeds", FEEDS_APP).href)).json();
  const feed = library.feeds.find((each: { id: number }) => each.id === id);
  expect(feed.failing_since ?? null).toBeNull();
});

test("moving a feed to a new number (others follow the old address) keeps their page and its confirmation", async ({ page }) => {
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
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("button", { name: "Find new address", exact: true }).click();
  await page.getByRole("button", { name: "Use it" }).click();
  await expect(page).toHaveURL(new RegExp(`/(people|publications)/${other}/about$`));
  await expect(page.getByRole("status").filter({ hasText: "It now reads from its new address and works again." })).toBeVisible();
});

/** Makes Everyone you follow see this feed as not working: it is only after a week, so this page's answer says so. */
async function seenDead(page: Page, title: string, change: Record<string, unknown> = {}): Promise<void> {
  await page.route("**/api/health", async (route) => {
    const real = await (await route.fetch()).json();
    for (const feed of real.feeds) if (feed.title === title) Object.assign(feed, { state: "dead" }, change);
    await route.fulfill({ json: real });
  });
}

test("a person whose site stopped answering may not know: their page offers Write to them first", async ({ page }) => {
  // Decision 0212: no dead ends. Only they can bring their site back, so Write to comes before Find new address (decision 0279).
  const name = `write-dead-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  const id = await failing(page, name, "break");
  await seenDead(page, title, { problem: "unreachable" });
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  const box = page.getByRole("group", { name: "Not working" });
  await expect(box).toContainText("They may not know.");
  const write = box.getByRole("button", { name: `Write to ${title}` });
  const find = box.getByRole("button", { name: "Find new address", exact: true });
  const leave = box.getByRole("button", { name: "Unsubscribe" });
  // Plain underlined words, in the order they're read and tabbed: Write to, Find new address, Unsubscribe; no paper plane.
  await expect(write).toHaveClass(/text-link/);
  await expect(write.locator("svg")).toHaveCount(0);
  await expect(find).toHaveClass(/text-link/);
  await tabTo(page, write);
  await page.keyboard.press("Tab");
  await expect(find).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(leave).toBeFocused();
  // The page's own Write to waits while the box offers it: one way to write, not two.
  await expect(page.getByRole("button", { name: `Write to ${title}` })).toHaveCount(1);
  // Write to: the box asks for their address in place, its Write an everyday bordered button.
  await write.click();
  const form = box.getByRole("form", { name: `Write to ${title}` });
  await expect(form.getByLabel("Their email address")).toBeFocused();
  await expect(form.getByRole("button", { name: "Write", exact: true })).not.toHaveClass(/btn-primary/);
  await form.getByRole("button", { name: "Not now" }).click();
  await expect(write).toBeFocused();
});

test("a publication whose feed stopped gets no Write to", async ({ page }) => {
  const name = `write-dead-pub-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  const id = await failing(page, name, "break");
  await seenDead(page, title, { problem: "unreachable" });
  // This page alone sees it as one nine turtles couldn't sort (decision 0264): kept with the publications, so no Write to.
  await page.route("**/api/feeds", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const real = await (await route.fetch()).json();
    for (const feed of real.feeds) if (feed.id === id) Object.assign(feed, { kind: "publication", open: true });
    await route.fulfill({ json: real });
  });
  await page.goto(new URL(`/publications/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  const box = page.getByRole("group", { name: "Not working" });
  await expect(box).toContainText("Site not answering since");
  await expect(box).not.toContainText("may not know");
  await expect(page.getByRole("button", { name: `Write to ${title}` })).toHaveCount(0);
  await expect(box.getByRole("button", { name: "Find new address", exact: true })).toBeVisible();
});

test("a YouTube channel YouTube won't send says so, rather than that it may have moved (decision 0272)", async ({ page }) => {
  const name = `youtube-refused-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  const id = await failing(page, name, "break");
  await seenDead(page, title, { problem: "not-found", youtube: true });
  await page.goto(new URL("/following", FEEDS_APP).href);
  await appReady(page);
  await page.locator("#health-summary").click();
  await expect(page.getByRole("link", { name: new RegExp(`^${title}\\s*YouTube not sending$`) })).toBeVisible();
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  const box = page.getByRole("group", { name: "Not working" });
  await expect(box).toContainText("YouTube isn't sending these videos to nine turtles at the moment.");
  await expect(box).not.toContainText("It may have moved");
  // They can't change what YouTube does, so nothing says they may not know, the box offers no Write to, and nothing comes first.
  await expect(box).not.toContainText("may not know");
  await expect(box.getByRole("button", { name: `Write to ${title}` })).toHaveCount(0);
  await expect(box.getByRole("button", { name: "Find new address", exact: true })).toHaveClass(/text-link/);
  // The page's own Write to stays, as on any day.
  await expect(page.getByRole("button", { name: `Write to ${title}` })).toHaveCount(1);
});

test("the box shows the address it writes to, with Change, so a wrong one can be corrected while the feed is broken", async ({ page }) => {
  const name = `write-dead-known-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  const id = await failing(page, name, "break");
  await page.request.post(new URL(`/api/feeds/${id}/write-to`, FEEDS_APP).href, { data: { address: "old@there.example" } });
  await seenDead(page, title, { problem: "unreachable" });
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  const box = page.getByRole("group", { name: "Not working" });
  await expect(box.getByRole("link", { name: `Write to ${title}` })).toBeVisible();
  await expect(box).toContainText("old@there.example");
  await box.getByRole("button", { name: `Change ${title}'s email address` }).click();
  await expect(box.getByRole("textbox", { name: "Their email address" })).toHaveValue("old@there.example");
  // One way to write, not two.
  await expect(page.getByRole("link", { name: `Write to ${title}` })).toHaveCount(0);
});

test("someone with two broken sources gets a box for each, and one Write to", async ({ page }) => {
  // Two feeds to break, each waiting for two failed checks: twice the usual time.
  test.slow();
  const stamp = `${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const ids = [await failing(page, `two-broken-a-${stamp}`, "break"), await failing(page, `two-broken-b-${stamp}`, "break")];
  const name = `Two ${stamp}`;
  expect((await page.request.post(new URL("/api/writers/join", FEEDS_APP).href, { data: { feeds: ids, name } })).ok()).toBe(true);
  await page.route("**/api/health", async (route) => {
    const real = await (await route.fetch()).json();
    for (const feed of real.feeds) if (ids.includes(feed.id)) Object.assign(feed, { state: "dead", problem: "unreachable" });
    await route.fulfill({ json: real });
  });
  await page.goto(new URL(`/people/${ids[0]}/about`, FEEDS_APP).href);
  await appReady(page);
  const boxes = page.getByRole("group", { name: "Not working" });
  await expect(boxes).toHaveCount(2);
  await expect(boxes.first()).toContainText(": Site not answering since");
  await expect(page.getByRole("button", { name: `Write to ${name}` })).toHaveCount(1);
  await expect(boxes.first().getByRole("button", { name: `Write to ${name}` })).toBeVisible();
});

test("a feed only having trouble offers nothing first: it's usually back soon", async ({ page }) => {
  const name = `trouble-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  const id = await failing(page, name, "break");
  await seenDead(page, title, { problem: "unreachable", state: "trouble" });
  await page.goto(new URL(`/people/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  const box = page.getByRole("group", { name: "Not working" });
  const find = box.getByRole("button", { name: "Find new address", exact: true });
  await expect(find).toHaveClass(/text-link/);
  await expect(box).not.toContainText("may not know");
  // Find new address, then Write to: the order they're read and tabbed.
  await tabTo(page, find);
  await page.keyboard.press("Tab");
  await expect(box.getByRole("button", { name: `Write to ${title}` })).toBeFocused();
});

test("the quiet row says how many aren't working, and what went wrong with each, worst first (decision 0279)", async ({ page }) => {
  await page.goto(new URL("/following", FEEDS_APP).href);
  await appReady(page);
  if (await page.getByLabel("Password", { exact: true }).isVisible()) await signIn(page);
  // As the server would list them: longest failing first. Made up, so nothing shared changes.
  const day = 24 * 60 * 60;
  const now = Math.floor(Date.now() / 1000);
  const sick = (id: number, title: string, state: string, problem: string, days: number) => ({
    id, title, url: `https://feeds.example/${id}.xml`, site_url: null, problem, failing_since: now - days * day,
    missing_since: problem === "not-found" ? now - days * day : null, fetched_at: null, next_check_at: now + day, failures: 9, state, youtube: false,
  });
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: {
        feeds: [
          sick(9901, "Ines Duarte", "dead", "unreachable", 40),
          sick(9902, "The Old Almanac", "dead", "not-found", 30),
          sick(9903, "Harbour Notes", "dead", "unreachable", 25),
          sick(9904, "Letters from the Coast", "trouble", "answered-503", 2),
        ],
      },
    }),
  );
  await page.reload();
  await appReady(page);
  const summary = page.locator("#health-summary");
  await expect(summary).toHaveText(/^\s*3 feeds aren't working\s*2 site not answering · 1 feed gone · 1 having trouble\s*$/);
  await summary.click();
  // Alike ones together, each reason where its longest failing feed was; those having trouble after.
  const section = summary.locator("xpath=ancestor::section[1]");
  await expect(section.getByRole("link")).toHaveText([
    /^\s*Ines Duarte\s*Site not answering\s*$/,
    /^\s*Harbour Notes\s*Site not answering\s*$/,
    /^\s*The Old Almanac\s*Feed gone\s*$/,
    /^\s*Letters from the Coast\s*Site has a problem\s*$/,
  ]);
  await expect(section).toContainText("Open one to fix it, write to them or unsubscribe.");
});
