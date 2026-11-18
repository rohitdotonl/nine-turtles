// Pinned (SPEC section 5, decision 0310): the people and publications the
// reader keeps at the top of Home, up to nine, the first pinned first. The
// reader pins someone from their page; nine turtles never pins anyone. A
// person's pin is kept on each of their places, so their row is pinned when
// any place is (`people.ts` → `rowsOf` takes the earliest).

import { sendChange } from "./http";
import type { Feed } from "./shapes";

/** The most rows Pinned holds (the server's `pins::MOST`). */
export const PIN_LIMIT = 9;

/** The pinned rows, the first pinned first. */
export function pinnedRows(rows: Feed[]): Feed[] {
  return rows.filter((row) => row.pinnedAt != null).sort((one, other) => one.pinnedAt! - other.pinnedAt! || one.id - other.id);
}

/** What went wrong pinning or unpinning someone, in a sentence; none when it worked. */
export async function sendPin(feed: number, pinned: boolean): Promise<string | undefined> {
  const { refusal } = await sendChange(`/api/feeds/${feed}/pin`, { pinned }, ["full"]);
  if (!refusal) return undefined;
  if (refusal === "full") return `${PIN_LIMIT} are pinned already. Unpin someone first.`;
  if (refusal === "gone") return "They aren't followed any more.";
  return pinned ? "They couldn't be pinned. Try again in a moment." : "They couldn't be unpinned. Try again in a moment.";
}
