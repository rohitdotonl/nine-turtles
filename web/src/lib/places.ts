// Your place in an article (SPEC section 7, decision 0060): like a bookmark
// left in a book, so a long piece read over several sittings opens where you
// stopped. Kept in this browser's own storage, as the reader controls are: a
// phone and a laptop each remember their own place. Nothing is lost if that
// storage is unavailable: an article simply opens at its top.

import { deviceStorage } from "./device";
import { isRecord } from "./http";

/**
 * A place: which block of the article's text was at the top of the window
 * (a paragraph, a picture, a heading), and how far down that block, from 0
 * to 1. Kept by block rather than by pixels, so it holds when pictures load
 * late or the text size changes. `read` is how much of the article has
 * been in view, from 0 to 1 (the window's bottom, down the whole text), for
 * the list's row (SPEC section 6, decision 0224); only the device that
 * measured it knows it, so a place from another device has none.
 */
export type Place = { block: number; within: number; read?: number };

/** Who wants to know when a place is kept or forgotten (the article list's rows). */
const listeners = new Set<() => void>();

/** Calls `changed` whenever a place is kept or forgotten, so a list can show it. Returns how to stop. */
export function onPlaces(changed: () => void): () => void {
  listeners.add(changed);
  return () => listeners.delete(changed);
}

/**
 * The few words a list's row shows while a place is kept (decision 0224):
 * how far through, in plain words, never a number. A place from another
 * device, with no share, says only "Part read".
 */
export function howFarWords(place: Place): string {
  const read = place.read;
  if (read === undefined) return "Part read";
  if (read < 0.25) return "Just begun";
  if (read < 0.42) return "A third read";
  if (read < 0.58) return "Half read";
  if (read < 0.75) return "Two-thirds read";
  return "Nearly finished";
}

const KEY = "nine-turtles.places";
/** Places for the most recent articles only, so storage never grows without end. */
export const KEPT = 200;

type Saved = Record<string, Place & { at: number }>;

function read(storage: Pick<Storage, "getItem"> | undefined): Saved {
  try {
    const saved: unknown = JSON.parse(storage?.getItem(KEY) ?? "null");
    return isRecord(saved) ? (saved as Saved) : {};
  } catch {
    return {};
  }
}

function write(saved: Saved, storage: Pick<Storage, "setItem"> | undefined): void {
  try {
    storage?.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Storage is full or switched off. The article will open at its top next time.
  }
}

function isPlace(value: unknown): value is Place {
  if (typeof value !== "object" || value === null) return false;
  const { block, within, read } = value as Record<string, unknown>;
  const share = read === undefined || (typeof read === "number" && read >= 0 && read <= 1);
  return share && typeof block === "number" && Number.isInteger(block) && block >= 0 && typeof within === "number" && within >= 0 && within <= 1;
}

/** A saved place as a Place, without its date, or `undefined` if it isn't one. */
function asPlace(value: unknown): Place | undefined {
  if (!isPlace(value)) return undefined;
  return value.read === undefined ? { block: value.block, within: value.within } : { block: value.block, within: value.within, read: value.read };
}

/**
 * This device's places, read once and shared by every row of a list
 * (RowPlace.svelte) until a place is kept or forgotten here.
 */
let shared: Saved | undefined;

/** Where you stopped in this article, as a list's row asks: from the shared copy, so a long list reads storage once. */
export function keptPlace(article: number): Place | undefined {
  shared ??= read(deviceStorage());
  const place = shared[article];
  return asPlace(place);
}

/** Where you stopped in this article, if you stopped part of the way through. */
export function placeOf(article: number, storage: Pick<Storage, "getItem"> | undefined = deviceStorage()): Place | undefined {
  const place = read(storage)[article];
  return asPlace(place);
}

/** Remembers where you are; `undefined` forgets it (at the top, or once you've reached the end). */
export function keepPlace(article: number, place: Place | undefined, storage: Pick<Storage, "getItem" | "setItem"> | undefined = deviceStorage(), now = Date.now()): void {
  const saved = read(storage);
  if (place === undefined) {
    if (!(article in saved)) return;
    delete saved[article];
  } else {
    // The same place from the server (decision 0175) keeps the share this device measured.
    const before = saved[article];
    const read = place.read ?? (before && before.block === place.block && before.within === place.within ? before.read : undefined);
    saved[article] = read === undefined ? { block: place.block, within: place.within, at: now } : { block: place.block, within: place.within, read, at: now };
    const ids = Object.keys(saved);
    if (ids.length > KEPT) {
      ids.sort((a, b) => (saved[a]?.at ?? 0) - (saved[b]?.at ?? 0));
      for (const id of ids.slice(0, ids.length - KEPT)) delete saved[id];
    }
  }
  write(saved, storage);
  shared = undefined;
  for (const changed of listeners) changed();
}

/**
 * Where the reader is in `text`, seen through `scroller`, or `undefined` near
 * the top (less than half a window down) or at the end (the last half window
 * in view): there's nothing to come back to.
 */
export function placeIn(scroller: HTMLElement, text: HTMLElement): Place | undefined {
  const room = scroller.scrollHeight - scroller.clientHeight;
  if (scroller.scrollTop < scroller.clientHeight / 2) return undefined;
  if (scroller.scrollTop >= room - scroller.clientHeight / 2) return undefined;
  const top = scroller.getBoundingClientRect().top;
  const blocks = text.children;
  for (let block = 0; block < blocks.length; block++) {
    const box = blocks[block]!.getBoundingClientRect();
    if (box.bottom > top) {
      const within = box.height > 0 ? Math.min(1, Math.max(0, (top - box.top) / box.height)) : 0;
      const read = Math.min(1, (scroller.scrollTop + scroller.clientHeight) / scroller.scrollHeight);
      return { block, within, read };
    }
  }
  return undefined;
}

/** Scrolls `scroller` so `place` is at its top again, at once (nothing glides). */
export function goTo(scroller: HTMLElement, text: HTMLElement, place: Place): void {
  const block = text.children[Math.min(place.block, text.children.length - 1)];
  if (!block) return;
  const box = block.getBoundingClientRect();
  const top = scroller.getBoundingClientRect().top;
  scroller.scrollTop += box.top - top + box.height * place.within;
}
