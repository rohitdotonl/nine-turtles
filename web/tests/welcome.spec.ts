import { expect, test, type Page } from "@playwright/test";
import { appReady, signIn } from "./screens";

// The welcome's "Or try one" and the newsletter that only comes by email (SPEC
// sections 2 and 3, decision 0198). nine turtles is made to answer for the sites,
// so these tests never reach the internet and this fresh nine turtles stays empty.

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });

async function fresh(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/unread");
  await appReady(page);
  await signIn(page);
}

test("pressing an example follows it, shows their newest post in the welcome, and Start reading goes in", async ({ page }) => {
  await fresh(page);
  const followed: { id: number; title: string; site_url: null; unread: number; folders: number[] }[] = [];
  const asked: string[] = [];
  await page.route("**/api/feeds", async (route) => {
    if (route.request().method() === "POST") {
      asked.push((route.request().postDataJSON() as { address: string }).address);
      const feed = { id: 9100, title: "Rohit Kumar", site_url: null, unread: 1, folders: [], latest: "One hour" };
      followed.push(feed);
      return route.fulfill({ status: 201, json: { feed } });
    }
    if (followed.length === 0) return route.fallback();
    return route.fulfill({ json: { feeds: followed, folders: [] } });
  });
  const welcome = page.getByRole("region", { name: "Hello. Who would you like to read?" });
  const examples = welcome.getByRole("region", { name: "Or try one" });
  await expect(examples.getByRole("button")).toHaveCount(3);
  for (const row of await examples.getByRole("button").all()) expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await examples.getByRole("button", { name: /www\.rohit\.onl/ }).click();
  expect(asked).toEqual(["www.rohit.onl"]);
  // The welcome stays, with their newest post, the other two examples, and the person in the sidebar.
  const post = welcome.getByRole("article", { name: "Newest from Rohit Kumar" });
  await expect(post.getByRole("link", { name: "One hour" })).toBeVisible();
  await expect(post).toContainText("You're following Rohit Kumar.");
  await expect(welcome.getByRole("region", { name: "Try another" }).getByRole("button")).toHaveCount(2);
  await expect(sidebar(page).getByRole("link", { name: /Rohit Kumar/ })).toBeVisible();
  // Add stays the one main button; Start reading takes the reader in, and the welcome is gone.
  await welcome.getByRole("link", { name: "Start reading" }).click();
  await expect(page).toHaveURL(/\/unread$/);
  await expect(page.locator("#welcome-heading")).toHaveCount(0);
});

test("a site with no feed offers the reader's own newsletter address instead of a dead end", async ({ page }) => {
  await fresh(page);
  await page.route("**/api/feeds", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    return route.fulfill({ status: 422, json: { error: "no-feed" } });
  });
  await page.route("**/api/newsletters", (route) => route.fulfill({ json: { on: true, address: "turtle-test@in.example.com", labels: [] } }));
  await page.getByLabel("Their website's address").fill("letters.example.com");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "couldn't find a way to follow this site" })).toBeVisible();
  const byEmail = page.getByRole("region", { name: "If it's a newsletter" });
  await expect(byEmail.getByRole("textbox", { name: "Your nine turtles address" })).toHaveValue("turtle-test@in.example.com");
  await expect(byEmail.getByRole("button", { name: "Copy address" })).toBeVisible();
  const site = byEmail.getByRole("link", { name: /Open their site to sign up/ });
  await expect(site).toHaveAttribute("href", "https://letters.example.com");
  await expect(site).toHaveAttribute("target", "_blank");
});
