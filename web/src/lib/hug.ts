/**
 * A cut-short name whose "…" sits right against what follows it (decision
 * 0051), as in a list row's "A very long feed na… · 20 Oct".
 *
 * CSS ends an overflowing line in "…" after the last whole letter that fits,
 * but the box keeps its full width, so up to a letter's width of blank space
 * opens between the "…" and the " · date" after it, wider on one row than
 * the next. This narrows the box to the letters shown plus the "…", so the
 * separator always hugs it. CSS still draws the "…"; the text is unchanged,
 * so screen readers and the tooltip get the whole name.
 *
 * Use as `use:hugEllipsis={text}` on an element with `overflow: hidden` and
 * `text-overflow: ellipsis` whose only child is its text. It measures again
 * when the line around it changes width, when its text changes and when the
 * fonts have loaded.
 */

/**
 * How many of `total` characters fit in `room` with an ellipsis after them:
 * the largest n with `widthOf(n) + ellipsis <= room`. `widthOf` must grow
 * with n; a binary search keeps it to a few measurements however long the name.
 */
export function fittingCount(total: number, widthOf: (n: number) => number, ellipsis: number, room: number): number {
  let low = 0;
  let high = total;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (widthOf(mid) + ellipsis <= room) low = mid;
    else high = mid - 1;
  }
  return low;
}

type Fit = { node: HTMLElement; clear: () => void; measure: () => number | undefined };

const fits = new Map<Element, Fit>();
let observer: ResizeObserver | undefined;
let fontsHooked = false;
const ellipsisCache = new Map<string, number>();

// The "…" as CSS draws it: measured on a span with the name's own font, spacing and features.
function ellipsisWidth(node: HTMLElement): number {
  const style = getComputedStyle(node);
  const key = `${style.font}|${style.letterSpacing}|${style.fontFeatureSettings}`;
  const cached = ellipsisCache.get(key);
  if (cached !== undefined) return cached;
  const probe = document.createElement("span");
  probe.textContent = "…";
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;";
  probe.style.font = style.font;
  probe.style.letterSpacing = style.letterSpacing;
  probe.style.fontFeatureSettings = style.fontFeatureSettings;
  node.parentElement?.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  ellipsisCache.set(key, width);
  return width;
}

// Fits rows in phases (clear every box, then measure every one, then set every one),
// so a list of hundreds of rows lays out a couple of times, not once per row.
function fitAll(list: Fit[]) {
  for (const f of list) f.clear();
  const widths = list.map((f) => f.measure());
  list.forEach((f, i) => {
    const width = widths[i];
    if (width !== undefined) f.node.style.maxWidth = `${width}px`;
  });
}

export function hugEllipsis(node: HTMLElement, _text?: string) {
  // The line the name sits in: its width doesn't depend on the name's, so watching it never loops.
  const line = node.closest(".row-meta");
  if (!line) return {};

  const fit: Fit = {
    node,
    clear: () => {
      node.style.maxWidth = "";
    },
    measure: () => {
      const text = node.firstChild;
      // Hidden (one feed's list) or not cut short: nothing to do.
      if (!(text instanceof Text) || node.clientWidth <= 1 || node.scrollWidth <= node.clientWidth) return undefined;
      const range = document.createRange();
      const widthOf = (n: number) => {
        if (n === 0) return 0;
        range.setStart(text, 0);
        range.setEnd(text, n);
        return range.getBoundingClientRect().width;
      };
      const ellipsis = ellipsisWidth(node);
      const count = fittingCount(text.length, widthOf, ellipsis, node.clientWidth);
      return Math.ceil(widthOf(count) + ellipsis);
    },
  };

  if (typeof ResizeObserver !== "undefined" && typeof document.createRange === "function") {
    observer ??= new ResizeObserver((entries) => {
      fitAll(entries.map((entry) => fits.get(entry.target)).filter((f): f is Fit => f !== undefined));
    });
    if (!fontsHooked && document.fonts) {
      fontsHooked = true;
      void document.fonts.ready.then(() => {
        ellipsisCache.clear();
        fitAll([...fits.values()]);
      });
    }
    fits.set(line, fit);
    observer.observe(line);
  }

  return {
    update() {
      if (fits.get(line) === fit) fitAll([fit]);
    },
    destroy() {
      if (fits.get(line) === fit) {
        fits.delete(line);
        observer?.unobserve(line);
      }
    },
  };
}
