// The article lists (SPEC sections 6, 8, 9 and 13): pages from the server,
// or from this device's copies without a connection; whether new articles
// wait; and the words a list ends with and says after Mark all as read.
import { away, connection, noConnection } from "./connection.svelte";
import { NeedsConnection, keptPage, markSent, useFetchers } from "./offline";
import { getJson, isRecord } from "./http";
import { marksSince, savedBesidesMarks, send, worthRetrying, type Made } from "./saving";
import { toArticle, toFullArticle, type Article, type Page, type Source } from "./shapes";
import type { Order } from "./reading";
import { changesSoFar, noteRecent, recentPage } from "./recent";
import { listPath, sourceQuery } from "./listPath";
import { api } from "./updates.svelte";
import { listFor } from "./early";

/**
 * A page of a list: from the server, or, without a connection, from the copies kept on this device (all at once).
 * `recent`: a first page fetched in the last minute will do (recent.ts); refreshing never asks for one.
 */
export async function listArticles(source: Source, order: Order, after: string | null, recent = false): Promise<Page> {
  // Without a connection, the kept copies show instead, and say so.
  const online = !connection.offline && globalThis.navigator?.onLine !== false;
  // Asked for on the press that opened it, a moment ago (decision 0320): that answer.
  const pressed = recent && online && after === null ? takeAhead(listPath(source, order, null)) : undefined;
  if (pressed) {
    const page = await pressed.catch(() => undefined);
    if (page) return { ...page, articles: page.articles.map((article) => ({ ...article })) };
  }
  const just = recent && online && after === null ? recentPage(listPath(source, order, null)) : undefined;
  if (just) return { ...just, articles: just.articles.map((article) => ({ ...article })) };
  try {
    return await listFromServer(source, order, after);
  } catch (problem) {
    // A kept list comes whole, so there's never a next page of it to add.
    if (!noConnection(problem) || after !== null) throw problem;
    const kept = await keptPage(source, order);
    if (kept) return kept;
    throw problem;
  }
}

/** How long a list asked for on a press waits to be opened: a press opens it at once, or never. */
const AHEAD_MS = 2_000;
/** Lists asked for ahead, on the press that opens them. */
const ahead = new Map<string, { page: Promise<Page>; at: number }>();

/** The list at `path` asked for on a press just now, once; none if there isn't one, or it's too old. */
function takeAhead(path: string): Promise<Page> | undefined {
  const asked = ahead.get(path);
  ahead.delete(path);
  return asked && Date.now() - asked.at < AHEAD_MS ? asked.page : undefined;
}

/**
 * Asks for the first page of the list at `address` as the reader presses its link, before they
 * lift their finger (decision 0320); the list takes that answer when it opens, as it would its own:
 * it was asked for the same way (marks made since are put in, `listFromServer`), only a moment sooner.
 */
export function askAhead(address: string, now = Date.now()): void {
  if (connection.offline || globalThis.navigator?.onLine === false) return;
  const list = listFor(address);
  if (!list) return;
  const path = listPath(list.source, list.order, null);
  const asked = ahead.get(path);
  if ((asked && now - asked.at < AHEAD_MS) || recentPage(path)) return;
  const page = listFromServer(list.source, list.order, null);
  page.catch(() => undefined);
  ahead.set(path, { page, at: now });
}

/** A press on a link to another list, with nothing else held: its first page is asked for at once. */
function pressedLink(event: PointerEvent) {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(link instanceof HTMLAnchorElement) || link.origin !== location.origin || link.target) return;
  if (link.pathname === location.pathname) return;
  askAhead(link.pathname);
}

if (typeof globalThis.addEventListener === "function") globalThis.addEventListener("pointerdown", pressedLink, { capture: true, passive: true });

async function listFromServer(source: Source, order: Order, after: string | null, size?: number, signal?: AbortSignal): Promise<Page> {
  // Marks don't hold it up: those the server may not have yet are put in after (decision 0315).
  await savedBesidesMarks();
  const path = listPath(source, order, after, size);
  const asked = changesSoFar();
  const start = performance.now();
  const body = signal ? await (await answered(path, signal)).json() : await getJson(path);
  if (!isRecord(body) || !Array.isArray(body.articles)) throw new Error("nine turtles sent an unexpected answer");
  const marks = marksSince(start);
  const page = {
    articles: withMarks(body.articles.filter(isRecord).map(toArticle), marks, source),
    next: typeof body.next === "string" ? body.next : null,
    latest: typeof body.latest === "number" ? body.latest : 0,
  };
  // Copies, so a list that marks its rows never changes the noted page; only one the server fully knew.
  if (after === null && size === undefined && marks.length === 0) noteRecent(path, { ...page, articles: page.articles.map((article) => ({ ...article })) }, asked);
  return page;
}

/**
 * The rows as they are with `marks` (oldest first) made, which the server may
 * not have had when it answered: each mark's read or saved, and in Unread or
 * Saved, a row a mark took out of that list goes. (A row a mark would add, as
 * marking one unread just before opening Unread, comes with the next refresh.)
 */
export function withMarks(rows: Article[], marks: Made[], source: Source): Article[] {
  if (marks.length === 0) return rows;
  const marked = rows.map((row) => {
    let now = row;
    for (const mark of marks) if (mark.ids.includes(row.id)) now = { ...now, [mark.kind]: mark.value };
    return now;
  });
  if ("view" in source && source.view === "unread") return marked.filter((row) => !row.read);
  if ("view" in source && source.view === "starred") return marked.filter((row) => row.starred);
  return marked;
}

/**
 * Whether articles for this list have arrived in the background since it
 * was loaded (`latest` from its first page). Never how many (SPEC section 13).
 */
export async function newItemsWaiting(source: Source, latest: number): Promise<boolean> {
  // Search results are what was asked for, when it was asked; r searches again.
  if ("search" in source) return false;
  const query = sourceQuery(source);
  query.set("since", String(latest));
  const body = await getJson(`/api/articles/new?${query}`);
  return isRecord(body) && body.new === true;
}

/**
 * The quiet caption that closes a finished list (SPEC section 6): every
 * list simply ends, the same words everywhere (never "caught up", a finish
 * line; decision 0187), and search results say there are no more.
 */
export function endOfList(source: Source): string {
  if ("search" in source) return "No more results.";
  return "That's everything.";
}

/** What the list says when it couldn't load: without a connection, search says plainly that it needs one. */
export function couldNotLoad(failure: unknown): string {
  if (failure instanceof NeedsConnection) return failure.message;
  if (connection.offline) return `${away().why} These articles load ${away().back}.`;
  // Try again follows it, so the line needn't say it (BRAND.md → "Messages").
  return "The articles couldn't be loaded.";
}

/** "1 result", "12 results", or "50+ results" while older ones are still to load. */
export function resultCount(count: number, more: boolean): string {
  if (count === 0) return "";
  return `${count}${more ? "+" : ""} ${count === 1 && !more ? "result" : "results"}`;
}

/** j or k with no article further that way (decision 0229); `more`: older ones still load as you scroll down. */
export function noFurther(step: 1 | -1, more: boolean): string {
  if (step === -1) return "That's the first article here.";
  return more ? "That's the last one so far. More load as you scroll down." : "That's the last article here.";
}

/** A mark the server refused because the reader is signed out (decision 0230): the real reason, for Sign in beside it. */
export function notSavedSignedOut(field: "read" | "starred", value: boolean, count: number): string {
  if (field === "starred") return `You're signed out, so the article wasn't ${value ? "saved" : "removed from Saved"}.`;
  const what = count === 1 ? "the article wasn't" : `the ${count} articles weren't`;
  return `You're signed out, so ${what} marked as ${value ? "read" : "unread"}.`;
}

/** What the note at the foot of the list says when new items are waiting: no number. On a touch screen a Show button follows it. */
export function newItemsMessage(touch: boolean): string {
  return touch ? "New articles" : "New articles · press r";
}

/** What the note says after "Mark all as read", naming the list it was done in, which its Undo may outlive (decision 0238). */
export function markedAllMessage(count: number, place?: string): string {
  if (count === 0) return "Everything here is already read.";
  return `Marked ${count} ${count === 1 ? "article" : "articles"} as read${place ? ` in ${place}` : ""}.`;
}

/** The answer at `path`, unless `signal` stops it first; an error answer throws. */
async function answered(path: string, signal: AbortSignal): Promise<Response> {
  const response = await api(path, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
  return response;
}

// How the copies for reading offline are fetched, and waiting marks sent (offline.ts).
useFetchers({
  list: listFromServer,
  async several(ids, signal) {
    const body: unknown = await (await answered(`/api/articles/several?ids=${ids.join(",")}`, signal ?? new AbortController().signal)).json();
    if (!isRecord(body) || !Array.isArray(body.articles)) throw new Error("nine turtles sent an unexpected answer");
    return body.articles.filter(isRecord).map(toFullArticle);
  },
  refused: (problem) => !worthRetrying(problem),
  async sendMark(kind, ids, value, at) {
    const path = kind === "read" ? "/api/articles/read" : "/api/articles/starred";
    await send(path, kind === "read" ? { ids, read: value, at } : { ids, starred: value, at }, true);
    await markSent(kind, ids, at);
  },
});
