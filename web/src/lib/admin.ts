// The owner's Readers page (SPEC section 18, decision 0089): how this nine
// turtles is doing, in counts, and one line for each reader: their email,
// when they joined, how many feeds they follow (never which) and the day
// they were last here. Nothing about what anyone reads.

import { api } from "./updates.svelte";

export type Reader = {
  id: number;
  email: string | null;
  owner: boolean;
  createdAt: number;
  feeds: number;
  /** Of their feeds, how many have failed for three days or more. */
  feedsFailing: number;
  /** When they were last here, to the day. */
  lastHere: number;
};

export type Overview = {
  readers: Reader[];
  totals: {
    readers: number;
    feeds: number;
    /** Feeds whose every follower is away, so checked once a day. */
    feedsResting: number;
    feedsFailing: number;
    articles: number;
    signUpsWaiting: number;
  };
  databaseBytes: number;
  backupsOn: boolean;
  /** The newest nightly copy's name, such as "nightly/2026-10-25.sqlite". */
  latestBackup: string | null;
  emailSending: boolean;
  /** Problems noted since nine turtles last started, newest first. */
  problems: { at: number; message: string }[];
  mostFeeds: number;
  awayAfterDays: number;
};

export async function loadOverview(): Promise<Overview> {
  const response = await api("/api/admin", { cache: "no-store" });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
  return toOverview(await response.json());
}

/** The server's answer, read carefully: anything missing reads as nothing. */
export function toOverview(body: unknown): Overview {
  const page = isRecord(body) ? body : {};
  const totals = isRecord(page.totals) ? page.totals : {};
  const backups = isRecord(page.backups) ? page.backups : {};
  const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
  return {
    readers: (Array.isArray(page.readers) ? page.readers : []).filter(isRecord).map((reader) => ({
      id: number(reader.id),
      email: typeof reader.email === "string" ? reader.email : null,
      owner: reader.owner === true,
      createdAt: number(reader.created_at),
      feeds: number(reader.feeds),
      feedsFailing: number(reader.feeds_failing),
      lastHere: number(reader.last_here),
    })),
    totals: {
      readers: number(totals.readers),
      feeds: number(totals.feeds),
      feedsResting: number(totals.feeds_resting),
      feedsFailing: number(totals.feeds_failing),
      articles: number(totals.articles),
      signUpsWaiting: number(totals.sign_ups_waiting),
    },
    databaseBytes: number(page.database_bytes),
    backupsOn: backups.on === true,
    latestBackup: typeof backups.latest_nightly === "string" ? backups.latest_nightly : null,
    emailSending: page.email_sending === true,
    problems: (Array.isArray(page.problems) ? page.problems : [])
      .filter(isRecord)
      .map((problem) => ({ at: number(problem.at), message: String(problem.message ?? "") })),
    mostFeeds: number(page.most_feeds) || 1000,
    awayAfterDays: number(page.away_after_days) || 30,
  };
}

const COUNT = new Intl.NumberFormat("en-GB");

/** A count with its thousands parted: "1,340". */
export function count(value: number): string {
  return COUNT.format(value);
}

/** "1 feed", "42 feeds". */
export function plural(value: number, one: string, many: string): string {
  return `${count(value)} ${value === 1 ? one : many}`;
}

/** A size in the units people know: "840 KB", "312 MB", "1.2 GB". */
export function size(bytes: number): string {
  if (bytes < 1000 * 1000) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
  if (bytes < 1000 * 1000 * 1000) return `${Math.round(bytes / (1000 * 1000))} MB`;
  return `${(bytes / (1000 * 1000 * 1000)).toFixed(1)} GB`;
}

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** "25 October 2026", in this device's time zone. */
export function date(seconds: number): string {
  return DATE.format(new Date(seconds * 1000));
}

/** Whole days between two times, counted by this device's calendar. */
function daysBetween(earlier: number, later: number): number {
  const day = (seconds: number) => {
    const at = new Date(seconds * 1000);
    return Date.UTC(at.getFullYear(), at.getMonth(), at.getDate()) / 86_400_000;
  };
  return Math.max(0, Math.round(day(later) - day(earlier)));
}

/**
 * When a reader was last here, to the day: "Here today", "Here yesterday",
 * "Last here 3 days ago", and once they're away (their feeds checked once
 * a day) "Away for 40 days".
 */
export function lastHere(at: number, now: number, awayAfterDays: number): string {
  const days = daysBetween(at, now);
  if (days === 0) return "Here today";
  if (days === 1) return "Here yesterday";
  if (now - at >= awayAfterDays * 86_400) return `Away for ${days} days`;
  return `Last here ${days} days ago`;
}

/** The nightly copy's day, from its name: "nightly/2026-10-25.sqlite" is "25 October 2026". */
export function backupDay(name: string | null): string | null {
  const found = name?.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!found) return null;
  const [year, month, day] = [Number(found[1]), Number(found[2]), Number(found[3])];
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
