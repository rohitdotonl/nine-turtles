// Opening nine turtles asks for everything its first screen needs at once
// (decision 0314): who is signed in, their reading settings, everyone they
// follow and the list the address opens, so the screen waits for one answer
// from the server, not three in a row. Each screen still asks for what it
// needs as before; its request takes the early answer instead of asking again
// (`takeEarly`, used by `api`). An early answer is used once, only for a few
// seconds, and never after the server says nobody is signed in.

import { lastSort, lastUnread } from "./reading";
import { homeFor } from "./navigation";
import { isList, parse } from "./router";
import { listPath } from "./listPath";

/** An early answer is used only this soon after opening; later, the screen asks afresh. */
const FRESH_MS = 10_000;

const early = new Map<string, Promise<Response>>();
let askedAt = 0;

/** Asks for the first screen's answers, all at once (main.ts, before anything is drawn). */
export function askEarly(path = location.pathname): void {
  askedAt = Date.now();
  for (const wanted of ["/api/session", "/api/settings", "/api/feeds", firstList(path)]) {
    if (!wanted) continue;
    const answer = fetch(wanted, { cache: "no-store" });
    // Read only if a screen takes it; a failure is that screen's to handle.
    answer.catch(() => undefined);
    early.set(wanted, answer);
  }
}

/** The early answer for a plain request to `path`, once; none if there isn't one, or it's too old. */
export function takeEarly(path: string, init?: RequestInit): Promise<Response> | undefined {
  if ((init?.method ?? "GET") !== "GET" || init?.body) return undefined;
  const answer = early.get(path);
  early.delete(path);
  return answer && Date.now() - askedAt < FRESH_MS ? answer : undefined;
}

/** Nobody is signed in (or someone signs out), or the reader changed something: no early answer is used. */
export function forgetEarly(): void {
  early.clear();
}

/** The list the address opens, as the device last knew the reader's settings; none until it knows their order. */
function firstList(path: string): string | undefined {
  const order = lastSort();
  const place = homeFor(parse(path), lastUnread());
  if (!order || !isList(place)) return undefined;
  const source = place.kind === "feed" ? { feed: place.id } : place.kind === "folder" ? { folder: place.id } : { view: place.kind === "view" ? place.view : "starred" };
  return listPath(source, order, null);
}
