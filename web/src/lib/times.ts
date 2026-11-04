// Times and dates in the words the screens show: an article's time, Recently
// read's day headings, and when a feed was paused.

const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const DAY_AND_YEAR = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * An article's time, in the device's time zone, in words that never change
 * while you look: "14:05" today, "23 Oct" this year, "23 Oct 2025" before.
 */
export function when(at: number, now: Date = new Date()): string {
  const date = new Date(at * 1000);
  const sameDay =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) return TIME.format(date);
  if (date.getFullYear() === now.getFullYear()) return DAY.format(date);
  return DAY_AND_YEAR.format(date);
}

/** When a paused feed was paused, for Edit feed: "Paused today.", "Paused on 23 Oct." (SPEC section 15). */
export function pausedSince(at: number, now: Date = new Date()): string {
  const date = new Date(at * 1000);
  const sameDay =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) return "Paused today.";
  return `Paused on ${(date.getFullYear() === now.getFullYear() ? DAY : DAY_AND_YEAR).format(date)}.`;
}

/** An empty feed's second line (decision 0142): "Last checked today at 14:20.", or "Last checked on 3 Oct." */
export function lastChecked(at: number, now: Date = new Date()): string {
  const date = new Date(at * 1000);
  const sameDay =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) return `Last checked today at ${TIME.format(date)}.`;
  return `Last checked on ${(date.getFullYear() === now.getFullYear() ? DAY : DAY_AND_YEAR).format(date)}.`;
}
