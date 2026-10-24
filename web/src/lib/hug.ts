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

const fits = new Map<Element, () => void>();
let observer: ResizeObserver | undefined;
let canvas: HTMLCanvasElement | undefined;

function ellipsisWidth(node: HTMLElement): number {
  canvas ??= document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return 0;
  const style = getComputedStyle(node);
  context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return context.measureText("…").width;
}

export function hugEllipsis(node: HTMLElement, _text?: string) {
  // The line the name sits in: its width doesn't depend on the name's, so watching it never loops.
  const line = node.closest(".row-meta") ?? node.parentElement ?? node;

  const fit = () => {
    node.style.maxWidth = "";
    const text = node.firstChild;
    // Hidden (one feed's list) or not cut short: nothing to do.
    if (!(text instanceof Text) || node.clientWidth <= 1 || node.scrollWidth <= node.clientWidth) return;
    const range = document.createRange();
    const widthOf = (n: number) => {
      if (n === 0) return 0;
      range.setStart(text, 0);
      range.setEnd(text, n);
      return range.getBoundingClientRect().width;
    };
    const ellipsis = ellipsisWidth(node);
    const count = fittingCount(text.length, widthOf, ellipsis, node.clientWidth);
    node.style.maxWidth = `${Math.ceil(widthOf(count) + ellipsis)}px`;
  };

  if (typeof ResizeObserver !== "undefined" && typeof document.createRange === "function") {
    observer ??= new ResizeObserver((entries) => {
      for (const entry of entries) fits.get(entry.target)?.();
    });
    fits.set(line, fit);
    observer.observe(line);
    void document.fonts?.ready.then(() => {
      if (fits.get(line) === fit) fit();
    });
  }

  return {
    update() {
      if (fits.get(line) === fit) fit();
    },
    destroy() {
      if (fits.get(line) === fit) {
        fits.delete(line);
        observer?.unobserve(line);
      }
    },
  };
}
