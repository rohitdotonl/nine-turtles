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

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "long" });
const LONG_DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" });
const LONG_DAY_AND_YEAR = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

/**
 * Recently read's quiet day headings (SPEC section 5), by the device's own
 * calendar: "Today", "Yesterday", then the weekday for the rest of the last
 * week ("Monday"), then the date ("12 October", with the year when it isn't
 * this one). Never a count.
 */
export function dayHeading(at: number, now: Date = new Date()): string {
  const date = new Date(at * 1000);
  const day = (moment: Date) => Date.UTC(moment.getFullYear(), moment.getMonth(), moment.getDate()) / 86_400_000;
  const ago = day(now) - day(date);
  if (ago <= 0) return "Today";
  if (ago === 1) return "Yesterday";
  if (ago < 7) return WEEKDAY.format(date);
  return (date.getFullYear() === now.getFullYear() ? LONG_DAY : LONG_DAY_AND_YEAR).format(date);
}

/** When a paused feed was paused, for Edit feed: "Paused today.", "Paused on 23 Oct." (SPEC section 15). */
export function pausedSince(at: number, now: Date = new Date()): string {
  const date = new Date(at * 1000);
  const sameDay =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) return "Paused today.";
  return `Paused on ${(date.getFullYear() === now.getFullYear() ? DAY : DAY_AND_YEAR).format(date)}.`;
}
