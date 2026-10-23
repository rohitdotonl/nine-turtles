import { defineConfig, devices } from "@playwright/test";

// Node's own type descriptions are a separate library; this one line is all we need.
declare const process: { env: Record<string, string | undefined> };

// Browser tests run against the real slowfeed program (built by
// scripts/check.sh), not a development server, so they test what ships.
const PORT = 4318;
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
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
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
});
