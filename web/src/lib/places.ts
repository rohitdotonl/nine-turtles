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
 * late or the text size changes.
 */
export type Place = { block: number; within: number };

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
  const { block, within } = value as Record<string, unknown>;
  return typeof block === "number" && Number.isInteger(block) && block >= 0 && typeof within === "number" && within >= 0 && within <= 1;
}

/** Where you stopped in this article, if you stopped part of the way through. */
export function placeOf(article: number, storage: Pick<Storage, "getItem"> | undefined = deviceStorage()): Place | undefined {
  const place = read(storage)[article];
  return isPlace(place) ? { block: place.block, within: place.within } : undefined;
}

/** Remembers where you are; `undefined` forgets it (at the top, or once you've reached the end). */
export function keepPlace(article: number, place: Place | undefined, storage: Pick<Storage, "getItem" | "setItem"> | undefined = deviceStorage(), now = Date.now()): void {
  const saved = read(storage);
  if (place === undefined) {
    if (!(article in saved)) return;
    delete saved[article];
  } else {
    saved[article] = { ...place, at: now };
    const ids = Object.keys(saved);
    if (ids.length > KEPT) {
      ids.sort((a, b) => (saved[a]?.at ?? 0) - (saved[b]?.at ?? 0));
      for (const id of ids.slice(0, ids.length - KEPT)) delete saved[id];
    }
  }
  write(saved, storage);
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
      return { block, within };
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
