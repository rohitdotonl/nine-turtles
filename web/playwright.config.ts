import { defineConfig, devices } from "@playwright/test";

// Node's own type descriptions are a separate library; this one line is all we need.
declare const process: { env: Record<string, string | undefined> };

// Browser tests run against the real nine turtles program (built by
// scripts/check.sh), not a development server, so they test what ships.
const PORT = 4318;
// A second nine turtles for the tests that add feeds, so the first one stays
// empty for the first-visit screens, and a made-up publisher for it to read.
const FEEDS_PORT = 4320;
const FEED_SITE_PORT = 4319;
export const FEEDS_APP = `http://127.0.0.1:${FEEDS_PORT}`;
export const FEED_SITE = `http://127.0.0.1:${FEED_SITE_PORT}`;
// The screenshots get a nine turtles each for desktop and phone, with nothing
// in them but the made-up library they follow (tests/screens.ts), so the
// pictures never show the other tests' feeds.
const SHOTS_PORTS = { desktop: 4321, phone: 4322 };
// A nine turtles that sends email (decision 0088), to a made-up mail server on
// this computer that keeps each email for the tests to read (tests/mail-server.mjs).
const MAIL_PORT = 4323;
const MAIL_SMTP_PORT = 4324;
const MAIL_HTTP_PORT = 4325;
export const MAIL_APP = `http://127.0.0.1:${MAIL_PORT}`;
export const MAILBOX = `http://127.0.0.1:${MAIL_HTTP_PORT}`;
const server = process.env.NINE_TURTLES_BINARY ?? "../server/target/release/nine-turtles";
// Lets a computer with its own copy of Chromium use it instead of downloading one.
const executablePath = process.env.NINE_TURTLES_CHROMIUM || undefined;
// The browser tests sign in with this made-up password. The line below is its
// scrambled form, made with `nine-turtles set-password`; it protects nothing real.
export const TEST_PASSWORD = "a quiet place to read";
const TEST_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$8nl1b5uDMerwM3og4iDG4w$bgqLzKbYivttmjWGuPa/48SDwiFl6rHYxP2bfsccFJQ";

export default defineConfig({
  testDir: "tests",
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    launchOptions: { executablePath },
    // nine turtles' service worker (public/sw.js) is off in tests, so they can
    // stand in for the server's answers; tests/phone.spec.ts switches it on.
    serviceWorkers: "block",
  },
  projects: (["desktop", "phone"] as const).flatMap((device) => {
    const use = device === "desktop" ? { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } : { ...devices["Pixel 7"] };
    return [
      { name: device, use, testIgnore: "screenshots.spec.ts" },
      {
        name: `screenshots-${device}`,
        use,
        testMatch: "screenshots.spec.ts",
        metadata: { device, feedsApp: `http://127.0.0.1:${SHOTS_PORTS[device]}` },
      },
    ];
  }),
  webServer: [
    {
      command: server,
      env: {
        NINE_TURTLES_LISTEN: `127.0.0.1:${PORT}`,
        NINE_TURTLES_PASSWORD_HASH: TEST_PASSWORD_HASH,
        // A fresh, empty database for every run.
        NINE_TURTLES_DATA_DIR: `test-data/run-${Date.now()}`,
        // Newsletters on, so Settings shows their group (SPEC section 28).
        NINE_TURTLES_NEWSLETTER_SECRET: "a-made-up-newsletter-secret-for-the-browser-tests",
      },
      url: `http://127.0.0.1:${PORT}/`,
      reuseExistingServer: false,
    },
    {
      command: "node tests/feed-server.mjs",
      env: { FEED_SERVER_PORT: String(FEED_SITE_PORT) },
      url: `${FEED_SITE}/`,
      reuseExistingServer: false,
    },
    {
      command: server,
      env: {
        NINE_TURTLES_LISTEN: `127.0.0.1:${FEEDS_PORT}`,
        NINE_TURTLES_PASSWORD_HASH: TEST_PASSWORD_HASH,
        NINE_TURTLES_DATA_DIR: `test-data/feeds-${Date.now()}`,
        // Only here: lets this nine turtles read the made-up publisher on this computer.
        NINE_TURTLES_ALLOW_LOCAL_FEEDS: "yes",
        // Only here, and only together with the line above: checks every feed
        // every two seconds, so a test can watch new articles arrive.
        NINE_TURTLES_TEST_CHECK_SECONDS: "2",
        // Newsletters on here too, for the test that emails one in (tests/app.spec.ts),
        // so the first nine turtles never gets a feed from it.
        NINE_TURTLES_NEWSLETTER_SECRET: "a-made-up-newsletter-secret-for-the-browser-tests",
      },
      url: `${FEEDS_APP}/`,
      reuseExistingServer: false,
    },
    {
      command: "node tests/mail-server.mjs",
      env: { MAIL_SERVER_SMTP_PORT: String(MAIL_SMTP_PORT), MAIL_SERVER_HTTP_PORT: String(MAIL_HTTP_PORT) },
      url: `${MAILBOX}/`,
      reuseExistingServer: false,
    },
    {
      command: server,
      env: {
        NINE_TURTLES_LISTEN: `127.0.0.1:${MAIL_PORT}`,
        NINE_TURTLES_PASSWORD_HASH: TEST_PASSWORD_HASH,
        NINE_TURTLES_DATA_DIR: `test-data/mail-${Date.now()}`,
        NINE_TURTLES_PUBLIC_URL: MAIL_APP,
        // Unencrypted, as nine turtles allows only for a mail server on this computer.
        NINE_TURTLES_SMTP_HOST: "127.0.0.1",
        NINE_TURTLES_SMTP_PORT: String(MAIL_SMTP_PORT),
        NINE_TURTLES_SMTP_USERNAME: "tests",
        NINE_TURTLES_SMTP_PASSWORD: "not a real key",
        NINE_TURTLES_SMTP_FROM: "nine turtles <hello@nineturtles.test>",
      },
      url: `${MAIL_APP}/`,
      reuseExistingServer: false,
    },
    ...Object.entries(SHOTS_PORTS).map(([device, port]) => ({
      command: server,
      env: {
        NINE_TURTLES_LISTEN: `127.0.0.1:${port}`,
        NINE_TURTLES_PASSWORD_HASH: TEST_PASSWORD_HASH,
        NINE_TURTLES_DATA_DIR: `test-data/screenshots-${device}-${Date.now()}`,
        NINE_TURTLES_ALLOW_LOCAL_FEEDS: "yes",
      },
      url: `http://127.0.0.1:${port}/`,
      reuseExistingServer: false,
    })),
  ],
});
