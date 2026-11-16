import { expect, test } from "@playwright/test";
import { FEEDS_APP } from "../playwright.config";
import { appReady, openAppearance, openReadingRoom, signIn } from "./screens";

// Decision 0288, DESIGN.md → "Line length and spacing": one column width in
// every reading font, and every font nine turtles ships lands at 60 to 75
// characters a line in it (spaces counted) at the usual text size. A font
// added or swapped that can't fails here; the one width is then retuned for
// every font, never a width of its own. System serif is the device's own
// (New York, Georgia), not on this computer, so it isn't measured. Each font
// is chosen in the Aa panel, as a reader does, over the made-up Reading Room.

const PROSE = [
  "Most mornings I walk to the bakery at the end of the road before anyone else is awake.",
  "The baker has worked there for thirty years, and she still writes the day's bread on a small board by the door,",
  "in chalk, in the same careful hand. Nobody asked her to; she simply thinks people should know what they are buying.",
  "I have started to notice how rare that kind of care has become. Most of what reaches me in a day was made to be",
  "glanced at, not read, and it shows. The pieces I keep coming back to are the ones written by someone who had",
  "something to say and took the time to say it plainly: a letter from a friend, a long post on a small blog, a recipe",
  "with a note about the grandmother who taught it. They ask nothing of me except attention, and they repay it.",
  "So I have been trying to read the way I walk to the bakery: slowly, at the same hour, without hurry, and with",
  "an eye for the small board by the door that tells me, honestly, what is inside. It is a quieter way to spend a",
  "morning, and I find I remember far more of what I read than I did when everything arrived at once.",
].join(" ");

test("every reading font fills the one column with 60 to 75 characters a line", async ({ page, isMobile }) => {
  test.skip(isMobile, "A phone's column is the screen's own width.");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  await openReadingRoom(page);
  await page.keyboard.press("j");
  await page.keyboard.press("Enter");
  const article = page.getByRole("region", { name: "Article", exact: true });
  const fonts = (await openAppearance(page, article)).locator('input[name="aa-font"]');
  const names = (await fonts.evaluateAll((radios) => radios.map((radio) => radio.getAttribute("value") ?? ""))).filter((name) => name !== "system-serif");
  expect(names.length).toBeGreaterThan(1);
  const widths: number[] = [];
  const faces = new Set<string>();
  for (const name of names) {
    await fonts.and(page.locator(`[value="${name}"]`)).check();
    const { width, perLine, face } = await page.locator(".article").first().evaluate(async (column, text) => {
      const paragraph = column.appendChild(document.createElement("p"));
      paragraph.textContent = text;
      const face = getComputedStyle(paragraph).fontFamily.split(",")[0]!.trim();
      await document.fonts.load(`1em ${face}`, text);
      // Each character's line, by the top of its box; every line but the last is full.
      const node = paragraph.firstChild!;
      const range = document.createRange();
      const lines: number[] = [];
      let top = -Infinity;
      for (let i = 0; i < text.length; i += 1) {
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const y = Math.round(range.getBoundingClientRect().top);
        if (text[i] !== " " && Math.abs(y - top) > 2) {
          lines.push(0);
          top = y;
        }
        lines[lines.length - 1]! += 1;
      }
      paragraph.remove();
      const full = lines.slice(0, -1);
      return { width: column.getBoundingClientRect().width, perLine: full.reduce((sum, n) => sum + n, 0) / full.length, face };
    }, PROSE);
    expect(await page.evaluate((face) => document.fonts.check(`1em ${face}`), face), `${name}'s own face loaded`).toBe(true);
    expect(perLine, `${name}: characters a line`).toBeGreaterThanOrEqual(60);
    expect(perLine, `${name}: characters a line`).toBeLessThanOrEqual(75);
    widths.push(width);
    faces.add(face);
  }
  expect(faces.size, "each font measured in its own face").toBe(names.length);
  // One column for every font: changing the font never moves it.
  for (const width of widths) expect(Math.abs(width - widths[0]!)).toBeLessThan(1);
});
