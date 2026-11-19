import { expect, test } from "@playwright/test";
import { SCREENS, openScreen } from "./screens";

// The first floor at twice the text size (decision 0313): an iPhone's largest
// sizes make nine turtles twice its size, and every phone screen still fits
// its width, nothing past the right edge, so every feature still works. At
// 375px, the narrowest iPhone nine turtles is likely to meet.
test.describe.configure({ mode: "parallel" });
// The page's own rules allow no style it didn't ship; the test adds one, as a phone's setting would.
test.use({ bypassCSP: true, viewport: { width: 375, height: 812 } });

for (const screen of SCREENS) {
  test(`${screen.name} fits a phone at twice the text size`, async ({ page }) => {
    test.skip(test.info().project.name !== "phone", "Phone screens only: a computer's window can be widened.");
    // Twice the usual text, as Safari sets the page's own size from the phone's setting (systemText.ts):
    // a style added as soon as the page has a head, before nine turtles starts.
    await page.addInitScript(() => {
      const watch = new MutationObserver(() => {
        if (!document.head) return;
        const style = document.createElement("style");
        style.textContent = "html { font-size: 200% !important; }";
        document.head.append(style);
        watch.disconnect();
      });
      watch.observe(document, { childList: true, subtree: true });
    });
    await openScreen(page, screen, "white");
    await expect(page.locator("html")).toHaveAttribute("data-text", "large");

    const past = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      /** In an article's code or table, which scroll sideways on purpose, or cut off by a box that itself fits ("…"): as meant. */
      const held = (element: Element) => {
        if (element.closest(".article-text :is(pre, table)")) return true;
        for (let up = element.parentElement; up; up = up.parentElement) {
          const style = getComputedStyle(up);
          const cut = style.textOverflow === "ellipsis" || style.webkitLineClamp !== "none";
          if (cut && /hidden|clip/.test(style.overflowX) && up.getBoundingClientRect().right <= width + 1) return true;
        }
        return false;
      };
      return [...document.body.querySelectorAll("*")]
        .filter((element) => {
          const box = element.getBoundingClientRect();
          return box.width > 0 && box.height > 0 && (box.right > width + 1 || box.left < -1) && getComputedStyle(element).visibility !== "hidden";
        })
        .filter((element) => !held(element) && !element.closest(".sr-only, [aria-hidden='true'], svg"))
        .map((element) => {
          const box = element.getBoundingClientRect();
          return `${element.tagName.toLowerCase()} "${(element.textContent ?? "").trim().slice(0, 40)}" ${Math.round(box.left)}..${Math.round(box.right)}/${width}`;
        });
    });
    expect(past).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    // A name in the sidebar or Home, or under a list's title, wraps rather than shortening to "Ana Rodri…".
    const cut = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".place-name, .row-feed-name")].filter((name) => name.scrollWidth > name.clientWidth + 1).map((name) => name.textContent?.trim()),
    );
    expect(cut).toEqual([]);
  });
}
