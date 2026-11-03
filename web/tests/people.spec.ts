import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// SPEC section 36 (people and publications), "How to check it", done by a
// browser: the page opened by the name at the top of the list, Edit and Done,
// person or publication, "+ Add a source" with its folder question, a
// source's own settings with "Take out of …", Unsubscribe from a person, each
// Undo, and the keyboard's way through them. Each test uses blogs of its own,
// since every test shares the one nine turtles that has feeds.

const sidebar = (page: Page) =>
  page.getByRole("navigation", { name: "Sidebar" });
/** Their page or its Edit, beside the list: "About Alpha" or "Edit Alpha" to screen readers, never the list's own name. */
const page_ = (page: Page, name: string) =>
  page.getByRole("region", { name: new RegExp(`^(About|Edit) ${name}$`) });
const line = (page: Page) =>
  page.getByRole("status").filter({ hasText: /\S/ }).first();
const rowsNamed = (page: Page, name: string) =>
  sidebar(page).getByRole("link", { name: new RegExp(`^${name}`) });

test.skip(
  ({ isMobile }) => isMobile,
  "the page stands in the wide window's reading area",
);
// Joining and its Undo change the sidebar the other tests read.
test.describe.configure({ mode: "serial" });

function unique(prefix: string): string {
  return `${prefix}-${test.info().workerIndex}-${Date.now()}`;
}

/** Signs in, follows each address under the test site, and opens the first one's list. */
async function openPlaces(
  page: Page,
  paths: string[],
  { signedIn = false } = {},
): Promise<number[]> {
  if (!signedIn) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(new URL("/all", FEEDS_APP).href);
    await appReady(page);
    await signIn(page);
  }
  const ids = [];
  for (const path of paths) ids.push(await follow(page, `${FEED_SITE}${path}`));
  // The old address, which still opens (and is tidied to the new one).
  await page.goto(new URL(`/feeds/${ids[0]}`, FEEDS_APP).href);
  await appReady(page);
  return ids;
}

test("the name opens their page beside the list, with only the keyboard; Edit, Done and Escape turn it back", async ({
  page,
}) => {
  const ana = unique("pp-ana");
  const [id] = await openPlaces(page, [`/blog/${ana}/feed.xml`]);
  // An old address is tidied to the new one, and the reading area keeps its quiet line.
  await expect(page).toHaveURL(new RegExp(`/people/${id}$`));
  await expect(
    page.getByText("Time to read something beautiful."),
  ).toBeVisible();

  const name = page
    .locator("#list-heading")
    .getByRole("button", { name: `Blog ${ana}` });
  await name.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/people/${id}/about$`));
  const about = page_(page, `Blog ${ana}`);
  await expect(
    about.getByRole("heading", { level: 2, name: `Blog ${ana}` }),
  ).toBeFocused();
  await expect(about).toContainText("A person");
  await expect(
    about.getByRole("link", { name: `${ana}.example` }),
  ).toBeVisible();
  // The list stays beside it.
  await expect(page.locator(".item-row")).toHaveCount(3);

  await about.getByRole("button", { name: `Edit Blog ${ana}` }).click();
  await expect(page).toHaveURL(new RegExp(`/people/${id}/edit$`));
  await expect(
    page.getByRole("heading", { level: 2, name: `Edit Blog ${ana}` }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(new RegExp(`/people/${id}/about$`));
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(new RegExp(`/people/${id}$`));

  // The i key, and "About …" in More, open it too.
  await page.locator("body").focus();
  await page.keyboard.press("i");
  await expect(page).toHaveURL(new RegExp(`/people/${id}/about$`));
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("menuitem", { name: `About Blog ${ana}` }).click();
  await expect(page).toHaveURL(new RegExp(`/people/${id}/about$`));
});

test("Edit makes someone a publication: listed under Publications, at its own address", async ({
  page,
}) => {
  const ben = unique("pp-ben");
  const [id] = await openPlaces(page, [`/blog/${ben}/feed.xml`]);
  await page.goto(new URL(`/people/${id}/edit`, FEEDS_APP).href);
  await appReady(page);
  await page.getByRole("radio", { name: "A publication" }).check();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page).toHaveURL(new RegExp(`/publications/${id}/about$`));
  await expect(page_(page, `Blog ${ben}`)).toContainText("A publication");
  const publications = sidebar(page).getByRole("heading", {
    name: "Publications",
  });
  await expect(publications).toBeVisible();
  // Its row sits under Publications, after that heading.
  const list = publications.locator("xpath=following-sibling::ul[1]");
  await expect(
    list.getByRole("link", { name: new RegExp(`^Blog ${ben}`) }),
  ).toHaveCount(1);
});

test("+ Add a source joins someone in another folder, asking which folders, and Undo parts them again", async ({
  page,
}) => {
  const cara = unique("pp-cara");
  const dov = unique("pp-dov");
  const ids = await openPlaces(page, [
    `/blog/${cara}/feed.xml`,
    `/blog/${dov}/feed.xml`,
  ]);
  for (const [index, id] of ids.entries()) {
    const made = await page.request.post(
      new URL("/api/folders", FEEDS_APP).href,
      { data: { name: unique(`Pp-f${index}`), feeds: [id] } },
    );
    expect(made.ok()).toBe(true);
  }
  await page.goto(new URL(`/people/${ids[0]}/edit`, FEEDS_APP).href);
  await appReady(page);

  const add = page.getByRole("button", { name: "Add a source" });
  await add.click();
  const who = page.getByRole("combobox", {
    name: "Someone you already follow",
  });
  await expect(who).toBeFocused();
  await who.selectOption({ label: `Blog ${dov}` });
  await page.getByRole("button", { name: "Join", exact: true }).click();
  // In different folders: which should they be in? Both, ticked to start.
  await expect(
    page.getByText(`Which folders should Blog ${cara} be in?`),
  ).toBeVisible();
  const folders = page
    .getByRole("group", { name: /Which folders/ })
    .getByRole("checkbox");
  await expect(folders).toHaveCount(2);
  await expect(folders.first()).toBeFocused();
  for (const each of await folders.all()) await expect(each).toBeChecked();
  await page.getByRole("button", { name: "Join", exact: true }).click();

  await expect(line(page)).toContainText(`Blog ${cara} is one person now`);
  await expect(
    page.locator(".item-row").filter({ hasText: "Blog" }),
  ).toHaveCount(6);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(line(page)).toHaveText("Undone.");
  // Each on their own again, each in their own folder (shut in the sidebar, so asked of the server).
  const placesNow = async () => {
    const back = await (
      await page.request.get(new URL("/api/feeds", FEEDS_APP).href)
    ).json();
    return (
      back.feeds as { id: number; person: number | null; folders: number[] }[]
    )
      .filter((feed) => ids.includes(feed.id))
      .map((feed) => [feed.person, feed.folders.length]);
  };
  await expect.poll(placesNow).toEqual([
    [null, 1],
    [null, 1],
  ]);
});

test("a source's own settings: Take out of the person, and Undo puts it back", async ({
  page,
}) => {
  const eli = unique("pp-eli");
  const fay = unique("pp-fay");
  const [first, second] = await openPlaces(page, [
    `/blog/${eli}/feed.xml`,
    `/blog/${fay}/feed.xml`,
  ]);
  const joined = await page.request.post(
    new URL("/api/writers/join", FEEDS_APP).href,
    { data: { feeds: [first, second], name: `Eli ${eli}` } },
  );
  expect(joined.ok()).toBe(true);
  await page.goto(new URL(`/people/${first}/edit`, FEEDS_APP).href);
  await appReady(page);

  await page
    .getByRole("button", {
      name: new RegExp(`${fay}\\.example\\s?: its settings$`),
    })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/people/${first}/sources/${second}$`),
  );
  await expect(
    page.getByRole("combobox", { name: "Kind of source" }),
  ).toHaveValue("blog");
  await page.getByRole("button", { name: `Take out of Eli ${eli}` }).click();
  await expect(line(page)).toHaveText(`${fay}.example is on its own now`);
  await expect(rowsNamed(page, `Blog ${fay}`)).toHaveCount(1);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(line(page)).toHaveText("Undone.");
  await expect(rowsNamed(page, `Blog ${fay}`)).toHaveCount(0);
  await expect(rowsNamed(page, `Eli ${eli}`)).toHaveCount(1);
});

test("Unsubscribe from a person leaves every source, and Undo brings them all back", async ({
  page,
}) => {
  const gus = unique("pp-gus");
  const ida = unique("pp-ida");
  const [first, second] = await openPlaces(page, [
    `/blog/${gus}/feed.xml`,
    `/blog/${ida}/feed.xml`,
  ]);
  await page.request.post(new URL("/api/writers/join", FEEDS_APP).href, {
    data: { feeds: [first, second], name: `Gus ${gus}` },
  });
  await page.goto(new URL(`/people/${first}/edit`, FEEDS_APP).href);
  await appReady(page);
  await page
    .getByRole("button", { name: `Unsubscribe from Gus ${gus}` })
    .click();
  await expect(line(page)).toContainText(`Unsubscribed from Gus ${gus}`);
  await expect(rowsNamed(page, `Gus ${gus}`)).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(rowsNamed(page, `Gus ${gus}`)).toHaveCount(1);
});

test("This is one person: a folder becomes one row named as it, and Undo brings the folder back", async ({
  page,
}) => {
  const gil = unique("pp-gil");
  const hal = unique("pp-hal");
  const folder = unique("Pp-folder");
  const ids = await openPlaces(page, [
    `/blog/${gil}/feed.xml`,
    `/blog/${hal}/feed.xml`,
  ]);
  const made = await page.request.post(
    new URL("/api/folders", FEEDS_APP).href,
    { data: { name: folder, feeds: ids } },
  );
  expect(made.ok()).toBe(true);
  const id = (await made.json()).folder.id as number;
  await page.goto(new URL(`/folders/${id}`, FEEDS_APP).href);
  await appReady(page);

  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("menuitem", { name: "Edit folder" }).click();
  // Renamed and made one person in the same Save: the person takes the new name.
  await page.getByRole("textbox", { name: "Name" }).fill(`Hal ${hal}`);
  const tick = page.getByRole("checkbox", { name: "This is one person" });
  await tick.focus();
  await page.keyboard.press("Space");
  await expect(tick).toBeChecked();
  await page.getByRole("button", { name: "Save" }).click();

  await expect(line(page)).toContainText(`Hal ${hal} is one person now`);
  await expect(rowsNamed(page, `Hal ${hal}`)).toHaveCount(1);
  await expect(rowsNamed(page, `Blog ${gil}`)).toHaveCount(0);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(line(page)).toHaveText("Undone.");
  // Each place on its own again, back in the folder, which has the name it was given.
  await expect(rowsNamed(page, `Hal ${hal}`)).toHaveCount(1);
  // Asked of the server until it's all back (the folder and each place's place in it).
  const placesNow = async () => {
    const back = await (
      await page.request.get(new URL("/api/feeds", FEEDS_APP).href)
    ).json();
    return (
      back.feeds as { id: number; person: number | null; folders: number[] }[]
    )
      .filter((feed) => ids.includes(feed.id))
      .map((feed) => [feed.person, feed.folders.length]);
  };
  await expect.poll(placesNow).toEqual([
    [null, 1],
    [null, 1],
  ]);
});

test("+ Add a source with a site's address that offers several feeds shows the choices first, then follows and joins the one chosen", async ({
  page,
}) => {
  const jo = unique("pp-jo");
  const kit = unique("two-pp-kit");
  const [id] = await openPlaces(page, [`/blog/${jo}/feed.xml`]);
  await page.goto(new URL(`/people/${id}/edit`, FEEDS_APP).href);
  await appReady(page);

  await page.getByRole("button", { name: "Add a source" }).click();
  await page
    .getByRole("textbox", {
      name: /address of their blog, channel or newsletter/,
    })
    .fill(`${FEED_SITE}/blog/${kit}/`);
  await page.getByRole("button", { name: "Follow and join" }).click();
  const choices = page.getByRole("radiogroup", { name: "Which one to follow" });
  const first = choices.getByRole("radio").first();
  await expect(first).toBeChecked();
  await expect(first).toBeFocused();
  await expect(choices.getByRole("radio", { name: /^Comments/ })).toHaveCount(
    1,
  );
  await page.getByRole("button", { name: "Follow and join" }).click();

  await expect(line(page)).toContainText(`Blog ${jo} is one person now`);
  await expect(rowsNamed(page, `Blog ${kit}`)).toHaveCount(0);
});
