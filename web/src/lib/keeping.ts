// What a reader kept from a place, asked before unsubscribing from it
// (SPEC section 42): how many of its articles they starred, how many they
// highlighted or wrote a note on, and whether they wrote a note on the
// person. With any of these, Unsubscribe asks whether to keep them.

import { getJson, isRecord } from "./http";

export type Kept = { starred: number; marked: number; note: boolean };

/** What the reader kept from a place; nothing when it can't be asked (Unsubscribe then keeps all, as it always has). */
export async function keptFrom(feed: number): Promise<Kept> {
  try {
    const body = await getJson(`/api/feeds/${feed}/kept`);
    if (isRecord(body)) return { starred: Number(body.starred ?? 0), marked: Number(body.marked ?? 0), note: body.note === true };
  } catch {
    // Unasked, everything kept stays.
  }
  return { starred: 0, marked: 0, note: false };
}

export function keptAny(kept: Kept): boolean {
  return kept.starred > 0 || kept.marked > 0 || kept.note;
}

/** In plain words: "You starred 3 of their articles, highlighted or noted 1 and wrote a note on them." */
export function keptWords(kept: Kept): string {
  const articles = (n: number, first: boolean) => (first ? `${n} of their articles` : String(n));
  const parts: string[] = [];
  if (kept.starred > 0) parts.push(`starred ${articles(kept.starred, true)}`);
  if (kept.marked > 0) parts.push(`highlighted or noted ${articles(kept.marked, parts.length === 0)}`);
  if (kept.note) parts.push("wrote a note on them");
  const last = parts.pop() ?? "";
  return `You ${parts.length > 0 ? `${parts.join(", ")} and ${last}` : last}.`;
}
