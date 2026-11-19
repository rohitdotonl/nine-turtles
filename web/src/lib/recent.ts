// The first page of each list fetched in the last minute (decision 0314), so
// opening a list nine turtles has only just fetched (Unread and Saved are
// fetched as the app opens, for reading offline) shows at once instead of
// asking the server again. Any change the reader makes (a mark, a setting, a
// follow; sent, or waiting on the device to be sent) forgets them all
// (`changed`), so a list never shows what was true before it; refreshing a
// list always asks the server.

import type { Page } from "./shapes";

/** How long a first page counts as just fetched. */
export const RECENT_MS = 60_000;

const pages = new Map<string, { page: Page; at: number }>();
/** Counts the changes, so a page asked for before a change isn't noted after it. */
let changes = 0;

/** Which change the screen is at: pass it back to `noteRecent` with the page asked for now. */
export function changesSoFar(): number {
  return changes;
}

/** The first page at `path`, if it was fetched in the last minute and nothing has changed since. */
export function recentPage(path: string, now = Date.now()): Page | undefined {
  const kept = pages.get(path);
  if (!kept) return undefined;
  if (now - kept.at < RECENT_MS) return kept.page;
  pages.delete(path);
  return undefined;
}

/** Notes a first page just fetched from the server, asked for at change `asked` (`changesSoFar`); none if a change came since. */
export function noteRecent(path: string, page: Page, asked: number, now = Date.now()): void {
  if (asked === changes) pages.set(path, { page, at: now });
}

/** A change was made (or the reader changed): no page fetched before it is shown again. */
export function forgetRecent(): void {
  changes++;
  pages.clear();
}
