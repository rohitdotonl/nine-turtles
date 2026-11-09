// Times and dates in the words the screens show. Every date in the app has one
// form, "20 Oct" (and "20 Oct 2025" for another year), decision 0215: an
// article's day, when a feed was paused or last checked, Everyone you follow,
// passkeys and the admin pages. An article's day says the last week in words
// first ("Today", "Yesterday", "Thursday"), decision 0218.

const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
// Three letters each, always: the browser's own short months say "Sept" for September.
const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "long" });
const FULL = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "20 Oct", or with its year, "20 Oct 2025", in the device's time zone. */
function dayMonth(date: Date, withYear: boolean): string {
  const day = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return withYear ? `${day} ${date.getFullYear()}` : day;
}

/**
 * A date with its year, always, for things that last (a passkey, a plan, a
 * reader's account, a connected assistant, a backup): "27 Oct 2026".
 */
export function date(at: number): string {
  return dayMonth(new Date(at * 1000), true);
}

/** The same, or "today": "Last used today", "Last here 24 Oct 2026". */
export function dateOrToday(at: number, now: Date = new Date()): string {
  return new Date(at * 1000).toDateString() === now.toDateString() ? "today" : date(at);
}

/** A day and its time, for the admin's list of problems: "29 Sep, 14:05". */
export function dayAndTime(at: number): string {
  const date = new Date(at * 1000);
  return `${dayMonth(date, false)}, ${TIME.format(date)}`;
}

/** "20 Oct" this year, "20 Oct 2025" another. */
function shortDay(date: Date, now: Date): string {
  return dayMonth(date, date.getFullYear() !== now.getFullYear());
}

/** Whole days from `date` to `now`, by the calendar in the device's time zone (0 today, 1 yesterday). */
function daysAgo(date: Date, now: Date): number {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((start(now) - start(date)) / 86_400_000);
}

/**
 * An article's day, in the device's time zone, in the words a person would
 * say (decision 0218): "Today", "Yesterday", the weekday for the rest of this
 * week ("Thursday"), then "23 Oct" this year and "23 Oct 2025" before. The
 * exact time is in `exactly`, for the tooltip.
 */
export function when(at: number, now: Date = new Date()): string {
  const date = new Date(at * 1000);
  const days = daysAgo(date, now);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return WEEKDAY.format(date);
  return shortDay(date, now);
}

/** The exact day and time, for a date's tooltip: "Sunday, 8 November 2026 at 06:00". */
export function exactly(at: number): string {
  return FULL.format(new Date(at * 1000));
}

/** A moment later today or on another day, for a sentence: "14:05" today, "23 Oct" this year, "23 Oct 2025" before. */
export function until(at: number, now: Date = new Date()): string {
  const date = new Date(at * 1000);
  if (date.toDateString() === now.toDateString()) return TIME.format(date);
  return shortDay(date, now);
}

/** When a paused feed was paused, for Edit feed: "Paused today.", "Paused on 23 Oct." (SPEC section 15). */
export function pausedSince(at: number, now: Date = new Date()): string {
  const date = new Date(at * 1000);
  const sameDay =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) return "Paused today.";
  return `Paused on ${shortDay(date, now)}.`;
}

/** An empty feed's second line (decision 0142): "Last checked today at 14:20.", or "Last checked on 3 Oct." */
export function lastChecked(at: number, now: Date = new Date()): string {
  const date = new Date(at * 1000);
  const sameDay =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) return `Last checked today at ${TIME.format(date)}.`;
  return `Last checked on ${shortDay(date, now)}.`;
}

/** A day, in the device's time zone: "today", "4 Nov" this year, "14 Mar 2025" before. */
export function dayOrToday(at: number, now: Date = new Date()): string {
  const date = new Date(at * 1000);
  if (date.toDateString() === now.toDateString()) return "today";
  return shortDay(date, now);
}
