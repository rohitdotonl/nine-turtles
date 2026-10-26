import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// Reading offline (SPEC section 31, decision 0100), "How to check it", done
// by a browser: the copies kept on the device, reading, marking and starring
// without a connection, those marks saved once it's back, what waits for a
// connection, opening the app offline, and signing out deleting the copies.

test.use({ serviceWorkers: "allow" });

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });
const article = (page: Page) => page.getByRole("region", { name: "Article" });
const NEWEST = "On keeping a commonplace book (3)";
const MIDDLE = "Walking the long way home (2)";

/** The articles kept on this device, by number. Never makes the database if it isn't there. */
function keptIds(page: Page): Promise<number[]> {
  return page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const request = indexedDB.open("nine-turtles-offline");
        request.onupgradeneeded = () => request.transaction?.abort();
        request.onerror = () => resolve([]);
        request.onsuccess = () => {
          const db = request.result;
          const keys = db.transaction("articles").objectStore("articles").getAllKeys();
          keys.onsuccess = () => {
            db.close();
            resolve(keys.result.map(Number));
          };
        };
      }),
  );
}

async function onServer(page: Page, id: number): Promise<{ read: boolean; starred: boolean }> {
  const answer = await page.request.get(new URL(`/api/articles/${id}`, FEEDS_APP).href);
  const { read, starred } = (await answer.json()).article;
  return { read, starred };
}

test("articles kept on the device open, mark and star offline, and the marks are saved once back", async ({ page, context, isMobile }) => {
  test.skip(isMobile, "the same on every width");
  const name = `offline-${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const feed = await follow(page, `${FEED_SITE}/blog/${name}/`);
  // Starred, so all three are kept whatever else this test reader has unread.
  const listed = await (await page.request.get(new URL(`/api/articles?feed=${feed}`, FEEDS_APP).href)).json();
  const ids: number[] = listed.articles.map((each: { id: number }) => each.id);
  const [newest, middle] = ids as [number, number];
  await page.request.post(new URL("/api/articles/starred", FEEDS_APP).href, { data: { ids, starred: true } });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Opened under the service worker, which keeps the app; nine turtles keeps the articles.
  await page.goto(new URL(`/feeds/${feed}`, FEEDS_APP).href);
  await appReady(page);
  await expect.poll(() => keptIds(page), { timeout: 20_000 }).toEqual(expect.arrayContaining(ids));

  await context.setOffline(true);
  await sidebar(page).getByRole("link", { name: /^Starred/ }).click();
  await expect(page.getByText("Offline. Showing the articles saved on this device.")).toBeVisible();
  const row = (title: string) => page.getByRole("button", { name: new RegExp(`${title.replace(/[()]/g, "\\$&")}.*Blog ${name}`) });
  await row(NEWEST).click();
  await expect(article(page).getByText("A short made-up summary for article 3.")).toBeVisible();
  // Shown: read, and nothing says it couldn't be saved. The star comes off the next one.
  await expect(row(NEWEST)).not.toHaveAccessibleName(/, unread/);
  await row(MIDDLE).click();
  await page.keyboard.press("s");
  await page.waitForTimeout(500);
  await expect(page.getByText(/couldn't be/)).toHaveCount(0);

  // What needs a connection says so.
  await page.getByRole("button", { name: /^More/ }).first().click();
  await page.getByRole("menuitem", { name: "Refresh" }).click();
  await expect(page.getByText("Refresh needs a connection. This is what's saved on this device.")).toBeVisible();
  await sidebar(page).getByRole("link", { name: "Settings" }).click();
  await expect(page.getByText("Settings need a connection. They open once you're back online.")).toBeVisible();

  // Opened again without a connection: the app and its kept articles are still here.
  await page.goto(new URL("/starred", FEEDS_APP).href);
  await expect(page.getByText("Offline. Showing the articles saved on this device.")).toBeVisible();
  await expect(row(NEWEST)).toBeVisible();
  await expect(row(MIDDLE)).toHaveCount(0);

  // Back online: the waiting marks are sent, and the server has them.
  await context.setOffline(false);
  await page.evaluate(() => dispatchEvent(new Event("online")));
  await expect.poll(() => onServer(page, newest)).toEqual({ read: true, starred: true });
  await expect.poll(() => onServer(page, middle)).toEqual({ read: true, starred: false });

  // Signing out deletes the copies.
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect.poll(() => keptIds(page)).toEqual([]);
});

test("search and adding a feed say plainly that they need a connection", async ({ page, context, isMobile }) => {
  test.skip(isMobile, "the same on every width");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await follow(page, `${FEED_SITE}/blog/offline-search-${test.info().workerIndex}-${Date.now()}/`);
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await context.setOffline(true);
  const search = page.getByRole("combobox", { name: "Search", exact: true });
  await search.fill("letters");
  await search.press("Enter");
  await expect(page.getByText("Search needs a connection. It works again once you're back online.")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  await page.keyboard.press("a");
  const sheet = page.getByRole("dialog", { name: "Add a feed" });
  await sheet.getByLabel("Paste a website or feed URL").fill("https://quiet.example/");
  await sheet.getByRole("button", { name: "Add feed" }).click();
  await expect(page.getByText("Adding a feed needs a connection. Try again once you're back online.")).toBeVisible();
  await context.setOffline(false);
});
