// Times and dates in the words the screens show. Every date in the app has one
// form, the device's own order with a three-letter month: "20 Oct" in Britain,
// "Oct 20" in the United States, with the year when it isn't this one
// (decisions 0215 and 0232). Times follow the device's clock too: "14:05" or
// "2:05 PM". The words stay English, the interface's language. An article's day
// says the last week in words first ("Today", "Yesterday", "Thursday"),
// decision 0218. Every date and time in the app is written here.

// Three letters each, always: the browser's own short months say "Sept" for September.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "long" });

let monthFirst = false;
let TIME: Intl.DateTimeFormat;
let FULL: Intl.DateTimeFormat;

/**
 * Write dates and times the way this device does (decision 0232): the month
 * before or after the day, and a 12- or 24-hour clock, from the device's
 * language and region settings. Called once with nothing; tests pass a locale.
 */
export function writeDatesLike(locale?: string): void {
  const order = new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric" })
    .formatToParts(new Date(2026, 9, 20))
    .map((part) => part.type);
  monthFirst = order.indexOf("month") < order.indexOf("day");
  const hour12 = new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hour12 ?? false;
  const english = monthFirst ? "en-US" : "en-GB";
  const clock = { hour: hour12 ? "numeric" : "2-digit", minute: "2-digit", hour12 } as const;
  TIME = new Intl.DateTimeFormat(english, clock);
  FULL = new Intl.DateTimeFormat(english, { weekday: "long", day: "numeric", month: "long", year: "numeric", ...clock });
}
writeDatesLike();

/** "20 Oct" or "Oct 20", with its year "20 Oct 2025" or "Oct 20, 2025", in the device's time zone. */
function dayMonth(date: Date, withYear: boolean): string {
  const month = MONTHS[date.getMonth()];
  const day = monthFirst ? `${month} ${date.getDate()}` : `${date.getDate()} ${month}`;
  if (!withYear) return day;
  return monthFirst ? `${day}, ${date.getFullYear()}` : `${day} ${date.getFullYear()}`;
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

/** Refresh found nothing new (decision 0229): "Nothing new has arrived since 14:05.", or "… since 3 Oct." for an older load. */
export function nothingNewSince(loaded: Date, now: Date = new Date()): string {
  const sameDay = loaded.toDateString() === now.toDateString();
  return `Nothing new has arrived since ${sameDay ? TIME.format(loaded) : shortDay(loaded, now)}.`;
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
