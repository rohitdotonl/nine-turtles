import { defineConfig, devices } from "@playwright/test";

// Node's own type descriptions are a separate library; this one line is all we need.
declare const process: { env: Record<string, string | undefined> };

// Browser tests run against the real slowfeed program (built by
// scripts/check.sh), not a development server, so they test what ships.
const PORT = 4318;
// A second slowfeed for the tests that add feeds, so the first one stays
// empty for the first-visit screens, and a made-up publisher for it to read.
const FEEDS_PORT = 4320;
const FEED_SITE_PORT = 4319;
export const FEEDS_APP = `http://127.0.0.1:${FEEDS_PORT}`;
export const FEED_SITE = `http://127.0.0.1:${FEED_SITE_PORT}`;
const server = process.env.SLOWFEED_BINARY ?? "../server/target/release/slowfeed";
// Lets a computer with its own copy of Chromium use it instead of downloading one.
const executablePath = process.env.SLOWFEED_CHROMIUM || undefined;
// The browser tests sign in with this made-up password. The line below is its
// scrambled form, made with `slowfeed set-password`; it protects nothing real.
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
    // slowfeed's service worker (public/sw.js) is off in tests, so they can
    // stand in for the server's answers; tests/phone.spec.ts switches it on.
    serviceWorkers: "block",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: server,
      env: {
        SLOWFEED_LISTEN: `127.0.0.1:${PORT}`,
        SLOWFEED_PASSWORD_HASH: TEST_PASSWORD_HASH,
        // A fresh, empty database for every run.
        SLOWFEED_DATA_DIR: `test-data/run-${Date.now()}`,
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
        SLOWFEED_LISTEN: `127.0.0.1:${FEEDS_PORT}`,
        SLOWFEED_PASSWORD_HASH: TEST_PASSWORD_HASH,
        SLOWFEED_DATA_DIR: `test-data/feeds-${Date.now()}`,
        // Only here: lets this slowfeed read the made-up publisher on this computer.
        SLOWFEED_ALLOW_LOCAL_FEEDS: "yes",
        // Only here, and only together with the line above: checks every feed
        // every two seconds, so a test can watch new articles arrive.
        SLOWFEED_TEST_CHECK_SECONDS: "2",
      },
      url: `${FEEDS_APP}/`,
      reuseExistingServer: false,
    },
  ],
});
