import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn, tabTo } from "./screens";

// SPEC section 15: a feed that stops working is listed at the top of
// Everyone you follow in plain words, and Find new address moves it to where the site now
// keeps it. The test nine turtles checks every feed every two seconds, so a
// moved feed fails twice within moments. Each run follows a blog of its own.

test("a moved feed is a calm row in plain words, and Find new address moves it", async ({ page, isMobile }) => {
  const name = `moving-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/`);
  expect((await page.request.get(`${FEED_SITE}/move/${name}`)).ok()).toBe(true);
  // A blog whose feed names no writer may be sorted either way; this page alone sees it as a person.
  await page.route("**/api/feeds", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    try {
      const real = await (await route.fetch()).json();
      for (const feed of real.feeds) if (feed.id === id) Object.assign(feed, { kind: "person", open: false });
      await route.fulfill({ json: real });
    } catch {
      // The page reloaded (below, while waiting for the feed to fail) before this answer was given: nothing waits for it.
    }
  });

  // Everyone you follow: a row of its own in the sidebar, under the lists (decision 0266).
  await page.goto(new URL("/", FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("navigation", { name: "Sidebar" }).getByRole("link", { name: "Everyone you follow" }).click();
  await expect(page.getByRole("heading", { name: "Everyone you follow", level: 2 })).toBeVisible();
  await expect(page).toHaveURL(/\/following$/);

  const feed = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(async () => {
    await page.reload();
    await appReady(page);
    await expect(feed).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  // Grouped under words, never by color alone, and explained without codes.
  await expect(page.getByRole("heading", { name: "Having trouble" })).toBeVisible();
  await expect(feed).toContainText("Nothing has come through since earlier today.");
  await expect(feed).toContainText("The site says the feed isn't there any more.");
  // A word on its own: the title carries a timestamp, which may end in 404.
  await expect(feed).not.toContainText(/\b404\b/);
  // A calm row in its group's one grouped list (decision 0268): its name and what happened in regular weight,
  // with no address or codes, on a computer and a phone alike.
  await expect(feed.locator("xpath=..")).toHaveCSS("border-top-left-radius", "12px");
  await expect(feed.locator("dt")).toHaveCount(0);
  await expect(feed).not.toContainText(FEED_SITE);
  await expect(feed.locator(".what")).toHaveCSS("font-weight", "400");
  // Who it is, at a glance and in words: the person or publication icon before the name.
  const heading = feed.getByRole("heading", { name: title });
  await expect(heading).toHaveText(`Person: ${title}`);
  await expect(feed.locator(".kind")).toHaveAttribute("title", "A person");
  const [iconBox, nameBox, whatBox] = await Promise.all([feed.locator(".kind svg").boundingBox(), heading.boundingBox(), feed.locator(".what").boundingBox()]);
  expect(iconBox!.x + iconBox!.width).toBeLessThanOrEqual(nameBox!.x);
  expect(Math.abs(iconBox!.y + iconBox!.height / 2 - (nameBox!.y + nameBox!.height / 2))).toBeLessThanOrEqual(2);
  // The sentence starts on the name's own left edge.
  expect(Math.abs(whatBox!.x - nameBox!.x)).toBeLessThanOrEqual(1);
  // What can be done is plain underlined words, no solid or red button: Find new address, then Unsubscribe, with
  // no Retry; each at least 44px tall, on the name's left edge, side by side.
  const find = feed.getByRole("button", { name: `Find new address for ${title}` });
  const leave = feed.getByRole("button", { name: `Unsubscribe from ${title}` });
  await expect(feed.locator(".actions > button")).toHaveText(["Find new address", "Unsubscribe"]);
  await expect(feed.locator(".btn-primary, .btn-danger, .btn")).toHaveCount(0);
  for (const link of [find, leave]) {
    await expect(link).toHaveClass(/text-link/);
    await expect(link).toHaveCSS("text-decoration-line", "underline");
  }
  // Unsubscribe is in the destructive red, and its words say what it does: never color alone.
  expect(await leave.evaluate((el) => getComputedStyle(el).color)).not.toBe(await find.evaluate((el) => getComputedStyle(el).color));
  const [findBox, leaveBox] = await Promise.all([find.boundingBox(), leave.boundingBox()]);
  for (const box of [findBox!, leaveBox!]) expect(box.height).toBeGreaterThanOrEqual(44);
  expect(Math.abs(findBox!.x - nameBox!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(leaveBox!.y - findBox!.y)).toBeLessThanOrEqual(1);
  expect(leaveBox!.x).toBeGreaterThanOrEqual(findBox!.x + findBox!.width + 16);

  // The site names one feed: one plain question, rather than a list of one (decision 0106).
  await feed.getByRole("button", { name: `Find new address for ${title}` }).click();
  await expect(feed.getByText(new RegExp(`^Use ${FEED_SITE}/blog/${name}/new\\.xml instead\\?$`))).toBeVisible();
  await expect(feed).toContainText("Its name, folders, articles and stars stay.");
  await expect(feed.getByRole("radio")).toHaveCount(0);
  await feed.getByRole("button", { name: "Use it" }).click();
  await expect(feed.getByText(/It now reads from its new address and works again/)).toBeVisible();
  await expect(feed).toContainText("Working again.");
  // Working again, its row offers nothing more, and the keyboard rests on its name.
  await expect(feed.getByRole("button")).toHaveCount(0);
  await expect(heading).toBeFocused();
  // It stays where it was until the page is opened again; then it's gone.
  await page.reload();
  await appReady(page);
  await expect(page.getByRole("heading", { name: "Everyone you follow", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: title })).toHaveCount(0);

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
  await expect(page.getByRole("region", { name: /^About / }).getByText(/hasn't worked since/)).not.toContainText("This feed");
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

test("with the keyboard alone: Unsubscribe and Undo, Find new address and back, Escape", async ({ page, isMobile }) => {
  const name = `moving-keys-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  // The old Feed health address opens Everyone you follow.
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

  // Unsubscribe: the keyboard moves to Undo, and Undo brings it back.
  await tabTo(page, feed.getByRole("button", { name: `Unsubscribe from ${title}` }));
  await page.keyboard.press("Enter");
  await expect(status).toHaveText(`Unsubscribed from ${title}.`);
  const undo = feed.getByRole("button", { name: `Undo unsubscribing from ${title}` });
  await expect(undo).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(status).toHaveText("Undone.");
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

  // Escape: on a phone, back to the feeds screen, as on every phone screen; on a computer the page is a place of
  // its own beside the sidebar (decision 0266), so it stays.
  await page.keyboard.press("Escape");
  if (isMobile) await expect(page.getByRole("navigation", { name: "Sidebar" })).toBeVisible();
  else {
    await expect(page.getByRole("heading", { name: "Everyone you follow", level: 2 })).toBeVisible();
    await expect(page).toHaveURL(/\/following$/);
  }
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

test("moving a dead feed in Everyone you follow keeps its place and its confirmation", async ({ page }) => {
  // A feed is dead only after a week; the page's list is changed to call this one dead.
  const name = `moving-dead-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  await failing(page, name, "move");
  await page.route("**/api/health", async (route) => {
    const real = await (await route.fetch()).json();
    for (const feed of real.feeds) if (feed.title === title) feed.state = "dead";
    await route.fulfill({ json: real });
  });
  await page.goto(new URL("/following", FEEDS_APP).href);
  await appReady(page);
  const dead = page.getByRole("region", { name: "Not working" });
  const feed = dead.getByRole("listitem").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(feed).toBeVisible();
  await feed.getByRole("button", { name: `Find new address for ${title}` }).click();
  await feed.getByRole("button", { name: "Use it" }).click();
  // It stays under Not working, saying it moved, with the keyboard on its name.
  await expect(feed.getByText("It now reads from its new address and works again.", { exact: false })).toBeVisible();
  await expect(feed).toContainText("Working again.");
  await expect(feed.getByRole("heading", { name: title })).toBeFocused();
  // Working again, so nothing more to do, and nothing to write to them about (decisions 0212, 0268).
  await expect(feed).not.toContainText("may not know");
  await expect(feed.getByRole("button")).toHaveCount(0);
});

test("a person whose feed stopped may not know: their Not working row offers Write to them", async ({ page }) => {
  // Decision 0212: no dead ends. A feed is dead only after a week; the page's list is changed to call this one dead.
  const name = `write-dead-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  await failing(page, name, "break");
  await page.route("**/api/health", async (route) => {
    const real = await (await route.fetch()).json();
    for (const feed of real.feeds) if (feed.title === title) feed.state = "dead";
    await route.fulfill({ json: real });
  });
  await page.goto(new URL("/following", FEEDS_APP).href);
  await appReady(page);
  const dead = page.getByRole("region", { name: "Not working" });
  const feed = dead.getByRole("listitem").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(feed).toContainText(`${title} may not know.`);
  // One of the row's plain links, between Find new address and Unsubscribe, on their line (decision 0268): no
  // paper plane, no button.
  const write = feed.getByRole("button", { name: `Write to ${title}` });
  const find = feed.getByRole("button", { name: `Find new address for ${title}` });
  const leave = feed.getByRole("button", { name: `Unsubscribe from ${title}` });
  await expect(write).toBeVisible();
  await expect(write).toHaveClass(/text-link/);
  await expect(write.locator("svg")).toHaveCount(0);
  await expect(feed.locator(".btn-primary, .btn-danger, .btn")).toHaveCount(0);
  const [findBox, writeBox, leaveBox, rowBox] = await Promise.all([find.boundingBox(), write.boundingBox(), leave.boundingBox(), feed.boundingBox()]);
  expect(writeBox!.height).toBeGreaterThanOrEqual(44);
  // Read in order, wrapping where the row is too narrow (a long name on a phone): each one beside the one before
  // it, or starting a line of its own on the name's left edge, never past the row's end.
  const after = (box: typeof findBox, before: typeof findBox) =>
    (Math.abs(box!.y - before!.y) <= 1 && box!.x >= before!.x + before!.width + 16) || (box!.y >= before!.y + before!.height - 1 && Math.abs(box!.x - findBox!.x) <= 1);
  expect(after(writeBox, findBox)).toBe(true);
  expect(after(leaveBox, writeBox)).toBe(true);
  for (const box of [findBox, writeBox, leaveBox]) expect(box!.x + box!.width).toBeLessThanOrEqual(rowBox!.x + rowBox!.width);
  // From the keyboard, in the order they're read: Find new address, Write to, Unsubscribe.
  await tabTo(page, find);
  await page.keyboard.press("Tab");
  await expect(write).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(leave).toBeFocused();
  // Write to: the box asks for their address in place, under the row's links, its Write an everyday button.
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Enter");
  const box = feed.getByRole("form", { name: `Write to ${title}` });
  await expect(box.getByLabel("Their email address")).toBeFocused();
  await expect(box.getByRole("button", { name: "Write", exact: true })).not.toHaveClass(/btn-primary/);
  // On a line of its own after Find new address, and before Unsubscribe, for the eye as for the keyboard.
  const [boxBox, leaveNow] = await Promise.all([box.boundingBox(), leave.boundingBox()]);
  expect(boxBox!.y).toBeGreaterThanOrEqual(findBox!.y + findBox!.height - 1);
  expect(leaveNow!.y).toBeGreaterThanOrEqual(boxBox!.y + boxBox!.height - 1);
  await box.getByRole("button", { name: "Not now" }).focus();
  await page.keyboard.press("Tab");
  await expect(leave).toBeFocused();
  await box.getByRole("button", { name: "Not now" }).click();
  await expect(write).toBeFocused();
});

test("with Write to pressed, the keyboard meets what it brought before Unsubscribe, as the eye does", async ({ page }) => {
  // Decision 0268: what follows Write to takes a line of its own straight after it, so the order read and the order tabbed agree.
  const name = `write-order-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  const id = await failing(page, name, "break");
  expect((await page.request.post(new URL(`/api/feeds/${id}`, FEEDS_APP).href, { data: { kind: "person" } })).ok()).toBe(true);
  expect((await page.request.post(new URL(`/api/feeds/${id}/write-to`, FEEDS_APP).href, { data: { address: "ivy@ivy.example" } })).ok()).toBe(true);
  await page.route("**/api/health", async (route) => {
    const real = await (await route.fetch()).json();
    for (const feed of real.feeds) if (feed.title === title) feed.state = "dead";
    await route.fulfill({ json: real });
  });
  await page.goto(new URL("/following", FEEDS_APP).href);
  await appReady(page);
  const feed = page.getByRole("region", { name: "Not working" }).getByRole("listitem").filter({ has: page.getByRole("heading", { name: title }) });
  const write = feed.getByRole("link", { name: `Write to ${title}` });
  const leave = feed.getByRole("button", { name: `Unsubscribe from ${title}` });
  // The address is known: Write to opens the email app, and the row says so on a line of its own (no address shown here).
  await expect(write).toHaveAttribute("href", /^mailto:ivy@ivy\.example/);
  await expect(feed).not.toContainText("ivy@ivy.example");
  await tabTo(page, write);
  await page.keyboard.press("Enter");
  const line = feed.locator(".opening-line");
  await expect(line).toBeVisible();
  const [writeBox, lineBox, leaveBox] = await Promise.all([write.boundingBox(), line.boundingBox(), leave.boundingBox()]);
  expect(lineBox!.y).toBeGreaterThanOrEqual(writeBox!.y + writeBox!.height - 1);
  expect(leaveBox!.y).toBeGreaterThanOrEqual(lineBox!.y + lineBox!.height - 1);
  // Tab from Write to: through the line's own words (Didn't open?, or a touch screen's Copy their address), then Unsubscribe.
  const stops: string[] = [];
  for (let step = 0; step < 6; step++) {
    await page.keyboard.press("Tab");
    if (await leave.evaluate((el) => el === document.activeElement)) break;
    stops.push(await page.evaluate(() => (document.activeElement?.closest(".opening-line") ? "line" : (document.activeElement?.textContent ?? "").trim())));
  }
  await expect(leave).toBeFocused();
  expect(stops.length).toBeGreaterThan(0);
  expect(stops.every((stop) => stop === "line")).toBe(true);
  // And back again, the same way.
  for (const _ of stops) await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(write).toBeFocused();
});

test("a publication whose feed stopped gets no Write to", async ({ page }) => {
  const name = `write-dead-pub-${test.info().project.name}-${test.info().workerIndex}-${Date.now()}`;
  const title = `Blog ${name}`;
  const id = await failing(page, name, "break");
  await page.route("**/api/health", async (route) => {
    const real = await (await route.fetch()).json();
    for (const feed of real.feeds) if (feed.title === title) feed.state = "dead";
    await route.fulfill({ json: real });
  });
  // This page alone sees it as one nine turtles couldn't sort (decision 0264): it could be either, kept with the
  // publications until the reader says, so it has no Write to and shows the publication icon.
  await page.route("**/api/feeds", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const real = await (await route.fetch()).json();
    for (const feed of real.feeds) if (feed.id === id) Object.assign(feed, { kind: "publication", open: true });
    await route.fulfill({ json: real });
  });
  await page.goto(new URL("/following", FEEDS_APP).href);
  await appReady(page);
  const feed = page.getByRole("region", { name: "Not working" }).getByRole("listitem").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(feed).toBeVisible();
  // The publication icon, at a glance and in words (decision 0268).
  await expect(feed.getByRole("heading", { name: title })).toHaveText(`Publication: ${title}`);
  await expect(feed.locator(".kind")).toHaveAttribute("title", "A publication");
  await expect(feed).not.toContainText("may not know");
  await expect(feed.getByRole("button", { name: `Write to ${title}` })).toHaveCount(0);
});
