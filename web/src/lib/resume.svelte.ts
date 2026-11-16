// Pick up where you left off (SPEC section 7, decision 0175): when you come
// back to nine turtles, the one article you last left part of the way
// through is offered in one quiet line, on whichever device you sign in on.
// Only on the first list you see when you come back, after half an hour away
// (decision 0292): a refresh isn't coming back, and another list ends it.
// Each device keeps its own places for every article (places.ts); the server
// keeps only the latest, so another device can offer it and open it there.
// Nothing here is ever said when it fails: the line simply isn't offered.

import { deviceText, setDeviceText } from "./device";
import { getJson, isRecord } from "./http";
import { keepPlace, type Place } from "./places";
import { toArticle, type Article } from "./shapes";
import { api } from "./updates.svelte";

export type Offer = { article: Article; writer: string | null };

/** Whether the server has answered (or couldn't), and what the line offers, if anything. */
export const pickUp: { asked: boolean; offer: Offer | undefined } = $state({ asked: false, offer: undefined });

/** The article the server holds as where you left off, as far as this tab knows. */
let held: number | undefined;
/** The article open now, if one has opened since the page loaded. */
let current: number | undefined;
let asking = false;
/** The requests to the server, one after another, so "keep" and "let go" arrive in the order they were made. */
let queue: Promise<unknown> = Promise.resolve();
/** Where this device writes down when the reader was last here: a time, in milliseconds. */
const HERE = "nine-turtles.here";
/** How long away counts as coming back (decision 0292). */
export const AWAY = 30 * 60_000;

/** Writes down that the reader is here now, or is leaving now. */
export function stillHere(now = Date.now()): void {
  setDeviceText(HERE, String(now));
}

/** Whether the reader has been away long enough for this to be coming back. Never here before counts too. */
function cameBack(now: number): boolean {
  const saved = deviceText(HERE);
  const then = saved === null ? NaN : Number(saved);
  return !Number.isFinite(then) || now - then >= AWAY || now < then;
}

/** Whether this visit is a coming back, and still on the list it began on. */
let welcome = false;
/** The first list on screen since coming back. */
let first: string | undefined;
// Leaving is written down, so a refresh, another tab or another app isn't coming back.
globalThis.document?.addEventListener("visibilitychange", () => document.hidden && stillHere());
globalThis.addEventListener?.("pagehide", () => stillHere());
/** How long the empty reading area waits for the answer before it shows its usual line. */
export const WAIT = 1_500;

/** The offer in the server's answer, if it's well formed. */
export function toOffer(answer: unknown): (Offer & { place: Place }) | undefined {
  if (!isRecord(answer) || !isRecord(answer.article)) return undefined;
  const { block, within } = answer;
  if (typeof block !== "number" || !Number.isInteger(block) || block < 0) return undefined;
  if (typeof within !== "number" || within < 0 || within > 1) return undefined;
  const writer = typeof answer.writer === "string" && answer.writer.trim() ? answer.writer.trim() : null;
  return { article: toArticle(answer.article), writer, place: { block, within } };
}

/**
 * Asks, once, what to offer. A place kept on another device is kept on this
 * one too, so the article opens where you stopped however it's opened.
 */
export function askWhereYouLeftOff(now = Date.now()): void {
  if (asking) return;
  asking = true;
  welcome = cameBack(now);
  stillHere(now);
  const waited = setTimeout(() => (pickUp.asked = true), WAIT);
  getJson("/api/resume").then(
    (answer) => {
      const offer = toOffer(answer);
      if (offer) {
        held = offer.article.id;
        // The server's is the newest place: every place kept on a device is sent to it.
        keepPlace(held, offer.place);
        // Something else opened before the answer came: that place is let go, as below. An answer
        // after the usual line has shown never replaces it: nothing changes under the reader.
        if (current === undefined && !pickUp.asked && welcome) pickUp.offer = { article: offer.article, writer: offer.writer };
        else if (current !== undefined && current !== held) letGo(held);
      }
      clearTimeout(waited);
      pickUp.asked = true;
    },
    () => {
      clearTimeout(waited);
      pickUp.asked = true;
    },
  );
}

function send(path: string, init: RequestInit): void {
  if (globalThis.navigator?.onLine === false) return;
  queue = queue.then(() => api(path, { ...init, signal: AbortSignal.timeout(15_000) }).catch(() => undefined));
}

function letGo(id: number): void {
  held = undefined;
  send(`/api/resume?id=${id}`, { method: "DELETE" });
}

/** An article opened: the line has done its work, and anything else opened lets the old place go. */
export function articleOpened(id: number): void {
  current = id;
  pickUp.offer = undefined;
  askWhereYouLeftOff();
  if (held !== undefined && held !== id) letGo(held);
}

/** A list is on screen: the line is for the first one since coming back, and goes once another shows (decision 0292). */
export function listShown(list: string): void {
  first ??= list;
  if (list === first) return;
  welcome = false;
  pickUp.offer = undefined;
}

/**
 * The page was shown again, with `list` on screen (if one is). After half an
 * hour away with no article open, that's coming back, and the line is asked
 * for afresh, for that list (or the next one to show): true then.
 */
export function lookedAgain(list: string | undefined, reading: boolean, now = Date.now()): boolean {
  if (reading || !cameBack(now)) {
    stillHere(now);
    return false;
  }
  first = list;
  asking = false;
  current = undefined;
  pickUp.asked = false;
  askWhereYouLeftOff(now);
  return true;
}

/** Your place in article `id` was written down: kept as where you left off, or let go at its top or end. */
export function placeKept(id: number, place: Place | undefined): void {
  if (place === undefined) {
    if (held === undefined || held === id) letGo(id);
    return;
  }
  held = id;
  send("/api/resume", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, block: place.block, within: place.within }) });
}

/** The line's words around the title: "You were reading {title}, by {writer}." */
export function pickUpWords(offer: Offer): { before: string; after: string } {
  return { before: "You were reading ", after: offer.writer ? `, by ${offer.writer}.` : "." };
}
