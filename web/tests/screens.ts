import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP, OWNER_EMAIL, TEST_PASSWORD } from "../playwright.config";
import { LOOKS, THEMES as THEME_NAMES, type Theme } from "../src/lib/themes";

// Every screen of nine turtles. Each new screen is added here, so it is
// automatically checked for accessibility and photographed for the owner.
// `library` opens the screen on a nine turtles following the made-up library
// below (playwright.config.ts); without it, the screen is seen on a nine
// turtles with no feeds.
export type Screen = {
  name: string;
  path: string;
  signedIn: boolean;
  library?: boolean;
  open?: (page: Page) => Promise<void>;
};

/**
 * This nine turtles can't send email: its answer is changed to say it can, so the
 * sign-in page shows Forgot? (decision 0122), and asking for a link is answered as
 * the server would, with nothing sent.
 */
async function pretendEmail(page: Page): Promise<void> {
  await page.route("**/api/session", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), email_sending: true } });
  });
  await page.route("**/api/sign-in/link", (route) => route.fulfill({ status: 202, json: { asked: true } }));
  await page.reload();
  await appReady(page);
}

export const SCREENS: Screen[] = [
  { name: "sign-in", path: "/", signedIn: false },
  {
    name: "sign-in-with-email",
    path: "/",
    signedIn: false,
    open: async (page) => {
      await pretendEmail(page);
      await expect(page.getByRole("link", { name: "Forgot?" })).toBeVisible();
    },
  },
  { name: "sign-up", path: "/sign-up", signedIn: false },
  {
    name: "forgot",
    path: "/",
    signedIn: false,
    open: async (page) => {
      await pretendEmail(page);
      await page.getByLabel("Email").fill("reader@example.com");
      await page.getByRole("link", { name: "Forgot?" }).click();
      await expect(page.getByRole("button", { name: "Email me a link" })).toBeVisible();
    },
  },
  {
    name: "forgot-sent",
    path: "/",
    signedIn: false,
    open: async (page) => {
      await pretendEmail(page);
      await page.getByLabel("Email").fill("reader@example.com");
      await page.getByRole("link", { name: "Forgot?" }).click();
      await page.getByRole("button", { name: "Email me a link" }).click();
      await expect(page.getByRole("heading", { name: "Check your email" })).toBeFocused();
    },
  },
  {
    // The page the emailed link opens, once Sign in is pressed: a new password, if the reader wishes.
    name: "choose-password",
    path: "/",
    signedIn: false,
    open: async (page) => {
      await page.route("**/api/sign-in/link/use", (route) =>
        route.fulfill({ json: { done: "signed-in", password_ticket: "a-made-up-ticket" } }),
      );
      await page.goto("/sign-in-link#ticket=a-made-up-ticket");
      await expect(page.getByRole("button", { name: "Sign in" })).toBeFocused();
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByRole("heading", { name: "You're signed in" })).toBeFocused();
    },
  },
  { name: "first-visit", path: "/unread", signedIn: true },
  { name: "add-feed", path: "/add", signedIn: true },
  { name: "new-to-feeds", path: "/new-to-feeds", signedIn: true },
  {
    name: "articles",
    path: "/all",
    signedIn: true,
    library: true,
    open: async (page) => {
      await expect(page.getByRole("button", { name: "Show older articles" })).toBeVisible();
    },
  },
  {
    name: "add-feed-choice",
    path: "/add",
    signedIn: true,
    library: true,
    open: async (page) => {
      await page.getByLabel("Their website's address").fill(`${FEED_SITE}/two/`);
      await page.keyboard.press("Enter");
      await expect(page.getByText("This site offers more than one feed. Choose which to follow:")).toBeVisible();
    },
  },
  {
    // Once someone is found: "… is…", with two tiles (the owner's core path, point 1).
    name: "add-feed-question",
    path: "/add",
    signedIn: true,
    library: true,
    open: async (page) => {
      await page.getByLabel("Their website's address").fill(`${FEED_SITE}/blog/maya-${Date.now()}-${Math.floor(Math.random() * 1e6)}/`);
      await page.keyboard.press("Enter");
      await expect(page.getByRole("radio", { name: "A person", exact: true })).toBeFocused();
    },
  },
  {
    name: "article",
    path: "/all",
    signedIn: true,
    library: true,
    open: async (page) => {
      // Unread again where the screenshots have a nine turtles to themselves,
      // so every picture of it starts the same.
      await openReadingRoom(page, { unread: libraryApp() !== FEEDS_APP });
      await page.keyboard.press("Enter");
      await expect(page.getByRole("heading", { level: 2, name: "The pleasure of a slow letter" })).toBeFocused();
      await expect(page.locator('img[alt="A river drawn as three blue lines"]')).toBeVisible();
    },
  },
  {
    // The Aa panel open over an article: one quiet line per setting (decision 0123).
    name: "aa-panel",
    path: "/all",
    signedIn: true,
    library: true,
    open: async (page) => {
      await openReadingRoom(page, { unread: libraryApp() !== FEEDS_APP });
      await page.keyboard.press("Enter");
      await expect(page.getByRole("heading", { level: 2, name: "The pleasure of a slow letter" })).toBeFocused();
      await page.getByRole("button", { name: "Reading appearance" }).first().click();
      await expect(page.getByRole("dialog", { name: "Reading appearance" })).toBeVisible();
    },
  },
  {
    // Read, unread, selected and starred rows together, and the line with Undo.
    name: "marks",
    path: "/all",
    signedIn: true,
    library: true,
    open: async (page) => {
      // The library's own copy where the screenshots have a nine turtles to
      // themselves; elsewhere a fresh one, as other tests may be marking it too.
      const copy = libraryApp() === FEEDS_APP ? `marks-${Date.now()}/` : "";
      const id = await follow(page, `${FEED_SITE}/shelf/the-margins/${copy}feed.xml`);
      await unmark(page, id);
      await page.goto(new URL(`/people/${id}`, page.url()).href);
      await appReady(page);
      await expect(page.getByRole("button", { name: /On reading the same book twice/ })).toBeVisible();
      // The second article, starred: opening another would put the note away.
      await page.keyboard.press("j");
      await page.keyboard.press("j");
      await page.keyboard.press("s");
      await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
    },
  },
  {
    // A folder's list, with the folder open in the sidebar and a search typed.
    name: "folder",
    path: "/all",
    signedIn: true,
    library: true,
    open: async (page) => {
      const listed = await (await page.request.get(new URL("/api/feeds", page.url()).href)).json();
      const folder = listed.folders.find((each: { name: string }) => each.name === "Outdoors").id;
      // Opened in the sidebar, as if its button had been pressed.
      await page.evaluate((open) => localStorage.setItem("nine-turtles.open-folders", JSON.stringify([open])), folder);
      await page.goto(new URL(`/folders/${folder}`, page.url()).href);
      await appReady(page);
      await expect(page.getByRole("heading", { level: 2, name: "Outdoors" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Outdoors" }).getByRole("listitem").first()).toBeVisible();
    },
  },
  {
    name: "edit-feed",
    path: "/all",
    signedIn: true,
    library: true,
    open: async (page) => {
      const id = await follow(page, shelf("garden-letters"));
      await page.goto(new URL(`/people/${id}/edit`, page.url()).href);
      await appReady(page);
      await expect(page.getByRole("heading", { level: 2, name: /^Edit / })).toBeVisible();
    },
  },
  {
    // Their page: Write to under their name (point 9).
    name: "who-page",
    path: "/all",
    signedIn: true,
    library: true,
    open: async (page) => {
      const id = await follow(page, shelf("garden-letters"));
      await page.goto(new URL(`/people/${id}/about`, page.url()).href);
      await appReady(page);
      await expect(page.getByRole("button", { name: /^Write to / }).or(page.getByRole("link", { name: /^Write to / }))).toBeVisible();
    },
  },
  {
    name: "search",
    path: "/all",
    signedIn: true,
    library: true,
    open: async (page) => {
      // On a phone the field waits behind the Search button beside More until asked for (decision 0060).
      await expect(page.getByRole("region", { name: "All articles" }).getByRole("listitem").first()).toBeVisible();
      await page.keyboard.press("/");
      await expect(page.locator("#search-field")).toBeFocused();
      await page.keyboard.type("reading");
      await expect(page.locator("#list-heading")).toHaveText("Results in All articles");
      await expect(page.getByRole("region", { name: /^Results in / }).locator("mark").first()).toBeVisible();
    },
  },
  { name: "settings", path: "/settings", signedIn: true, library: true },
  { name: "settings-install", path: "/settings/install", signedIn: true, library: true },
  {
    // Settings › Connected assistants with one assistant (SPEC section 33).
    name: "connected-assistants",
    path: "/settings/assistants",
    signedIn: true,
    open: async (page) => {
      const now = Math.floor(Date.now() / 1000);
      await page.route("**/api/assistants", (route) =>
        route.fulfill({
          json: {
            assistants: [{ id: 1, name: "Claude", connected_at: now - 86400, last_used_at: now - 3600 }],
          },
        }),
      );
      await page.reload();
      await appReady(page);
      const kept = page.getByText(/kept for 30 days, under Recently unsubscribed/);
      await kept.scrollIntoViewIfNeeded();
      await expect(kept).toBeVisible();
    },
  },
  {
    // The page an assistant opens to ask to connect (SPEC section 33).
    name: "connect-assistant",
    path: "/unread",
    signedIn: true,
    open: async (page) => {
      const api = (path: string) => new URL(path, page.url()).href;
      const redirect = "https://claude.ai/api/mcp/auth_callback";
      const registered = await (
        await page.request.post(api("/oauth/register"), { data: { client_name: "Claude", redirect_uris: [redirect] } })
      ).json();
      const query = new URLSearchParams({
        response_type: "code",
        client_id: registered.client_id,
        redirect_uri: redirect,
        code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
        code_challenge_method: "S256",
        state: "screens",
      });
      await page.goto(api(`/oauth/authorize?${query}`));
      await expect(page.getByRole("heading", { level: 1, name: "Connect Claude to nine turtles?" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Connect" })).toBeVisible();
    },
  },
  { name: "your-feeds", path: "/settings/feeds", signedIn: true, library: true },
  {
    // Everyone you follow scrolled to Recently unsubscribed (decision 0240): one the reader
    // left today and one an assistant left, answered here so nothing is really unsubscribed.
    name: "your-feeds-recently-unsubscribed",
    path: "/settings/feeds",
    signedIn: true,
    library: true,
    open: async (page) => {
      const now = Math.floor(Date.now() / 1000);
      const day = 24 * 60 * 60;
      await page.route("**/api/tidy/feeds", async (route) => {
        const listed = await (await route.fetch()).json();
        listed.unsubscribed = [
          { feed_id: 9998, title: "Quiet Notes", person: null, unsubscribed_at: now - 60, kept_until: now + 30 * day, by_assistant: false },
          { feed_id: 9999, title: "Field Recordings", person: null, unsubscribed_at: now - 3 * day, kept_until: now + 27 * day, by_assistant: true },
        ];
        await route.fulfill({ json: listed });
      });
      await page.reload();
      await appReady(page);
      const kept = page.getByRole("heading", { name: "Recently unsubscribed" });
      await kept.scrollIntoViewIfNeeded();
      await expect(kept).toBeVisible();
    },
  },
  {
    name: "your-feeds-editing",
    path: "/settings/feeds",
    signedIn: true,
    library: true,
    open: async (page) => {
      await page.getByRole("button", { name: "Choose…" }).click();
      await page.getByRole("checkbox").first().check();
      await expect(page.getByText("1 chosen")).toBeVisible();
    },
  },
  {
    // Everyone you follow with two broken feeds at the top, one of each kind,
    // as the server would describe them, so the library the screenshots follow stays healthy.
    name: "your-feeds-not-working",
    path: "/settings/feeds",
    signedIn: true,
    library: true,
    open: async (page) => {
      const now = Math.floor(Date.now() / 1000);
      const day = 24 * 60 * 60;
      const feed = (id: number, title: string, state: string, problem: string, since: number) => ({
        id,
        title,
        url: `https://feeds.example/${id}.xml`,
        site_url: null,
        problem,
        failing_since: now - since * day,
        missing_since: problem === "not-found" ? now - since * day : null,
        fetched_at: now - since * day,
        next_check_at: now + day,
        failures: 9,
        state,
      });
      await page.route("**/api/health", (route) =>
        route.fulfill({
          json: {
            feeds: [
              feed(901, "The Old Almanac", "dead", "not-found", 12),
              feed(902, "Letters from the Coast", "trouble", "unreachable", 2),
            ],
          },
        }),
      );
      await page.reload();
      await appReady(page);
      await expect(page.getByRole("heading", { name: "Not working" })).toBeVisible();
    },
  },
  {
    // Settings › Hiding with three words: for good, for a person for a while, and one
    // paused before the switch went. The rules are as the server would send them, so the
    // library the screenshots follow stays as it is (decision 0201).
    name: "hiding",
    path: "/settings/hiding",
    signedIn: true,
    library: true,
    open: async (page) => {
      const soon = Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60;
      const rule = (id: number, words: string, paused: boolean, until: number | null) => ({ id, words, title_only: false, feed_id: null, place_gone: false, paused, until });
      await page.route("**/api/rules", (route) =>
        route.request().method() === "GET"
          ? route.fulfill({ json: { rules: [rule(901, "sponsored", false, null), rule(902, "election", false, soon), rule(903, "crypto", true, null)], muted: 12 } })
          : route.continue(),
      );
      await page.reload();
      await appReady(page);
      await expect(page.getByText("Everyone · 5 days left")).toBeVisible();
      await page.getByRole("textbox", { name: "Hide articles about" }).fill("giveaway");
    },
  },
  {
    // Hidden articles, as the server would list them.
    name: "hidden",
    path: "/settings/hidden",
    signedIn: true,
    open: async (page) => {
      const day = 24 * 60 * 60;
      const now = Math.floor(Date.now() / 1000);
      const article = (id: number, title: string, feed: string, ago: number) => ({
        id,
        feed_id: 1,
        feed_title: feed,
        title,
        link: null,
        at: now - ago * day,
        read: true,
        starred: false,
        muted: true,
      });
      await page.route("**/api/muted", (route) =>
        route.fulfill({
          json: {
            articles: [
              article(901, "Sponsored: the notebook I carry everywhere", "Field Notes", 1),
              article(902, "A giveaway for readers", "Small Kitchen", 3),
            ],
            count: 2,
          },
        }),
      );
      await page.reload();
      await appReady(page);
      await expect(page.getByRole("heading", { name: "2 hidden articles" })).toBeVisible();
    },
  },
  {
    // The owner's Readers page (decision 0090), with three made-up readers.
    name: "readers",
    path: "/settings/readers/all",
    signedIn: true,
    open: async (page) => {
      const day = 24 * 60 * 60;
      const now = Math.floor(Date.now() / 1000);
      const reader = (id: number, email: string | null, joined: number, feeds: number, failing: number) => ({
        id,
        email,
        owner: id === 1,
        created_at: now - joined * day,
        feeds,
        feeds_failing: failing,
      });
      await page.route("**/api/admin", (route) =>
        route.fulfill({
          json: {
            totals: { readers: 3, feeds: 214, feeds_resting: 12, feeds_failing: 2, articles: 18_430 },
            database_bytes: 96_000_000,
            backups: { on: true, latest_nightly: "nightly/2026-10-25.sqlite" },
            email_sending: true,
            problems: [],
            readers: [
              reader(1, "owner@example.com", 300, 142, 2),
              reader(3, "sam@example.com", 2, 18, 0),
              reader(2, "ada@example.com", 90, 61, 0),
            ],
            most_feeds: 1000,
            away_after_days: 30,
          },
        }),
      );
      await page.reload();
      await appReady(page);
      await expect(page.getByRole("heading", { name: "3 readers" })).toBeVisible();
    },
  },
  {
    name: "shortcuts",
    path: "/unread",
    signedIn: true,
    open: async (page) => {
      await page.keyboard.press("?");
      await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
    },
  },
];

/** A blog in the made-up library (tests/feed-server.mjs → SHELF), by its feed's address. */
const shelf = (blog: string) => `${FEED_SITE}/shelf/${blog}/feed.xml`;

/**
 * What the library screens follow: blogs a real reader might, two of them in
 * folders, so the pictures on a pull request look like nine turtles in use.
 * Each blog by one writer goes by that writer's name.
 */
const LIBRARY: { address: string; folder?: string }[] = [
  { address: shelf("field-notes"), folder: "Outdoors" },
  { address: shelf("garden-letters"), folder: "Outdoors" },
  { address: shelf("low-tide"), folder: "Outdoors" },
  { address: shelf("the-margins") },
  { address: `${FEED_SITE}/reading.xml` },
  { address: shelf("slow-code") },
  { address: shelf("small-kitchen"), folder: "Making" },
  { address: shelf("workbench"), folder: "Making" },
];

/**
 * The nine turtles that follows the library: the screenshots' own one when
 * they run (playwright.config.ts), otherwise the one the feed tests share.
 */
export function libraryApp(): string {
  return (test.info().project.metadata as { feedsApp?: string }).feedsApp ?? FEEDS_APP;
}

/** Follows the whole library, each blog in its folder. Doing it twice is fine. */
async function followLibrary(page: Page): Promise<void> {
  for (const { address, folder } of LIBRARY) {
    const id = await follow(page, address);
    if (!folder) continue;
    const saved = await page.request.post(new URL(`/api/feeds/${id}`, page.url()).href, {
      data: { folders: [], new_folder: folder },
    });
    expect(saved.ok()).toBe(true);
  }
}

/** Marks every article of a feed unread and unstarred again, so its screen starts the same each time. */
async function unmark(page: Page, feed: number, marks: [string, boolean][] = [["read", false], ["starred", false]]): Promise<void> {
  const listed = await (await page.request.get(new URL(`/api/articles?feed=${feed}`, page.url()).href)).json();
  const ids = listed.articles.map((article: { id: number }) => article.id);
  for (const [mark, value] of marks) {
    const done = await page.request.post(new URL(`/api/articles/${mark}`, page.url()).href, { data: { ids, [mark]: value } });
    expect(done.ok()).toBe(true);
  }
}

/** Every page (White, Paper, Night), each checked and photographed. */
export const THEMES: Theme[] = [...THEME_NAMES];

// Each page's color (themes.ts, checked against themes.css), used to prove the page took effect.
function background(theme: Theme): string {
  const hex = LOOKS[theme].page;
  return `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
}

/**
 * Follows a feed through nine turtles' own API, with the page's sign-in, so a
 * screen can start with feeds. Following one twice is fine.
 */
export async function follow(page: Page, address: string): Promise<number> {
  const response = await page.request.post(new URL("/api/feeds", page.url()).href, { data: { address } });
  expect([201, 409]).toContain(response.status());
  const body = await response.json();
  return Number(body.feed?.id ?? body.feed_id);
}

/** Follows Reading Room and opens its list, with nothing selected yet (and, if asked, nothing read). */
export async function openReadingRoom(page: Page, { unread = false, read = false } = {}): Promise<void> {
  const id = await follow(page, `${FEED_SITE}/reading/`);
  if (unread) await unmark(page, id);
  if (read) await unmark(page, id, [["read", true]]);
  await page.goto(new URL(`/people/${id}`, page.url()).href);
  await appReady(page);
  await expect(page.getByRole("button", { name: /The pleasure of a slow letter/ })).toBeVisible();
}

/**
 * Nothing to pick up on this page (decision 0175 comes first): every test shares
 * one reader, and another test may have just left an article part of the way through.
 */
export async function nothingToPickUp(page: Page): Promise<void> {
  await page.route("**/api/resume", (route) => (route.request().method() === "GET" ? route.fulfill({ json: {} }) : route.continue()));
}

/** Signs in through the sign-in page, the way the reader does. */
export async function signIn(page: Page): Promise<void> {
  await page.getByLabel("Email").fill(OWNER_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  // At most two password checks run at once on the whole server, each a
  // deliberately slow scramble, so with every test signing in together one
  // can wait its turn for longer than the usual five seconds.
  await expect(page.locator("#sidebar")).toBeAttached({ timeout: 15_000 });
}

/**
 * Gives the owner their email, as their first sign-in does (decision 0116), so
 * a test's wrong tries with other emails never count as tries at the owner's
 * password on a nine turtles whose owner has no email yet.
 */
export async function ownerHasEmail(request: APIRequestContext, base = ""): Promise<void> {
  const answer = await request.post(`${base}/api/sign-in`, {
    data: { email: OWNER_EMAIL, password: TEST_PASSWORD },
    headers: { "sec-fetch-site": "same-origin" },
  });
  expect(answer.status()).toBe(204);
}

/** Waits until nine turtles has decided which screen to show. */
export async function appReady(page: Page): Promise<void> {
  // Signed in, the sidebar is there on every width (a phone may show another screen first).
  await expect(page.getByLabel("Password", { exact: true }).or(page.locator("#sidebar"))).toBeAttached();
}

/**
 * Waits for a change in Settings (sort order, hidden lists, …) to reach the
 * server. Start waiting before the change is made, and await it before a
 * reload or a new page: otherwise the page can load before the save lands
 * and still show the old choice.
 */
export function settingsSaved(page: Page, address = "/api/settings"): Promise<unknown> {
  return page.waitForResponse((response) => response.url().endsWith(address) && response.request().method() === "POST" && response.ok());
}

/** Chooses a page the way Settings saves it, before the page loads. */
export async function chooseTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript((chosen) => {
    localStorage.setItem("nine-turtles.preferences", JSON.stringify(chosen));
  }, { page: theme });
}

export async function openScreen(page: Page, screen: Screen, theme: Theme): Promise<void> {
  await chooseTheme(page, theme);
  await page.goto(screen.library ? new URL(screen.path, libraryApp()).href : screen.path);
  await appReady(page);
  if (screen.signedIn) await signIn(page);
  if (screen.library) {
    await followLibrary(page);
    await page.reload();
    await appReady(page);
  }
  await screen.open?.(page);
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe(background(theme));
}

/** "Mark all as read" sits in the list's More (…) menu, beside the list's title. */
export async function markAllFromMenu(page: Page): Promise<void> {
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("menuitem", { name: "Mark all as read" }).click();
}

/**
 * Presses Tab until the keyboard's place reaches the element: the keyboard
 * floor. It gives up only once Tab has come round to a place it has already
 * been, so the sidebar's feeds, which grow as the tests follow more, never
 * make it run out of presses. A test that means "within so many presses"
 * gives its own limit.
 *
 * If the place the keyboard was on leaves the page meanwhile (the sidebar
 * redrew as new articles came in), Tab carries on from near where it was and
 * may pass places it has already been, so the walk starts afresh rather than
 * calling that a full lap (decision 0114).
 */
export async function tabTo(page: Page, target: Locator, limit = 2000): Promise<void> {
  type Walk = { tabbed: WeakSet<Element>; last: Element | null; fresh: number };
  await page.evaluate(() => {
    (window as unknown as { walk: Walk }).walk = { tabbed: new WeakSet(), last: null, fresh: 0 };
  });
  for (let i = 0; i <= limit; i++) {
    const where = await target.evaluate((element) => {
      const here = document.activeElement;
      if (element === here) return "reached";
      const walk = (window as unknown as { walk: Walk }).walk;
      if (walk.last && !walk.last.isConnected && walk.fresh < 20) {
        walk.tabbed = new WeakSet();
        walk.last = null;
        walk.fresh += 1;
      }
      // Inside a frame (a video player) the place stays on the frame itself.
      if (here && here !== document.body && here.tagName !== "IFRAME") {
        if (walk.tabbed.has(here)) return "round";
        walk.tabbed.add(here);
        walk.last = here;
      }
      return "on";
    });
    if (where === "reached") return;
    if (where === "round" || i === limit) break;
    await page.keyboard.press("Tab");
  }
  throw new Error("Tab never reached the element");
}

/** Chooses `words` in the open article's text, as a reader does with the mouse. */
export async function choose(page: Page, words: string): Promise<void> {
  // The heading shows before the article's text arrives: wait for the words themselves.
  await expect(page.locator(".article-text")).toContainText(words);
  await page.evaluate((wanted) => {
    const text = document.querySelector(".article-text")!;
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = (node as Text).data.indexOf(wanted);
      if (at === -1) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + wanted.length);
      getSelection()!.removeAllRanges();
      getSelection()!.addRange(range);
      text.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      return;
    }
    throw new Error(`"${wanted}" isn't in the article`);
  }, words);
}
