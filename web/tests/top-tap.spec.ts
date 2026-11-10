import { expect, test, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// On an iPhone, tapping the top of the screen scrolls the pane on screen back
// to its top (decision 0237, SPEC section 20). iOS does it by scrolling the
// page to its top; here the page rests one pixel down, so the test does what
// the tap does: scrolls the page to 0.

test.skip(({ isMobile }) => !isMobile, "the phone layout only");

/** Signs in on a phone that says it's an iPhone, and opens the feeds screen. */
async function openOnIPhone(page: Page, iPhone: boolean) {
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  if (iPhone) await page.addInitScript((agent) => Object.defineProperty(Navigator.prototype, "userAgent", { get: () => agent }), IPHONE);
  await page.goto(new URL("/", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await follow(page, `${FEED_SITE}/reading/`);
  await page.goto(new URL("/", FEEDS_APP).href);
  await appReady(page);
  await expect(page.getByRole("navigation", { name: "Sidebar" })).toBeVisible();
}

/** Makes the pane on screen tall enough to scroll, and scrolls it down. */
function scrollPaneDown(page: Page) {
  return page.evaluate(() => {
    const pane = [...document.querySelectorAll<HTMLElement>(".scroller")].find((one) => one.offsetParent !== null)!;
    const filler = document.createElement("div");
    filler.style.height = "3000px";
    pane.append(filler);
    pane.scrollTop = 600;
    return pane.scrollTop;
  });
}

const paneTop = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".scroller")].find((one) => one.offsetParent !== null)!.scrollTop);

test("tapping the top of an iPhone's screen scrolls the pane to its top, and the page waits for the next tap", async ({ page }) => {
  await openOnIPhone(page, true);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(1);
  expect(await scrollPaneDown(page)).toBe(600);
  await page.evaluate(() => scrollTo(0, 0));
  await expect.poll(() => paneTop(page)).toBe(0);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(1);

  // A finger dragging the page up is not the top tap: the pane stays where it is.
  expect(await scrollPaneDown(page)).toBe(600);
  await page.evaluate(() => {
    dispatchEvent(new TouchEvent("touchstart", { touches: [new Touch({ identifier: 1, target: document.body, clientX: 10, clientY: 10 })] }));
    scrollTo(0, 0);
  });
  expect(await paneTop(page)).toBe(600);
  // The page waits for the finger to leave before going back down its pixel.
  await page.evaluate(() => dispatchEvent(new TouchEvent("touchend", { touches: [] })));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(1);
  expect(await paneTop(page)).toBe(600);

  // With a sheet open, the tap takes the sheet to its top and leaves the list behind it where it was
  // (once the page has stopped coasting after the finger left).
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const sheet = document.createElement("dialog");
    sheet.style.maxHeight = "50vh";
    sheet.innerHTML = '<div style="height: 3000px">A long sheet</div>';
    document.body.append(sheet);
    sheet.showModal();
    sheet.scrollTop = 300;
    scrollTo(0, 0);
  });
  await expect.poll(() => page.evaluate(() => document.querySelector("dialog[open]")!.scrollTop)).toBe(0);
  expect(await paneTop(page)).toBe(600);
});

test("on other phones the page stays put", async ({ page }) => {
  await openOnIPhone(page, false);
  expect(await page.evaluate(() => [scrollY, document.body.style.paddingTop])).toEqual([0, ""]);
});
