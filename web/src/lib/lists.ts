// The article lists (SPEC sections 6, 8, 9 and 13): pages from the server,
// or from this device's copies without a connection; whether new articles
// wait; marking many at once (Catch me up, Mark older as read); and the
// words a list ends with.
import { api } from "./updates.svelte";
import { noConnection } from "./connection.svelte";
import {
  CATCH_UP_NEEDS_CONNECTION,
  READ_PAST_NEEDS_CONNECTION,
  COLLECTIONS_NEED_CONNECTION,
  NeedsConnection,
  RECENT_NEEDS_CONNECTION,
  UP_NEXT_NEEDS_CONNECTION,
  keptPage,
  markSent,
  useFetchers,
} from "./offline";
import { getJson, isRecord } from "./http";
import { Refused, markRead, saved, send, worthRetrying } from "./saving";
import { toArticle, toFullArticle, type Article, type Page, type Source } from "./shapes";
import type { Order } from "./reading";

function sourceQuery(source: Source): URLSearchParams {
  const query = new URLSearchParams();
  if ("search" in source) for (const [name, value] of Object.entries(source.search)) query.set(name, value);
  else if ("feed" in source) query.set("feed", String(source.feed));
  else if ("folder" in source) query.set("folder", String(source.folder));
  else if ("collection" in source) query.set("collection", String(source.collection));
  else query.set("view", source.view);
  return query;
}

/** A page of a list: from the server, or, without a connection, from the copies kept on this device (all at once). */
export async function listArticles(source: Source, order: Order, after: string | null): Promise<Page> {
  try {
    return await listFromServer(source, order, after);
  } catch (problem) {
    // Recently read isn't kept on the device: it says plainly that it needs a connection.
    if (noConnection(problem) && "view" in source && source.view === "recent") throw new NeedsConnection(RECENT_NEEDS_CONNECTION);
    // Nor is Up Next (decision 0113).
    if (noConnection(problem) && "view" in source && source.view === "upnext") throw new NeedsConnection(UP_NEXT_NEEDS_CONNECTION);
    // Nor are collections (decision 0108).
    if (noConnection(problem) && "collection" in source) throw new NeedsConnection(COLLECTIONS_NEED_CONNECTION);
    // A kept list comes whole, so there's never a next page of it to add.
    if (!noConnection(problem) || after !== null) throw problem;
    const kept = await keptPage(source, order);
    if (kept) return kept;
    throw problem;
  }
}

async function listFromServer(source: Source, order: Order, after: string | null): Promise<Page> {
  const query = sourceQuery(source);
  query.set("order", order);
  if (after !== null) query.set("after", after);
  await saved();
  // Recently read lists the article just opened too, waiting a moment for
  // its note, never long: on a slow connection the list comes without it.
  if ("view" in source && source.view === "recent") await Promise.race([opening, new Promise((done) => setTimeout(done, OPENING_WAIT))]);
  const body = await getJson(`/api/${"search" in source ? "search" : "articles"}?${query}`);
  if (!isRecord(body) || !Array.isArray(body.articles)) throw new Error("nine turtles sent an unexpected answer");
  return {
    articles: body.articles.filter(isRecord).map(toArticle),
    next: typeof body.next === "string" ? body.next : null,
    latest: typeof body.latest === "number" ? body.latest : 0,
  };
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
 * The quiet caption that closes a finished list (SPEC section 6): only
 * Unread is something to get through, so only it is "caught up"; every other
 * list simply ends, and search results say there are no more.
 */
export function endOfList(source: Source): string {
  if ("search" in source) return "No more results.";
  if ("view" in source && source.view === "unread") return "You're all caught up.";
  return "That's everything.";
}

/** What the note at the foot of the list says when new items are waiting: no number. On a touch screen a Show button follows it. */
export function newItemsMessage(touch: boolean): string {
  return touch ? "New articles" : "New articles · press r";
}

/** The last "opened" note on its way, so Recently read waits for it. */
let opening: Promise<unknown> = Promise.resolve();
/** The longest Recently read waits for that note, in milliseconds. */
const OPENING_WAIT = 2_000;

/**
 * Tells the server the reading area showed an article, for Recently read
 * (decision 0105). Not a mark: without a connection it isn't sent or kept
 * for later, and a failure is never said.
 */
export function noteOpened(id: number): void {
  if (globalThis.navigator?.onLine === false) return;
  opening = api("/api/articles/opened", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => undefined);
}

/**
 * "Catch me up" (decision 0097): every article in Unread from before the
 * start of today, on this device's clock, counts as read. Answers which, for
 * Undo. Unlike marks, the screen waits for the answer: only the server knows
 * them all.
 */
export async function catchUp(now: Date = new Date()): Promise<number[]> {
  await saved();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let response: Response;
  try {
    response = await api("/api/articles/catch-up", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ before: Math.floor(today.getTime() / 1000) }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (problem) {
    if (noConnection(problem)) throw new NeedsConnection(CATCH_UP_NEEDS_CONNECTION);
    throw problem;
  }
  if (!response.ok) throw new Refused(response.status);
  const body: unknown = await response.json();
  return isRecord(body) && Array.isArray(body.ids) ? body.ids.map(Number) : [];
}

/**
 * "Mark older as read", "Mark all above as read" and "Mark all below as
 * read" (decision 0103), when more of the list is still to load: every
 * unread article in the list on one side of `article`, loaded or not, but
 * none that arrived after the list was loaded (`latest`). Answers which
 * were marked, for Undo. Not for search results, which the screen marks
 * page by page itself.
 */
export async function readPast(source: Exclude<Source, { search: Record<string, string> }>, side: "older" | "newer", article: Article, latest: number): Promise<number[]> {
  await saved();
  let response: Response;
  try {
    response = await api("/api/articles/read-past", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...source, side, at: article.at, id: article.id, latest }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (problem) {
    if (noConnection(problem)) throw new NeedsConnection(READ_PAST_NEEDS_CONNECTION);
    throw problem;
  }
  if (!response.ok) throw new Refused(response.status);
  const body: unknown = await response.json();
  return isRecord(body) && Array.isArray(body.ids) ? body.ids.map(Number) : [];
}

/** The most articles one mark names (the server's limit), so Undo after catching up on a huge backlog goes in parts. */
const MOST_AT_ONCE = 10_000;

/** Undo for "Catch me up": the same articles, unread again, in parts the server takes. */
export async function uncatchUp(ids: number[]): Promise<void> {
  const parts = [];
  for (let start = 0; start < ids.length; start += MOST_AT_ONCE) parts.push(markRead(ids.slice(start, start + MOST_AT_ONCE), false));
  await Promise.all(parts);
}

/** What the note says after "Catch me up". */
export function caughtUpMessage(count: number): string {
  if (count === 0) return "Nothing from before today is unread.";
  return `Marked ${count} ${count === 1 ? "article" : "articles"} from before today as read`;
}

/** What the line above the list says after "Mark all as read". */
export function markedAllMessage(count: number): string {
  if (count === 0) return "Everything here is already read.";
  return `Marked ${count} ${count === 1 ? "article" : "articles"} as read`;
}

/** What the note says when "Mark older as read", or above or below, finds nothing unread there. */
export function nothingPastMessage(kind: "older" | "above" | "below"): string {
  return kind === "older" ? "Nothing older is unread." : `Nothing ${kind} it is unread.`;
}

// How the copies for reading offline are fetched, and waiting marks sent (offline.ts).
useFetchers({
  list: listFromServer,
  async several(ids) {
    const body = await getJson(`/api/articles/several?ids=${ids.join(",")}`);
    if (!isRecord(body) || !Array.isArray(body.articles)) throw new Error("nine turtles sent an unexpected answer");
    return body.articles.filter(isRecord).map(toFullArticle);
  },
  refused: (problem) => !worthRetrying(problem),
  async sendMark(kind, ids, value, at) {
    const path = kind === "read" ? "/api/articles/read" : "/api/articles/starred";
    await send(path, kind === "read" ? { ids, read: value, at } : { ids, starred: value, at });
    await markSent(kind, ids, at);
  },
});
