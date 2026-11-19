// Work the first screen doesn't need waits until that screen is up (decision
// 0314): the pages most openings never show, fetched in files of their own.

import { whenBack } from "./connection.svelte";

/** How long the first screen gets before `later` work starts anyway. */
const AT_MOST_MS = 3_000;

/**
 * Runs `work` once the browser is idle after the first screen (at once if `now`).
 * If it fails (no connection), it runs again when the connection is back.
 */
export function later(work: () => Promise<void>, now = false): void {
  const run = () => void work().catch(() => whenBack(run));
  if (now) run();
  else if ("requestIdleCallback" in window) requestIdleCallback(run, { timeout: AT_MOST_MS });
  else setTimeout(run, AT_MOST_MS / 3);
}
