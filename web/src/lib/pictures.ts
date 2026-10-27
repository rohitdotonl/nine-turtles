/**
 * Pictures in an article that can be opened larger (decision 0107, SPEC
 * section 7). Only a picture the page shows clearly smaller than it really
 * is, that has loaded, and that isn't already a link offers it; a picture
 * at its full size, or inside a link, stays exactly as it was.
 */

export type Size = { width: number; height: number };

/** "Clearly smaller": the real size is at least a fifth bigger, and at least 40px bigger, in width or height. */
const RATIO = 1.2;
const PIXELS = 40;

/**
 * Whether a picture is shown clearly smaller than its real size. `real` is
 * its natural size (0 while it hasn't loaded, or couldn't), `shown` the size
 * it takes on the page, both in CSS pixels. A picture not shown at all
 * (0 wide) is never offered.
 */
export function shownSmaller(real: Size, shown: Size): boolean {
  if (real.width <= 0 || real.height <= 0 || shown.width <= 0 || shown.height <= 0) return false;
  const bigger = (whole: number, part: number) => whole >= part * RATIO && whole - part >= PIXELS;
  return bigger(real.width, shown.width) || bigger(real.height, shown.height);
}

/** The words a screen reader hears for a picture that opens larger: what it does, then what the picture shows. */
export function openLabel(alt: string): string {
  const words = alt.trim();
  return words ? `Open picture larger: ${words}` : "Open picture larger";
}

/** The class an openable picture carries (app.css gives it the pointer). */
export const OPENABLE = "openable";

/**
 * Marks or unmarks one picture of the article: an openable one becomes a
 * button for the keyboard and screen readers; any other is left as the
 * publisher's picture, with nothing added.
 */
export function markPicture(image: HTMLImageElement): void {
  const openable =
    image.complete &&
    !image.closest("a") &&
    shownSmaller({ width: image.naturalWidth, height: image.naturalHeight }, { width: image.clientWidth, height: image.clientHeight });
  if (openable) {
    image.classList.add(OPENABLE);
    image.setAttribute("role", "button");
    image.setAttribute("tabindex", "0");
    image.setAttribute("aria-label", openLabel(image.alt));
  } else if (image.classList.contains(OPENABLE)) {
    image.classList.remove(OPENABLE);
    image.removeAttribute("role");
    image.removeAttribute("tabindex");
    image.removeAttribute("aria-label");
  }
}
