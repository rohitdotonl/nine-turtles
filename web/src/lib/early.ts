// Opening nine turtles asks for everything its first screen needs at once
// (decision 0314): who is signed in, their reading settings, everyone they
// follow and the list the address opens, so the screen waits for one answer
// from the server, not three in a row. Each screen still asks for what it
// needs as before; its request takes the early answer instead of asking again
// (`takeEarly`, used by `api`). An early answer is used once, only for a few
// seconds, and never after the server says nobody is signed in.
//
// The page itself starts these questions before the app's code has even
// arrived (index.html, decision 0320): it asks for the list this address
// opened last time, which `askEarly` notes for it. And a device that has kept
// copies doesn't wait long: if an answer hasn't come within a few seconds,
// the connection is too slow to wait for, and the screen opens from the copies
// as without a connection, saying so; the answer still counts when it comes.

import { lastSort, lastUnread, type Order } from "./reading";
import type { Source } from "./shapes";
import { homeFor } from "./navigation";
import { isList, parse } from "./router";
import { listPath } from "./listPath";
import { deviceText, setDeviceText } from "./device";
import { reached, tooSlow } from "./connection.svelte";

/** An early answer is used only this soon after opening; later, the screen asks afresh. */
const FRESH_MS = 10_000;

/** How long a device with kept copies waits for the first screen's answers before opening from them. */
export const SLOW_MS = 2_500;
/** Where the page finds the list each address opened last time (index.html reads it). */
export const LISTS_KEY = "nine-turtles.early";
/** How many addresses' lists are remembered for the page. */
const LISTS_KEPT = 30;
/** Whose device this is (session.ts): only a device someone was signed in on has copies to open from. */
const READER_KEY = "nine-turtles.reader";

const early = new Map<string, Promise<Response>>();
let askedAt = 0;
let waitsAtMost: number | undefined;

/** Asks for the first screen's answers, all at once (main.ts, before anything is drawn), taking those the page already asked for. */
export function askEarly(path = location.pathname): void {
  askedAt = Date.now();
  waitsAtMost = Number(deviceText(READER_KEY)) > 0 ? askedAt + SLOW_MS : undefined;
  const list = firstList(path);
  noteList(path, list);
  const asked = pageAsked();
  for (const wanted of ["/api/session", "/api/settings", "/api/feeds", list]) {
    if (!wanted) continue;
    const answer = asked[wanted] ?? fetch(wanted, { cache: "no-store" });
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
  if (!answer || Date.now() - askedAt >= FRESH_MS) return undefined;
  return waitsAtMost === undefined ? answer : inTime(answer, waitsAtMost);
}

/**
 * The answer, or a timeout once `deadline` passes without it (as a request with a time limit
 * fails), so the screen opens from the kept copies; the answer, when it comes, says the
 * connection is back.
 */
export function inTime(answer: Promise<Response>, deadline: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const late = setTimeout(() => {
      tooSlow();
      reject(new DOMException("The connection is too slow to wait for.", "TimeoutError"));
      answer.then(reached, () => undefined);
    }, Math.max(0, deadline - Date.now()));
    answer.then(
      (response) => {
        clearTimeout(late);
        resolve(response);
      },
      (problem: unknown) => {
        clearTimeout(late);
        reject(problem);
      },
    );
  });
}

/** What the page asked for before the app's code arrived (index.html). */
function pageAsked(): Record<string, Promise<Response>> {
  const asked = (globalThis as { nineTurtlesEarly?: unknown }).nineTurtlesEarly;
  (globalThis as { nineTurtlesEarly?: unknown }).nineTurtlesEarly = undefined;
  return typeof asked === "object" && asked !== null ? (asked as Record<string, Promise<Response>>) : {};
}

/** Notes the list `path` opens, so the page can ask for it next time before the app's code arrives. */
export function noteList(path: string, list: string | undefined): void {
  let lists: Record<string, string> = {};
  try {
    const kept: unknown = JSON.parse(deviceText(LISTS_KEY) ?? "{}");
    if (typeof kept === "object" && kept !== null && !Array.isArray(kept)) lists = kept as Record<string, string>;
  } catch {
    // Unreadable: started afresh.
  }
  if (lists[path] === list) return;
  delete lists[path];
  if (list) lists[path] = list;
  const kept = Object.entries(lists).slice(-LISTS_KEPT);
  setDeviceText(LISTS_KEY, kept.length > 0 ? JSON.stringify(Object.fromEntries(kept)) : null);
}

/** Nobody is signed in (or someone signs out), or the reader changed something: no early answer is used. */
export function forgetEarly(): void {
  early.clear();
}

/** The list the address opens, as the device last knew the reader's settings; none until it knows their order. */
function firstList(path: string): string | undefined {
  const list = listFor(path);
  return list && listPath(list.source, list.order, null);
}

/** Which list `path` opens, and in what order, as the device last knew the reader's settings; none until it knows their order. */
export function listFor(path: string): { source: Source; order: Order } | undefined {
  const order = lastSort();
  const place = homeFor(parse(path), lastUnread());
  if (!order || !isList(place)) return undefined;
  const source: Source = place.kind === "feed" ? { feed: place.id } : place.kind === "folder" ? { folder: place.id } : { view: place.kind === "view" ? place.view : "starred" };
  return { source, order };
}
