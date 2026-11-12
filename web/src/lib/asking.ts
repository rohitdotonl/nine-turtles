// How often a list asks whether new articles are waiting (SPEC section 13),
// and when it fills in by itself instead (decision 0249).
import type { Source } from "./shapes";

/** Once a minute, usually. */
export const ASK_EVERY_MS = 60_000;
/** Every five seconds while a list brought from a file is being checked. */
export const ASK_WHILE_CHECKING_MS = 5_000;

/**
 * While feeds brought from a file wait for their first check (`checking`),
 * Unread and All articles say how many are left and may fill in by
 * themselves: there's nothing yet to move under the reader.
 */
export function bringsIn(checking: number, source: Source): boolean {
  return checking > 0 && showsArrivals(source);
}

/** Unread and All articles: the lists that say how an import is arriving, and how it was sorted (decision 0264). */
export function showsArrivals(source: Source): boolean {
  return "view" in source && (source.view === "unread" || source.view === "all");
}

/**
 * Asks once a minute, or every five seconds while `filling()` says the list
 * fills in by itself. The ask just after filling in ends still fills in, so
 * the last feed checked isn't missed. Nothing is asked while the tab is
 * hidden. Returns the way to stop.
 */
export function askingEvery(filling: () => boolean, ask: (filling: boolean) => void): () => void {
  let ticks = 0;
  let was = false;
  const asking = setInterval(() => {
    ticks++;
    if (document.hidden) return;
    const now = filling();
    const fills = now || was;
    was = now;
    if (fills || ticks % (ASK_EVERY_MS / ASK_WHILE_CHECKING_MS) === 0) ask(fills);
  }, ASK_WHILE_CHECKING_MS);
  return () => clearInterval(asking);
}
