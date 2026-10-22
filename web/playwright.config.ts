import { defineConfig, devices } from "@playwright/test";

// Node's own type descriptions are a separate library; this one line is all we need.
declare const process: { env: Record<string, string | undefined> };

// Browser tests run against the real slowfeed program (built by
// scripts/check.sh), not a development server, so they test what ships.
const PORT = 4318;
const server = process.env.SLOWFEED_BINARY ?? "../server/target/release/slowfeed";
// Lets a computer with its own copy of Chromium use it instead of downloading one.
const executablePath = process.env.SLOWFEED_CHROMIUM || undefined;

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
    env: { SLOWFEED_LISTEN: `127.0.0.1:${PORT}` },
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
  },
});
