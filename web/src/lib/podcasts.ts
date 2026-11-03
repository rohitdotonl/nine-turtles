// Podcasts (SPEC section 35, decision 0113): the times the player shows,
// and where to carry on from, kept apart from the screen so
// they can be tested; and talking to the server about them.
//
// nine turtles never fetches or keeps an episode's audio: the browser's own
// audio element plays the publisher's file from the publisher's address.
// Where the reader stopped is saved on the server (on all their devices) and
// on this device too, so it holds without a connection.

import { api } from "./updates.svelte";
import { serverNow } from "./connection.svelte";
import { isRecord } from "./http";
import { deviceJson, setDeviceText } from "./device";

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

// ---- This device's own copy of each place --------------------------------

const PLACES_KEY = "nine-turtles.episode-places";
/** Only the latest few: older ones are on the server anyway. */
const KEEP_PLACES = 100;

function readPlaces(): Record<string, Place> {
  const saved = deviceJson(PLACES_KEY);
  return isRecord(saved) ? (saved as Record<string, Place>) : {};
}

/** This device's own copy of where the reader stopped in episode `id`. */
export function devicePlace(id: number): Place | undefined {
  const place = readPlaces()[String(id)];
  return place && typeof place.position === "number" && typeof place.at === "number" ? place : undefined;
}

/** Forgets every place kept on this device (nobody is signed in). */
export function forgetPlaces(): void {
  setDeviceText(PLACES_KEY, null);
}

/** Keeps where the reader stopped on this device, for the latest 100 episodes. */
export function keepOnDevice(id: number, place: Place): void {
  const places = readPlaces();
  places[String(id)] = place;
  const newest = Object.entries(places)
    .sort(([, one], [, other]) => other.at - one.at)
    .slice(0, KEEP_PLACES);
  setDeviceText(PLACES_KEY, JSON.stringify(Object.fromEntries(newest)));
}

// ---- The server -----------------------------------------------------------

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
