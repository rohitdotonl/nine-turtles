import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// Swipes on a touch screen (SPEC section 20, decision 0274), made with real
// touches, so the browser's own scrolling has its say as it would on a phone.

test.skip(({ isMobile }) => !isMobile, "a phone's swipes");

const pane = (page: Page) => page.getByRole("region", { name: "Article", exact: true });
const rows = (page: Page) => page.locator(".item-row");
const note = (page: Page) => page.getByRole("status").filter({ hasText: /^(Marked as|Starred|Unstarred)/ });

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
  await page.goto(new URL(`/people/${id}`, FEEDS_APP).href);
  await appReady(page);
  await expect(rows(page)).toHaveCount(3);
}

const card = (page: Page) => page.locator(".swipe-card");
const home = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });

test("a row swiped right is marked read, with Undo; swiped left, starred; nothing opens", async ({ page }) => {
  await openBlog(page);
  const first = rows(page).nth(0);
  await expect(first.locator(".unread-dot")).toBeVisible();

  // Part of the way, the room it opens names what letting go does; the row follows the finger.
  const box = (await first.boundingBox())!;
  const finger = await Finger.down(page, box.x + 60, box.y + box.height / 2);
  await finger.move(60);
  await expect(page.locator(".row-swipe")).toHaveText("Read");
  await expect(page.locator(".row-swipe")).not.toHaveAttribute("data-armed");
  await finger.move(80);
  await expect(page.locator(".row-swipe")).toHaveAttribute("data-armed", "");
  expect(await first.evaluate((row) => row.style.transform)).toBe("translateX(140px)");
  await finger.up();
  // Back at once, with nothing left beside it, and the article isn't opened.
  await expect(page.locator(".row-swipe")).toHaveCount(0);
  expect(await first.evaluate((row) => row.style.transform)).toBe("");
  await expect(first.locator(".unread-dot")).toHaveCount(0);
  await expect(note(page)).toHaveText(/Marked as read/);
  await expect(pane(page)).toHaveCount(0);
  // The card for going back never showed: on a row, right is the row's.
  await expect(card(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(first.locator(".unread-dot")).toBeVisible();

  const second = rows(page).nth(1);
  const at = (await second.boundingBox())!;
  const left = await Finger.down(page, at.x + at.width - 40, at.y + at.height / 2);
  await left.move(-160);
  await expect(page.locator(".row-swipe")).toHaveText("Star");
  await left.up();
  await expect(second.locator(".row-star")).toBeVisible();
  await expect(note(page)).toHaveText(/Starred/);
  await expect(pane(page)).toHaveCount(0);
});

test("a short swipe, or an up-and-down stroke, changes nothing; a flick counts; a list goes back home from above its rows", async ({ page }) => {
  await openBlog(page);
  const first = rows(page).nth(0);
  await swipe(page, first, -50);
  await swipe(page, first, 50);
  const box = (await first.boundingBox())!;
  const finger = await Finger.down(page, box.x + 150, box.y + box.height / 2);
  await finger.move(-30, -120);
  await finger.up();
  await expect(first.locator(".unread-dot")).toBeVisible();
  await expect(first.locator(".row-star")).toHaveCount(0);
  await expect(page.locator(".row-swipe")).toHaveCount(0);
  await expect(home(page)).toBeHidden();

  // A quick flick counts, however short, as on every phone.
  await swipe(page, first, 50, undefined, 0);
  await expect(first.locator(".unread-dot")).toHaveCount(0);

  // Far enough right on the list's title, the card says where it goes; letting go goes there, as ‹ Home does.
  const title = page.getByRole("heading", { level: 2 }).first();
  const top = (await title.boundingBox())!;
  const back = await Finger.down(page, top.x + 40, top.y + top.height / 2);
  await back.move(160);
  await expect(card(page)).toHaveText("‹ Home");
  await back.up();
  await expect(home(page)).toBeVisible();
  await expect(card(page)).toHaveCount(0);
  // Home has no back: a swipe there does nothing.
  await swipe(page, home(page), 200, 60);
  await expect(home(page)).toBeVisible();
});

test("in an article, a swipe left opens the next one, a pull past either end the next or previous, and a swipe right goes back", async ({ page }) => {
  await openBlog(page);
  const titles = (await rows(page).locator(".title").allTextContents()).map((title) => title.replace(/, unread$/, "").trim());
  await rows(page).nth(0).click();
  const heading = (name: string | undefined) => pane(page).getByRole("heading", { level: 2, name });
  await expect(heading(titles[0])).toBeVisible();
  const text = pane(page).locator(".reading-scroller");
  const box = (await text.boundingBox())!;
  const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  // Far enough left, a card at the side names the next article; moving back takes it away.
  const finger = await Finger.down(page, middle.x + 100, middle.y);
  await finger.move(-150);
  await expect(card(page)).toHaveText(`Next${titles[1]}`);
  await finger.move(120);
  await expect(card(page)).toHaveCount(0);
  await finger.move(-120);
  await finger.up();
  await expect(heading(titles[1])).toBeVisible();

  // Pulled down past its top: the previous one, named first.
  const down = await Finger.down(page, middle.x, box.y + 80);
  await down.move(0, 200);
  await expect(card(page)).toHaveText(`Previous${titles[0]}`);
  await down.up();
  await expect(heading(titles[0])).toBeVisible();
  // Nothing before the first: the card says so, and letting go stays.
  const none = await Finger.down(page, middle.x, box.y + 80);
  await none.move(0, 200);
  await expect(card(page)).toHaveText("That's the first article here.");
  await none.up();
  await expect(heading(titles[0])).toBeVisible();

  // Pulled up past its end: the next one.
  await text.evaluate((area) => (area.scrollTop = area.scrollHeight));
  const up = await Finger.down(page, middle.x, box.y + box.height - 60);
  await up.move(0, -200);
  await expect(card(page)).toHaveText(`Next${titles[1]}`);
  await up.up();
  await expect(heading(titles[1])).toBeVisible();

  // Swiped right: back to the list, as its back button says.
  await swipe(page, text, 160, middle.x - 100);
  await expect(pane(page)).toBeHidden();
  await expect(rows(page).first()).toBeVisible();
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
