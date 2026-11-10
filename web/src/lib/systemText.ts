// The phone's own text size (SPEC section 22, decision 0252). On an iPhone or
// iPad, Settings › Display & Brightness › Text Size grows every native app,
// but a web page only follows it if it asks. nine turtles asks: it reads the
// size the system gives its body text and grows the whole app by the same
// amount, as Mail and Messages do. It never shrinks below its own size:
// smaller would make touch targets under the first floor's 44px and fields
// under 16px, which Safari zooms into when tapped. Aa stays the reader's own control
// for the article, on top. Elsewhere nothing changes: Android's browsers and
// a computer's zoom already scale the whole page by themselves.

/** The body text's size on an iPhone at its default text size, in pixels. */
const DEFAULT_BODY = 17;
/** How far the app grows at most: twice its size, where the first floor promises everything still works. */
const MOST = 2;

/** How much to grow the app for the system's body text size in pixels (1 is as designed, and the least). */
export function textScale(bodyPixels: number): number {
  if (!Number.isFinite(bodyPixels) || bodyPixels <= DEFAULT_BODY) return 1;
  return Math.min(MOST, Math.round((bodyPixels / DEFAULT_BODY) * 1000) / 1000);
}

/** Follows the system's text size where the device has one, now and each time the reader comes back to the app. */
export function followSystemText(): void {
  // Only Apple's browsers know this font, and only touch devices have the setting.
  if (!globalThis.CSS?.supports?.("font", "-apple-system-body") || !matchMedia("(pointer: coarse)").matches) return;
  const probe = document.createElement("span");
  probe.hidden = true;
  probe.style.font = "-apple-system-body";
  const measure = () => {
    document.body.append(probe);
    const scale = textScale(parseFloat(getComputedStyle(probe).fontSize));
    probe.remove();
    document.documentElement.style.fontSize = scale === 1 ? "" : `${scale * 100}%`;
  };
  measure();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") measure();
  });
}
