import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// Swipes on a touch screen (SPEC section 20, decision 0274), made with real
// touches, so the browser's own scrolling has its say as it would on a phone.

test.skip(({ isMobile }) => !isMobile, "a phone's swipes");

const pane = (page: Page) => page.getByRole("region", { name: "Article", exact: true });
const rows = (page: Page) => page.locator(".item-row");
const note = (page: Page) => page.getByRole("status").filter({ hasText: /^(Marked as|Saved|Removed from Saved)/ });

/** A finger on the screen: put down, moved in a few steps, and lifted. */
class Finger {
  private constructor(
    private page: Page,
    private cdp: CDPSession,
    private at: { x: number; y: number },
  ) {}
  static async down(page: Page, x: number, y: number): Promise<Finger> {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    return new Finger(page, cdp, { x, y });
  }
  /** Moves in `steps` steps, `pause` milliseconds apart: slowly enough, and it's a drag rather than a flick. */
  async move(dx: number, dy = 0, pause = 40, steps = 6) {
    const from = this.at;
    for (let step = 1; step <= steps; step++) {
      await this.page.waitForTimeout(pause);
      this.at = { x: from.x + (dx * step) / steps, y: from.y + (dy * step) / steps };
      await this.cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [this.at] });
    }
  }
  async up() {
    await this.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await this.cdp.detach();
  }
}

/** Swipes the element sideways by `dx`, starting at its middle (or `startX`); a `pause` of 0 flicks. */
async function swipe(page: Page, element: ReturnType<Page["locator"]>, dx: number, startX?: number, pause?: number) {
  const box = (await element.boundingBox())!;
  const finger = await Finger.down(page, startX ?? box.x + box.width / 2, box.y + box.height / 2);
  await finger.move(dx, 0, pause, pause === 0 ? 2 : 6);
  await finger.up();
}

async function openBlog(page: Page): Promise<void> {
  const name = `sw-${test.info().workerIndex}-${Date.now()}`;
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);
  await page.goto(new URL(`/${id}`, FEEDS_APP).href);
  await appReady(page);
  await expect(rows(page)).toHaveCount(3);
}

const card = (page: Page) => page.locator(".swipe-card");
/** Marks the element `data-glided="yes"` if a glide is ever set on it. */
const watchGlide = (element: ReturnType<Page["locator"]>) =>
  element.evaluate((node: HTMLElement) => {
    // A glide shows in the row's style as its length ("320ms").
    new MutationObserver(() => /\dms\b/.test(node.getAttribute("style") ?? "") && (node.dataset.glided = "yes")).observe(node, { attributeFilter: ["style"] });
  });
/** The article a pull would open, hung past the end (or top) of the one being read. */
const peek = (page: Page) => page.locator(".swipe-peek");
/** What it says: where, the article's title, and who wrote it (the made-up blogs name no writer, so their feed's name). */
const named = (where: string, title = "") => new RegExp(`^\\s*${where}\\s*${title.replace(/[()]/g, "\\$&")}\\s*Blog sw-[\\d-]+\\s*$`);
/** Marks the element with where it was first moved to (`data-slid`), until it's watched again. */
const watchSlide = (element: ReturnType<Page["locator"]>) =>
  element.evaluate((node: HTMLElement) => {
    delete node.dataset.slid;
    // Each change's style before it, then as it is now: the first that moved it.
    const watch = new MutationObserver((changes) => {
      const seen = [...changes.map((change) => change.oldValue ?? ""), node.getAttribute("style") ?? ""];
      const first = seen.map((style) => /transform: ([^;]+)/.exec(style)?.[1]).find((moved) => moved && moved !== "none");
      if (!first) return;
      node.dataset.slid = first;
      watch.disconnect();
    });
    watch.observe(node, { attributeFilter: ["style"], attributeOldValue: true });
  });
/** Once a stroke's glide is over, nothing is left moved. */
const settled = (screen: ReturnType<Page["locator"]>) => expect.poll(() => screen.evaluate((node: HTMLElement) => node.style.transform)).toBe("");
const home = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });

test("a row swiped left a little is marked read, with Undo; all the way, starred; nothing opens", async ({ page }) => {
  await openBlog(page);
  const first = rows(page).nth(0);
  await expect(first.locator(".unread-dot")).toBeVisible();

  // Part of the way, the room it opens names what letting go does; the row follows the finger.
  const box = (await first.boundingBox())!;
  await watchGlide(first);
  const finger = await Finger.down(page, box.x + box.width - 60, box.y + box.height / 2);
  await finger.move(-60);
  await expect(page.locator(".row-swipe")).toHaveText("Read");
  await expect(page.locator(".row-swipe")).not.toHaveAttribute("data-armed");
  await finger.move(-80);
  await expect(page.locator(".row-swipe")).toHaveAttribute("data-armed", "");
  await expect.poll(() => first.evaluate((row) => row.style.transform)).toBe("translateX(-140px)");
  await finger.up();
  // It springs back, with nothing left beside it, and the article isn't opened.
  await expect(first).toHaveAttribute("data-glided", "yes");
  await expect(page.locator(".row-swipe")).toHaveCount(0);
  await settled(first);
  await expect(first.locator(".unread-dot")).toHaveCount(0);
  await expect(note(page)).toHaveText(/Marked as read/);
  await expect(pane(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(first.locator(".unread-dot")).toBeVisible();

  // All the way: the word changes to Save, and letting go saves it (and leaves it unread).
  const second = rows(page).nth(1);
  const at = (await second.boundingBox())!;
  const far = await Finger.down(page, at.x + at.width - 30, at.y + at.height / 2);
  await far.move(-300);
  await expect(page.locator(".row-swipe")).toHaveText("Save");
  await far.up();
  await expect(second.locator(".row-saved")).toBeVisible();
  await expect(second.locator(".unread-dot")).toBeVisible();
  await expect(note(page)).toHaveText(/^Saved/);
  await expect(pane(page)).toHaveCount(0);

  // A phone set to reduce motion: no glide, it's back at once.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const third = rows(page).nth(2);
  await watchGlide(third);
  await swipe(page, third, -140, (await third.boundingBox())!.width - 30);
  await expect(page.locator(".row-swipe")).toHaveCount(0);
  await settled(third);
  await expect(third).not.toHaveAttribute("data-glided", "yes");
});

test("a short swipe, or an up-and-down stroke, changes nothing; swiped right, a list goes back home", async ({ page }) => {
  await openBlog(page);
  const first = rows(page).nth(0);
  await swipe(page, first, -50);
  await swipe(page, first, 50);
  const box = (await first.boundingBox())!;
  const finger = await Finger.down(page, box.x + 150, box.y + box.height / 2);
  await finger.move(-30, -120);
  await finger.up();
  await expect(first.locator(".unread-dot")).toBeVisible();
  await expect(first.locator(".row-saved")).toHaveCount(0);
  await expect(page.locator(".row-swipe")).toHaveCount(0);
  await expect(home(page)).toBeHidden();

  // A quick flick counts, however short, as on every phone: the first of a row's swipes.
  await swipe(page, first, -50, undefined, 0);
  await expect(first.locator(".unread-dot")).toHaveCount(0);

  // Swiped right from the middle of a row, the list follows the finger with Home behind it; letting go goes there, as ‹ Home does.
  const list = page.locator("#list-pane");
  const back = await Finger.down(page, box.x + 60, box.y + box.height / 2);
  await back.move(160);
  await expect.poll(() => list.evaluate((node) => node.style.transform)).toBe("translateX(160px)");
  await expect(home(page)).toBeVisible();
  await expect(card(page)).toHaveCount(0);
  await back.up();
  await expect(list).toBeHidden();
  await expect(home(page)).toBeVisible();
  // Home has no back: a swipe there does nothing.
  await swipe(page, home(page), 200, 60);
  await expect(home(page)).toBeVisible();
});

test("in an article, a pull past its end opens the next one and past its top the previous one: the article follows the finger with the next hung beyond, and letting go carries on; a flick counts; a swipe left does nothing; a swipe right goes back", async ({ page }) => {
  await openBlog(page);
  const titles = (await rows(page).locator(".title").allTextContents()).map((title) => title.replace(/, unread$/, "").trim());
  await rows(page).nth(0).click();
  const heading = (name: string | undefined) => pane(page).getByRole("heading", { level: 2, name });
  await expect(heading(titles[0])).toBeVisible();
  const text = pane(page).locator(".reading-scroller");
  const box = (await text.boundingBox())!;
  const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  // The browser's own pull to refresh never takes a pull, nor does the phone's own stretch at the article's ends.
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY)).toBe("none");
  expect(await text.evaluate((area) => getComputedStyle(area).overscrollBehaviorY)).toBe("none");

  // Sideways is only for going back: swiped left, the article stays as it is.
  const left = await Finger.down(page, middle.x + 100, middle.y);
  await left.move(-160);
  await expect(peek(page)).toHaveCount(0);
  expect(await pane(page).evaluate((node) => node.style.transform)).toBe("");
  await left.up();
  await expect(heading(titles[0])).toBeVisible();

  // Pulled up past its end, the article follows the finger and the next one comes into view below it, named;
  // far enough, it says to let go; moving back takes it all away, and nothing opens.
  await text.evaluate((area) => (area.scrollTop = area.scrollHeight));
  const back = await Finger.down(page, middle.x, box.y + box.height - 60);
  await back.move(0, -60);
  await expect(peek(page)).toHaveText(named("Next", titles[1]));
  await expect.poll(() => pane(page).evaluate((node) => node.style.transform)).toBe("translateY(-60px)");
  await back.move(0, -140);
  await expect(peek(page)).toHaveText(named("Let go for the next", titles[1]));
  await back.move(0, 200);
  await expect(peek(page)).toHaveCount(0);
  await back.up();
  await settled(pane(page));
  await expect(heading(titles[0])).toBeVisible();
  // A short, slow pull let go slides back.
  const short = await Finger.down(page, middle.x, box.y + box.height - 60);
  await short.move(0, -60);
  await short.up();
  await settled(pane(page));
  await expect(heading(titles[0])).toBeVisible();
  // Far enough, letting go carries the article on up and opens the next.
  await watchSlide(pane(page));
  const up = await Finger.down(page, middle.x, box.y + box.height - 60);
  await up.move(0, -200);
  await up.up();
  await expect(heading(titles[1])).toBeVisible();
  await expect(pane(page)).toHaveAttribute("data-slid", /^translateY\(-/);
  await settled(pane(page));

  // Pulled down past its top: the previous one, hung above, coming down with the finger.
  await watchSlide(pane(page));
  const down = await Finger.down(page, middle.x, box.y + 80);
  await down.move(0, 200);
  await expect(peek(page)).toHaveText(named("Let go for the previous", titles[0]));
  await down.up();
  await expect(heading(titles[0])).toBeVisible();
  await expect(pane(page)).toHaveAttribute("data-slid", /^translateY\(\d/);
  await settled(pane(page));
  // Nothing before the first: it says so, and letting go stays.
  const none = await Finger.down(page, middle.x, box.y + 80);
  await none.move(0, 200);
  await expect(peek(page)).toHaveText("That's the first article here.");
  await none.up();
  await settled(pane(page));
  await expect(heading(titles[0])).toBeVisible();

  // A quick flick up past the end counts, short as it is.
  await text.evaluate((area) => (area.scrollTop = area.scrollHeight));
  const flick = await Finger.down(page, middle.x, box.y + box.height - 60);
  await flick.move(0, -60, 0, 2);
  await flick.up();
  await expect(heading(titles[1])).toBeVisible();
  await settled(pane(page));

  // Swiped right: back to the list, as its back button says.
  await swipe(page, text, 160, middle.x - 100);
  await expect(pane(page)).toBeHidden();
  await expect(rows(page).first()).toBeVisible();
});

test("with Write back's ways or the Aa sheet open, the stroke that closes it neither opens the next article nor goes back", async ({ page }) => {
  const name = `sw-${test.info().workerIndex}-${Date.now()}`;
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);
  expect((await page.request.post(new URL(`/api/feeds/${id}`, FEEDS_APP).href, { data: { kind: "person" } })).ok()).toBe(true);
  await page.goto(new URL(`/${id}`, FEEDS_APP).href);
  await appReady(page);
  await rows(page).nth(0).click();
  const heading = pane(page).getByRole("heading", { level: 2 });
  const title = await heading.textContent();
  const text = pane(page).locator(".reading-scroller");
  await text.evaluate((area) => (area.scrollTop = area.scrollHeight));
  await pane(page).getByRole("button", { name: /^Other ways to reply/ }).click();
  const ways = pane(page).getByRole("menu");
  await expect(ways).toBeVisible();
  const box = (await text.boundingBox())!;
  // Above the bottom bar, every row is in view (upwards when there's no room under the arrow).
  const menuBox = (await ways.boundingBox())!;
  expect(menuBox.y).toBeGreaterThanOrEqual(box.y);
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(box.y + box.height);
  const stroke = await Finger.down(page, box.x + 30, box.y + 40);
  await stroke.move(0, -200);
  await expect(peek(page)).toHaveCount(0);
  await stroke.up();
  // The touch landed outside the menu, so it closed it, and that's all.
  await expect(ways).toHaveCount(0);
  await expect(heading).toHaveText(title ?? "");

  // The same with the Aa sheet open: pulled up past the end, or swiped right, it only closes.
  const actions = pane(page).getByRole("group", { name: "Article actions" });
  const sheet = page.getByRole("dialog", { name: "Reading appearance" });
  await text.evaluate((area) => (area.scrollTop = area.scrollHeight));
  await actions.getByRole("button", { name: "Reading appearance" }).click();
  await expect(sheet).toBeVisible();
  const pull = await Finger.down(page, box.x + box.width / 2, box.y + 40);
  await pull.move(0, -200);
  await expect(peek(page)).toHaveCount(0);
  await pull.up();
  await expect(sheet).toHaveCount(0);
  await expect(heading).toHaveText(title ?? "");
  await actions.getByRole("button", { name: "Reading appearance" }).click();
  await expect(sheet).toBeVisible();
  const right = await Finger.down(page, 80, box.y + 40);
  await right.move(160);
  await expect(card(page)).toHaveCount(0);
  await right.up();
  await expect(card(page)).toHaveCount(0);
  await expect(sheet).toHaveCount(0);
  await expect(pane(page)).toBeVisible();
  await expect(heading).toHaveText(title ?? "");
});

test("a pull follows the finger back; held still before lifting, a quick pull isn't a flick; a touch while it glides opens nothing more; a swipe right that drifts down still goes back", async ({ page }) => {
  await openBlog(page);
  const titles = (await rows(page).locator(".title").allTextContents()).map((title) => title.replace(/, unread$/, "").trim());
  await rows(page).nth(0).click();
  const heading = (name: string | undefined) => pane(page).getByRole("heading", { level: 2, name });
  await expect(heading(titles[0])).toBeVisible();
  const text = pane(page).locator(".reading-scroller");
  const box = (await text.boundingBox())!;
  const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const transform = () => pane(page).evaluate((node) => node.style.transform);

  // Pulled up 150px, then back down 100px: the article follows the finger back, and the text doesn't scroll instead.
  await text.evaluate((area) => (area.scrollTop = area.scrollHeight));
  const back = await Finger.down(page, middle.x, box.y + box.height - 60);
  await back.move(0, -150);
  await expect.poll(transform).toBe("translateY(-150px)");
  await back.move(0, 100);
  await expect.poll(transform).toBe("translateY(-50px)");
  await back.move(0, 50);
  await back.up();
  await settled(pane(page));

  // A quick short pull, then held still a moment before lifting: no flick, so it slides back.
  const held = await Finger.down(page, middle.x, box.y + box.height - 60);
  await held.move(0, -40, 0, 2);
  await page.waitForTimeout(300);
  await held.up();
  await settled(pane(page));
  await expect(heading(titles[0])).toBeVisible();

  // Let go far enough, then touched again while it glides: only the next one opens, not the one after.
  const up = await Finger.down(page, middle.x, box.y + box.height - 60);
  await up.move(0, -200);
  await up.up();
  const tap = await Finger.down(page, middle.x, middle.y);
  await tap.up();
  await expect(heading(titles[1])).toBeVisible();
  await settled(pane(page));
  await page.waitForTimeout(500);
  await expect(heading(titles[1])).toBeVisible();

  // At the article's top, a swipe right drifting a little down goes back, and no pull starts.
  await text.evaluate((area) => (area.scrollTop = 0));
  const right = await Finger.down(page, middle.x - 100, middle.y);
  await right.move(160, 30);
  await expect(peek(page)).toHaveCount(0);
  await right.up();
  await expect(pane(page)).toBeHidden();
  await expect(rows(page).first()).toBeVisible();
});

test("a pull names who wrote the article it opens, when its feed names a writer", async ({ page }) => {
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/shelf/field-notes/sw-${test.info().workerIndex}-${Date.now()}/feed.xml`);
  await page.goto(new URL(`/${id}`, FEEDS_APP).href);
  await appReady(page);
  await rows(page).nth(0).click();
  const text = pane(page).locator(".reading-scroller");
  const box = (await text.boundingBox())!;
  await text.evaluate((area) => (area.scrollTop = area.scrollHeight));
  const up = await Finger.down(page, box.x + box.width / 2, box.y + box.height - 60);
  await up.move(0, -200);
  await expect(peek(page).locator(".swipe-by")).toHaveText("Maren Holt");
  await up.move(0, 200);
  await up.up();
});

test("the Aa sheet closes when swiped down; Settings goes back home when swiped right", async ({ page }) => {
  await openBlog(page);
  await rows(page).nth(0).click();
  await expect(pane(page).getByRole("heading", { level: 2 })).toBeVisible();
  await pane(page).getByRole("group", { name: "Article actions" }).getByRole("button", { name: "Reading appearance" }).click();
  const sheet = page.getByRole("dialog", { name: "Reading appearance" });
  await expect(sheet).toBeVisible();
  // A swipe across the sheet is the sheet's: no card offers to go back under it.
  const across = (await sheet.boundingBox())!;
  const sideways = await Finger.down(page, 80, across.y + across.height / 2);
  await sideways.move(160);
  await expect(card(page)).toHaveCount(0);
  await sideways.move(-160);
  await sideways.up();
  await expect(sheet).toBeVisible();
  const box = (await sheet.boundingBox())!;
  const finger = await Finger.down(page, box.x + box.width / 2, box.y + 20);
  await finger.move(0, 160);
  await finger.up();
  await expect(sheet).toHaveCount(0);
  await expect(pane(page)).toBeVisible();

  await page.goto(new URL("/settings", FEEDS_APP).href);
  await appReady(page);
  const settings = page.getByRole("heading", { level: 2, name: "Settings" });
  await expect(settings).toBeVisible();
  await swipe(page, settings, 160, 80);
  await expect(home(page)).toBeVisible();
});

test("after a swipe a key still presses; zoomed in, a stroke moves the page; beside other panes, a swipe right on one leaves the others alone", async ({ page }) => {
  await openBlog(page);
  // The press a swipe swallows is the finger's own, never the next key's.
  const first = rows(page).nth(0);
  await swipe(page, first, -140, (await first.boundingBox())!.width - 30);
  await expect(first.locator(".unread-dot")).toHaveCount(0);
  await first.focus();
  await page.keyboard.press("Enter");
  const title = pane(page).getByRole("heading", { level: 2 });
  await expect(title).toBeVisible();
  const reading = await title.textContent();

  // Zoomed in with two fingers, a stroke sideways is the reader moving about the page: no next article, no back.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
  await expect.poll(() => page.evaluate(() => visualViewport?.scale ?? 1)).toBeGreaterThan(1.5);
  for (const dx of [-160, 160]) {
    const finger = await Finger.down(page, dx < 0 ? 300 : 80, 400);
    await finger.move(dx);
    await expect(card(page)).toHaveCount(0);
    await finger.up();
  }
  await expect(title).toHaveText(reading!);
  await expect(pane(page)).toBeVisible();
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });

  // A touch screen wide enough for Settings beside the sidebar: a swipe right on the sidebar doesn't take Settings back.
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto(new URL("/settings/data", FEEDS_APP).href);
  await appReady(page);
  const back = page.getByRole("button", { name: "Back to Settings" });
  await expect(back).toBeVisible();
  await swipe(page, home(page), 160, 40);
  await expect(back).toBeVisible();
  await expect(home(page)).toBeVisible();
});
