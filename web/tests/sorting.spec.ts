import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, feedsShown, follow, signIn } from "./screens";

// Decision 0263 (SPEC sections 3, 7, 15, 16 and 36): a feed that doesn't say
// who writes it could be either, kept with Publications until the reader
// settles it. The made-up blogs name no writer, so each one followed here
// "as is" could be either. Each run follows blogs of its own.

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });
const yours = (page: Page) => page.getByRole("region", { name: "Everyone you follow" });

/** Signs in and follows a made-up blog of this run's own, left as nine turtles sorted it. */
async function openBlog(page: Page, word: string): Promise<{ id: number; name: string }> {
  const name = `${word}-${test.info().project.name.toLowerCase()}-${test.info().workerIndex}-${Date.now()}`;
  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/`, { asIs: true });
  return { id, name: `Blog ${name}` };
}

test("Everyone you follow lists who could be either; a tick makes them a person at once, and The rest are publications settles the others", async ({ page, isMobile }) => {
  const blog = await openBlog(page, "either");
  await page.goto(new URL("/settings/feeds", FEEDS_APP).href);
  await appReady(page);
  const group = yours(page).getByRole("group", { name: /could be either$/ });
  await expect(group).toHaveAccessibleDescription(/^Their feeds don't say who writes them\./);
  const tick = group.getByRole("checkbox", { name: blog.name });
  await expect(tick).not.toBeChecked();
  // Listed only here, not under Publications too.
  await expect(yours(page).getByRole("link", { name: new RegExp(`^${blog.name}`) })).toHaveCount(0);

  // Ticked: a person at once, still in the list, and under People below.
  await tick.focus();
  await page.keyboard.press("Space");
  await expect(tick).toBeChecked();
  await expect(yours(page).getByRole("link", { name: new RegExp(`^${blog.name}`) })).toBeVisible();
  // Under People, which says how it sorts.
  await expect(yours(page).getByText("Filed here when one name signs everything they write, or the site is their own.")).toBeVisible();
  if (!isMobile) {
    const people = sidebar(page).getByRole("heading", { name: "People", level: 2 }).locator("xpath=..");
    await expect(people.getByRole("link", { name: new RegExp(`^${blog.name}`) })).toBeVisible();
  }
  const listed = await (await page.request.get(new URL("/api/feeds", FEEDS_APP).href)).json();
  const feed = listed.feeds.find((each: { id: number }) => each.id === blog.id);
  expect([feed.kind, feed.why, feed.open]).toEqual(["person", "reader", false]);

  // Unticked: it could be either again.
  await page.keyboard.press("Space");
  await expect(tick).not.toBeChecked();
  await expect(yours(page).getByRole("link", { name: new RegExp(`^${blog.name}`) })).toHaveCount(0);

  // The rest are publications (once: the phone run checks the ticks alone, as both share one reader).
  if (isMobile) return;
  await yours(page).getByRole("button", { name: "The rest are publications" }).click();
  await expect(page.getByRole("status").filter({ hasText: /publications? now\.$/ })).toBeVisible();
  await expect(yours(page).getByRole("link", { name: new RegExp(`^${blog.name}`) })).toBeVisible();
  await expect(yours(page).getByRole("button", { name: "Undo" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(yours(page).getByRole("group", { name: /could be either$/ }).getByRole("checkbox", { name: blog.name })).not.toBeChecked();
});

test("their page says why, and with neither chosen one press settles it", async ({ page }) => {
  const blog = await openBlog(page, "page");
  await page.goto(new URL(`/publications/${blog.id}/about`, FEEDS_APP).href);
  await appReady(page);
  const choice = page.getByRole("radiogroup", { name: "This is" });
  await expect(choice).toHaveAccessibleDescription(/^nine turtles couldn't tell: no name signs their articles\./);
  await expect(choice.getByRole("radio", { checked: true })).toHaveCount(0);
  // A publication, chosen on purpose: the reader's choice now.
  await choice.getByRole("radio", { name: "A publication" }).check();
  await expect(choice).toHaveAccessibleDescription("Your choice.");
  await expect(choice.getByRole("radio", { name: "A publication" })).toBeChecked();
});

test("Add leaves both tiles unchosen when it can't tell, and Done leaves them with Publications", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same question; the phone run covers the list above");
  await page.goto(new URL("/add", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const name = `add-either-${test.info().workerIndex}-${Date.now()}`;
  await page.getByLabel("Their website's address").fill(`${FEED_SITE}/blog/${name}/`);
  await page.keyboard.press("Enter");
  await expect(page.getByText(/^nine turtles couldn't tell from their feed\. Left as it is, they're kept with Publications\./)).toBeVisible();
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Done" }).click();
  const listed = await (await page.request.get(new URL("/api/feeds", FEEDS_APP).href)).json();
  const feed = listed.feeds.find((each: { title: string }) => each.title === `Blog ${name}`);
  expect([feed.kind, feed.open]).toEqual(["publication", true]);
});

test("the end of their article asks once; Yes puts Write back in its place, with Undo", async ({ page }) => {
  const blog = await openBlog(page, "ask");
  await page.goto(new URL(`/publications/${blog.id}`, FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("region", { name: blog.name }).getByRole("listitem").first().click();
  const asked = page.getByRole("group", { name: `Is ${blog.name} someone you might write back to?` });
  await asked.scrollIntoViewIfNeeded();
  await expect(asked).toBeVisible();
  await asked.getByRole("button", { name: "Yes, a person" }).click();
  await expect(asked).toHaveCount(0);
  await expect(page.getByRole("button", { name: `Write back to ${blog.name}` })).toBeFocused();
  await expect(page.getByRole("status").filter({ hasText: `${blog.name} is a person now.` })).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).last().click();
  await expect(page.getByRole("group", { name: `Is ${blog.name} someone you might write back to?` })).toBeVisible();
});

test("an import's closing line says how it was sorted; Look them over opens Everyone you follow and ends it", async ({ page, isMobile }) => {
  test.skip(isMobile, "the phone shows the same list");
  await page.goto(new URL("/unread", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  // Answered here, so nothing shared changes: the import finished, every feed checked.
  let closed = false;
  await feedsShown(page, "**/api/feeds", (body) => {
    body.import_note = closed ? null : { people: 1, publications: 0, open: 3 };
    for (const feed of body.feeds) feed.waiting = false;
  });
  await page.route("**/api/opml/note/close", (route) => ((closed = true), route.fulfill({ status: 204 })));
  await page.reload();
  await appReady(page);
  const list = page.getByRole("region", { name: "Unread" });
  await expect(list.getByRole("status").filter({ hasText: "Your list is in: 1 person. 3 could be either." })).toBeVisible();
  await list.getByRole("button", { name: "Look them over" }).click();
  await expect(page).toHaveURL(/\/settings\/feeds$/);
  expect(closed).toBe(true);
  await page.goto(new URL("/unread", FEEDS_APP).href);
  await appReady(page);
  await expect(page.getByText(/^Your list is in:/)).toHaveCount(0);
});
