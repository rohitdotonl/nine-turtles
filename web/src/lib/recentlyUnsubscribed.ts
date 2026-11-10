// Recently unsubscribed (decision 0239): who the reader, or an assistant,
// unsubscribed from in the last 30 days, kept with their articles so Bring
// back can follow them again, at the end of Everyone you follow.

import { isRecord } from "./http";
import { dayOrToday } from "./times";

/** One row: a person's places unsubscribed from together, or one place. */
export type Kept = {
  /** Every place Bring back follows again. */
  ids: number[];
  title: string;
  unsubscribedAt: number;
  keptUntil: number;
  byAssistant: boolean;
};

/**
 * Reads the `unsubscribed` list of GET /api/tidy/feeds, newest first,
 * leaving out anything malformed. A person's places left at the same moment
 * (Unsubscribe from Alpha) are one row.
 */
export function readKept(list: unknown): Kept[] {
  const rows: (Kept & { person: number | null })[] = [];
  for (const item of Array.isArray(list) ? list : []) {
    if (
      !isRecord(item) ||
      typeof item.feed_id !== "number" ||
      typeof item.title !== "string" ||
      typeof item.unsubscribed_at !== "number" ||
      typeof item.kept_until !== "number"
    )
      continue;
    const person = typeof item.person === "number" ? item.person : null;
    const same =
      person === null
        ? undefined
        : rows.find(
            (row) =>
              row.person === person &&
              row.unsubscribedAt === item.unsubscribed_at,
          );
    if (same) {
      same.ids.push(item.feed_id);
      continue;
    }
    rows.push({
      ids: [item.feed_id],
      title: item.title,
      unsubscribedAt: item.unsubscribed_at,
      keptUntil: item.kept_until,
      byAssistant: item.by_assistant === true || item.by_assistant === 1,
      person,
    });
  }
  return rows.map(({ person: _, ...row }) => row);
}

/** "Unsubscribed today · kept until 8 Dec", or "Unsubscribed by an assistant 4 Nov · kept until 4 Dec" (a year only when it isn't this one). */
export function keptLine(kept: Kept, now: Date = new Date()): string {
  const who = kept.byAssistant
    ? "Unsubscribed by an assistant"
    : "Unsubscribed";
  // A date never breaks across two lines ("10 Dec", not "10" then "Dec").
  const day = (at: number) => dayOrToday(at, now).replaceAll(" ", "\u00a0");
  return `${who} ${day(kept.unsubscribedAt)} · kept until ${day(kept.keptUntil)}`;
}
