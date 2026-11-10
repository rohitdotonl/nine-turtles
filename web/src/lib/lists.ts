// The article lists (SPEC sections 6, 8, 9 and 13): pages from the server,
// or from this device's copies without a connection; whether new articles
// wait; and the words a list ends with and says after Mark all as read.
import { connection, noConnection } from "./connection.svelte";
import { NeedsConnection, keptPage, markSent, useFetchers } from "./offline";
import { getJson, isRecord } from "./http";
import { saved, send, worthRetrying } from "./saving";
import { toArticle, toFullArticle, type Page, type Source } from "./shapes";
import type { Order } from "./reading";

function sourceQuery(source: Source): URLSearchParams {
  const query = new URLSearchParams();
  if ("search" in source) for (const [name, value] of Object.entries(source.search)) query.set(name, value);
  else if ("feed" in source) query.set("feed", String(source.feed));
  else if ("folder" in source) query.set("folder", String(source.folder));
  else query.set("view", source.view);
  return query;
}

/** A page of a list: from the server, or, without a connection, from the copies kept on this device (all at once). */
export async function listArticles(source: Source, order: Order, after: string | null): Promise<Page> {
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

async function listFromServer(source: Source, order: Order, after: string | null): Promise<Page> {
  const query = sourceQuery(source);
  query.set("order", order);
  if (after !== null) query.set("after", after);
  await saved();
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
  if (connection.offline) return "You're offline. These articles load once you're back online.";
  return "The articles couldn't be loaded. Try again in a moment.";
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
  if (field === "starred") return `You're signed out, so the star wasn't ${value ? "saved" : "removed"}.`;
  const what = count === 1 ? "the article wasn't" : `the ${count} articles weren't`;
  return `You're signed out, so ${what} marked as ${value ? "read" : "unread"}.`;
}

/** What the note at the foot of the list says when new items are waiting: no number. On a touch screen a Show button follows it. */
export function newItemsMessage(touch: boolean): string {
  return touch ? "New articles" : "New articles · press r";
}

/** What the note says after "Mark all as read", naming the list it was done in, which its Undo may outlive (decision 0235). */
export function markedAllMessage(count: number, place?: string): string {
  if (count === 0) return "Everything here is already read.";
  return `Marked ${count} ${count === 1 ? "article" : "articles"} as read${place ? ` in ${place}` : ""}.`;
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
