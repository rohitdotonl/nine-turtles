// Podcasts (SPEC section 34, decision 0111): the times the player shows,
// where to carry on from, and Up Next's order, kept apart from the screen so
// they can be tested; and talking to the server about them.
//
// nine turtles never fetches or keeps an episode's audio: the browser's own
// audio element plays the publisher's file from the publisher's address.
// Where the reader stopped is saved on the server (on all their devices) and
// on this device too, so it holds without a connection.

import { api } from "./updates.svelte";
import { serverNow } from "./connection.svelte";

/** An episode's audio file, as its feed describes it. */
export type Episode = {
  /** The publisher's own address for the file. */
  url: string;
  type: string | null;
  bytes: number | null;
  /** How long it plays, if the feed says, in seconds. */
  seconds: number | null;
  /** The episode's picture, else the podcast's, if either. */
  artwork: string | null;
};

/** Where a reader stopped in an episode, and when that was saved (milliseconds, the server's clock). */
export type Place = { position: number; duration: number | null; finished: boolean; at: number };

/** Back 15 seconds, forward 30, as Apple's Podcasts does. */
export const BACK_SECONDS = 15;
export const FORWARD_SECONDS = 30;
/** Within this many seconds of the end, an episode counts as finished. */
export const FINISHED_WITHIN = 30;
/** How often where you are is saved while playing. */
export const SAVE_EVERY_MS = 15_000;
/** The speeds offered, in order; the choice cycles through them. */
export const SPEEDS = [1, 1.25, 1.5, 2] as const;

/** A time as a clock shows it, in whole seconds: "0:05", "12:34", "1:02:03". */
export function clock(seconds: number): string {
  const whole = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = String(whole % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

/** The time left, as Apple shows it: "−12:34". */
export function left(position: number, duration: number): string {
  return `−${clock(Math.max(0, duration - position))}`;
}

/** A time in words, for screen readers: "1 hour 2 minutes 3 seconds", "45 seconds". */
export function spoken(seconds: number): string {
  const whole = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const parts: [number, string][] = [
    [Math.floor(whole / 3600), "hour"],
    [Math.floor((whole % 3600) / 60), "minute"],
    [whole % 60, "second"],
  ];
  const said = parts.filter(([count]) => count > 0).map(([count, unit]) => `${count} ${unit}${count === 1 ? "" : "s"}`);
  return said.length > 0 ? said.join(" ") : "0 seconds";
}

/** An episode's length, short, as a list row shows it: "45 min", "1 hr 5 min", "under a minute". */
export function length(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} hr ${rest} min` : `${hours} hr`;
}

/** Played to within `FINISHED_WITHIN` seconds of the end. */
export function finished(position: number, duration: number | null): boolean {
  return duration !== null && duration > 0 && duration - position <= FINISHED_WITHIN;
}

/**
 * Where to carry on from: the newer of the server's place and this device's
 * own (kept while offline). A finished episode, or one stopped in its last
 * seconds, starts again from the beginning.
 */
export function resumeFrom(server: Place | undefined, device: Place | undefined): number {
  const place = !server ? device : !device ? server : device.at > server.at ? device : server;
  if (!place || place.finished || finished(place.position, place.duration)) return 0;
  return Math.max(0, place.position);
}

/** The next speed after `rate`, round again after 2×. */
export function nextSpeed(rate: number): number {
  const index = SPEEDS.findIndex((speed) => speed === rate);
  return SPEEDS[(index + 1) % SPEEDS.length] ?? 1;
}

/** A speed as the control shows it: "1×", "1.25×". */
export function speedLabel(rate: number): string {
  return `${rate}×`;
}

// ---- Up Next's order (the server keeps it; these make the new one) -----

/** Up Next with `id` at its end (where it was, if it's there already). */
export function added(order: number[], id: number): number[] {
  return order.includes(id) ? order : [...order, id];
}

/** Up Next without `id`. */
export function removed(order: number[], id: number): number[] {
  return order.filter((each) => each !== id);
}

/** Up Next with `id` one place earlier (-1) or later (1); unchanged at either end. */
export function moved(order: number[], id: number, step: -1 | 1): number[] {
  const from = order.indexOf(id);
  const to = from + step;
  if (from === -1 || to < 0 || to >= order.length) return order;
  const next = order.filter((each) => each !== id);
  next.splice(to, 0, id);
  return next;
}

// ---- This device's own copy of each place --------------------------------

const PLACES_KEY = "nine-turtles.episode-places";
/** Only the latest few: older ones are on the server anyway. */
const KEEP_PLACES = 100;

function readPlaces(): Record<string, Place> {
  try {
    const saved: unknown = JSON.parse(globalThis.localStorage?.getItem(PLACES_KEY) ?? "{}");
    return typeof saved === "object" && saved !== null ? (saved as Record<string, Place>) : {};
  } catch {
    return {};
  }
}

/** This device's own copy of where the reader stopped in episode `id`. */
export function devicePlace(id: number): Place | undefined {
  const place = readPlaces()[String(id)];
  return place && typeof place.position === "number" && typeof place.at === "number" ? place : undefined;
}

/** Keeps where the reader stopped on this device, for the latest 100 episodes. */
export function keepOnDevice(id: number, place: Place): void {
  const places = readPlaces();
  places[String(id)] = place;
  const newest = Object.entries(places)
    .sort(([, one], [, other]) => other.at - one.at)
    .slice(0, KEEP_PLACES);
  try {
    globalThis.localStorage?.setItem(PLACES_KEY, JSON.stringify(Object.fromEntries(newest)));
  } catch {
    // Private browsing may refuse: the server still has it.
  }
}

// ---- The server -----------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Where the reader stopped in episode `id`, as the server has it; undefined if nowhere, or if it can't be asked. */
export async function serverPlace(id: number): Promise<Place | undefined> {
  try {
    const response = await api(`/api/episodes/${id}/progress`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return undefined;
    const body: unknown = await response.json();
    const progress = isRecord(body) && isRecord(body.progress) ? body.progress : undefined;
    if (!progress || typeof progress.position !== "number") return undefined;
    return {
      position: progress.position,
      duration: typeof progress.duration === "number" ? progress.duration : null,
      finished: progress.finished === true,
      at: typeof progress.saved_at === "number" ? progress.saved_at : 0,
    };
  } catch {
    return undefined;
  }
}

/** Saves where the reader is, on this device at once and on the server behind; a failure is never said. */
export function savePlace(id: number, position: number, duration: number | null, done: boolean): Place {
  const place: Place = { position, duration, finished: done, at: serverNow() };
  keepOnDevice(id, place);
  void api(`/api/episodes/${id}/progress`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ position, duration, finished: done, at: place.at }),
    // Leaving the page: the browser finishes sending it.
    keepalive: true,
  }).catch(() => undefined);
  return place;
}

/** The reader's Up Next, in order; undefined if it can't be asked just now. */
export async function loadUpNext(): Promise<number[] | undefined> {
  try {
    const response = await api("/api/up-next", { cache: "no-store" });
    if (!response.ok) return undefined;
    const body: unknown = await response.json();
    return isRecord(body) && Array.isArray(body.articles) ? body.articles.map(Number) : undefined;
  } catch {
    return undefined;
  }
}

/** Saves Up Next's new order; answers the order the server kept. */
export async function saveUpNext(order: number[]): Promise<number[]> {
  const response = await api("/api/up-next", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ articles: order }),
  });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
  const body: unknown = await response.json();
  return isRecord(body) && Array.isArray(body.articles) ? body.articles.map(Number) : order;
}

/** An article's episode, from the server's answer (or a copy kept on this device), if it has one. */
export function episodeFrom(article: Record<string, unknown>): Episode | null {
  const url = article.episode_url;
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return null;
  const text = (value: unknown) => (typeof value === "string" ? value : null);
  const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  const artwork = text(article.episode_artwork);
  return {
    url,
    type: text(article.episode_type),
    bytes: number(article.episode_bytes),
    seconds: number(article.episode_seconds),
    artwork: artwork && /^https?:\/\//i.test(artwork) ? artwork : null,
  };
}
