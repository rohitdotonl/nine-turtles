import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { FEED_SITE, FEEDS_APP } from "../playwright.config";
import { appReady, follow, signIn } from "./screens";

// SPEC section 36, "Their picture" (decision 0285): a circle beside the
// byline and at the top of their page. This made-up blog's feed names no
// picture and its site has no icon, so it shows initials; on their page the
// picture is a button whose menu chooses one of the reader's own, or goes
// back to the automatic one, each with Undo.
// Uses a blog of its own, since every test shares the one nine turtles that has feeds.

const about = (page: Page, name: string) => page.getByRole("region", { name: `About ${name}` });

/** The reader chooses a picture: a plain 120px square, made in the page, as the file picker would hand it over. */
async function choosePicture(where: Locator) {
  await where.locator('input[type="file"]').evaluate(async (input: HTMLInputElement) => {
    const canvas = document.createElement("canvas");
    // A phone photo's size, with detail everywhere, so it weighs what a photo does.
    canvas.width = 4032;
    canvas.height = 3024;
    const context = canvas.getContext("2d")!;
    for (let x = 0; x < canvas.width; x += 16) {
      for (let y = 0; y < canvas.height; y += 16) {
        context.fillStyle = `rgb(${(x * 7) % 256}, ${(y * 13) % 256}, ${(x + y) % 256})`;
        context.fillRect(x, y, 16, 16);
      }
    }
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((made) => resolve(made!), "image/png"));
    const files = new DataTransfer();
    files.items.add(new File([blob], "face.png", { type: "image/png" }));
    input.files = files.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

test("their picture: initials when nothing loads, and one of the reader's own, with Undo", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same picture on a phone");
  const name = `picture-${test.info().workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(new URL("/all", FEEDS_APP).href);
  await appReady(page);
  await signIn(page);
  const id = await follow(page, `${FEED_SITE}/blog/${name}/feed.xml`);
  await page.goto(new URL(`/${id}`, FEEDS_APP).href);
  await appReady(page);

  // Beside the byline: a circle, hidden from screen readers (the name is beside it), with their initials.
  await page.locator(".item-row").first().click();
  const byline = page.locator("article .portrait");
  await expect(byline).toHaveAttribute("aria-hidden", "true");
  await expect(byline.locator(".initials")).toHaveAttribute("data-initials", /^B/);

  await page.goto(new URL(`/${id}/about`, FEEDS_APP).href);
  await appReady(page);
  const who = about(page, `Blog ${name}`);
  const picture = who.getByRole("button", { name: `Change picture of Blog ${name}` });
  await expect(picture.locator(".initials")).toHaveAttribute("data-initials", /^B/);
  // The initials are drawn, not written, so the button's name is only its words (WCAG 2.5.3, Label in Name).
  await expect(picture.locator(".initials")).toHaveText("");
  const checked = await new AxeBuilder({ page }).withRules(["label-content-name-mismatch"]).analyze();
  expect(checked.violations).toEqual([]);
  // Nothing chosen yet: the menu only offers to choose one. With the keyboard alone: Enter opens it, and its
  // one item asks for the device's file picker (a test can't drive the system's own picker, so it's only noted
  // here, never opened); Escape closes the menu and leaves the keyboard on the picture.
  await picture.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu", { name: `Change picture of Blog ${name}` });
  await expect(menu.getByRole("menuitem")).toHaveText(["Choose a picture…"]);
  await expect(menu.getByRole("menuitem", { name: "Choose a picture…" })).toBeFocused();
  const file = who.locator('input[type="file"]');
  await file.evaluate((input: HTMLInputElement) =>
    input.addEventListener("click", (event) => {
      event.preventDefault();
      input.dataset.asked = "yes";
    }, { once: true }),
  );
  await page.keyboard.press("Enter");
  await expect(file).toHaveAttribute("data-asked", "yes");
  await expect(file).not.toHaveAttribute("multiple");
  await expect(menu).toBeHidden();
  await picture.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(picture).toBeFocused();

  // Chosen: whatever its size, the browser sends it small, as WebP; it shows, and Undo puts the initials back.
  await choosePicture(who);
  await expect(who.getByText("Picture changed.")).toBeVisible();
  await expect(picture.locator("img")).toHaveAttribute("src", new RegExp(`/api/feeds/${id}/picture\\?v=\\d+`));
  const kept = await page.request.get(new URL((await picture.locator("img").getAttribute("src"))!, FEEDS_APP).href);
  expect(kept.headers()["content-type"]).toBe("image/webp");
  expect((await kept.body()).length).toBeLessThan(40_000);
  await who.getByRole("button", { name: "Undo" }).click();
  await expect(picture.locator(".initials")).toHaveAttribute("data-initials", /^B/);

  // Chosen again, then back to the automatic picture from the menu, which says so.
  await choosePicture(who);
  await expect(picture.locator("img")).toBeVisible();
  await picture.click();
  await menu.getByRole("menuitem", { name: "Use the automatic picture" }).click();
  await expect(who.getByText("Back to the automatic picture.")).toBeVisible();
  await expect(picture.locator(".initials")).toHaveAttribute("data-initials", /^B/);
  await expect(who.getByRole("button", { name: "Undo" })).toBeFocused();
});
