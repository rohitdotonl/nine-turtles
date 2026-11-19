// A long sidebar, or a phone's Home, is drawn in steps (decision 0315): enough
// rows to fill the screen first, then the rest a step at a time, each just
// after the screen is painted, so opening never waits for hundreds of rows a
// reader can't see yet. The first step always reaches where you are, so its
// row is in sight at once. Every row is there within a moment.

/** Rows drawn at first: more than a tall screen shows. */
export const FIRST_ROWS = 40;
/** Rows added at each step. */
export const MORE_ROWS = 60;

/** How many rows of each part (in the order they show) are drawn with `room` rows; `all` once every row is. */
export function rowsDrawn(parts: number[], room: number): { counts: number[]; all: boolean } {
  let left = room;
  const counts = parts.map((count) => {
    const now = Math.max(0, Math.min(count, left));
    left -= now;
    return now;
  });
  return { counts, all: counts.every((count, at) => count === parts[at]) };
}

/** How many rows (in the order they show) come before the first that `here` picks, and it; 0 when none does. */
export function rowsUpTo<Row>(parts: Row[][], here: (row: Row) => boolean): number {
  let before = 0;
  for (const part of parts) {
    const at = part.findIndex(here);
    if (at >= 0) return before + at + 1;
    before += part.length;
  }
  return 0;
}

/** Runs `step` once the next frame has been painted. Returns how to cancel it. */
export function afterPaint(step: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const frame = requestAnimationFrame(() => (timer = setTimeout(step, 0)));
  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
  };
}

/** Where you are is always in sight in the sidebar (SPEC section 5): its row scrolls just far enough to show. */
export function placeInSight(sidebar: Element | null | undefined): void {
  sidebar?.querySelector(".scroller [aria-current='page']")?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
}
