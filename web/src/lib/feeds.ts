// Talking to the server about feeds, folders and their articles (SPEC
// sections 3, 5 to 9, 15, 16 and 18), and the words and times the screens
// show for them.
import type { View } from "./router";
import { api } from "./updates.svelte";

export type Feed = {
  id: number;
  title: string;
  siteUrl: string | null;
  /** How many of its articles are unread. */
  unread: number;
  /** The folders it's in, by number. */
  folders: number[];
};

export type Folder = { id: number; name: string };

/** Everything the sidebar lists: feeds and folders, each A to Z. */
export type Library = { feeds: Feed[]; folders: Folder[] };

export type Article = {
  id: number;
  feedId: number;
  feedTitle: string;
  title: string;
  link: string | null;
  /** Seconds since 1970 (UTC). */
  at: number;
  read: boolean;
  starred: boolean;
};

/** One article as the reading area shows it. `content` and `summary` are already cleaned by slowfeed. */
export type FullArticle = Article & {
  siteUrl: string | null;
  author: string | null;
  content: string | null;
  summary: string | null;
  /** The article's language (or its feed's), or null if neither says. */
  language: string | null;
};

/**
 * One page of the item list. `next` is where the next page starts, or null
 * at the end. `latest` is the newest article's number when it was loaded, to
 * ask later whether anything new has arrived.
 */
export type Page = { articles: Article[]; next: string | null; latest: number };

/**
 * Which articles a list shows: one of the views, one feed's or folder's (all
 * of them), or a search's results (`search.ts` → `searchParams`).
 */
export type Source = { view: View } | { feed: number } | { folder: number } | { search: Record<string, string> };

/** The reader's sort order, shared across their devices (SPEC section 18). */
export type Order = "newest" | "oldest";

export type Choice = { title: string; url: string };

export type AddResult =
  | { kind: "added"; feed: Feed }
  | { kind: "choose"; choices: Choice[] }
  | { kind: "already"; feedId: number }
  | { kind: "problem"; reason: Problem };

export type Problem =
  | "not-an-address"
  | "not-allowed"
  | "unreachable"
  | "not-found"
  | "too-big"
  | "no-feed"
  | "trouble";

const PROBLEMS: Problem[] = ["not-an-address", "not-allowed", "unreachable", "not-found", "too-big", "no-feed"];

export async function listFeeds(): Promise<Library> {
  await saved();
  const body = await getJson("/api/feeds");
  const feeds = isRecord(body) && Array.isArray(body.feeds) ? body.feeds : [];
  const folders = isRecord(body) && Array.isArray(body.folders) ? body.folders : [];
  return {
    feeds: feeds.filter(isRecord).map(toFeed),
    folders: folders.filter(isRecord).map((folder) => ({ id: Number(folder.id), name: String(folder.name ?? "") })),
  };
}

/** A folder's unread count: its feeds' counts added up (each article is in one feed). */
export function folderUnread(folder: Folder, feeds: Feed[]): number {
  return feeds.filter((feed) => feed.folders.includes(folder.id)).reduce((sum, feed) => sum + feed.unread, 0);
}

/**
 * The sidebar search (SPEC section 5): folders and feeds whose name holds
 * what was typed, whatever its capitals or accents, each A to Z as listed.
 */
export function findByName(library: Library, typed: string): Library {
  const wanted = fold(typed.trim());
  if (!wanted) return library;
  return {
    folders: library.folders.filter((folder) => fold(folder.name).includes(wanted)),
    feeds: library.feeds.filter((feed) => fold(feed.title).includes(wanted)),
  };
}

function fold(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase();
}

function sourceQuery(source: Source): URLSearchParams {
  const query = new URLSearchParams();
  if ("search" in source) for (const [name, value] of Object.entries(source.search)) query.set(name, value);
  else if ("feed" in source) query.set("feed", String(source.feed));
  else if ("folder" in source) query.set("folder", String(source.folder));
  else query.set("view", source.view);
  return query;
}

export async function listArticles(source: Source, order: Order, after: string | null): Promise<Page> {
  const query = sourceQuery(source);
  query.set("order", order);
  if (after !== null) query.set("after", after);
  await saved();
  const body = await getJson(`/api/${"search" in source ? "search" : "articles"}?${query}`);
  if (!isRecord(body) || !Array.isArray(body.articles)) throw new Error("slowfeed sent an unexpected answer");
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

/** What the line above the list says when new items are waiting: no number. */
export function newItemsMessage(touch: boolean): string {
  return touch ? "New items · tap Refresh" : "New items · press r";
}

// Marks are sent one after another, in the order they were made, so an undo
// can never overtake the mark it undoes. Lists and counts wait for them, so
// a list opened next already shows them; articles themselves never wait, so
// a slow save can't hold up reading.
let writes: Promise<unknown> = Promise.resolve();

/** Waits until every mark sent so far has been saved (or has failed). */
function saved(): Promise<unknown> {
  return writes;
}

function send(path: string, body: unknown): Promise<void> {
  const sent = writes.then(async () => {
    const response = await api(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      // A save that hangs counts as failed, so it can't hold up the lists.
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`slowfeed answered ${response.status}`);
  });
  writes = sent.catch(() => undefined);
  return sent;
}

/** Marks articles read or unread. The screen has already changed; this tells the server. */
export function markRead(ids: number[], read: boolean): Promise<void> {
  return send("/api/articles/read", { ids, read });
}

/** Stars or unstars articles. The screen has already changed; this tells the server. */
export function markStarred(ids: number[], starred: boolean): Promise<void> {
  return send("/api/articles/starred", { ids, starred });
}

/** The sort order; newest first if the server can't say. */
export async function loadSort(): Promise<Order> {
  try {
    const body = await getJson("/api/settings");
    return isRecord(body) && body.sort === "oldest" ? "oldest" : "newest";
  } catch {
    return "newest";
  }
}

export function saveSort(sort: Order): Promise<void> {
  return send("/api/settings", { sort });
}

/** What the line above the list says after "Mark all as read". */
export function markedAllMessage(count: number): string {
  if (count === 0) return "Everything here is already read.";
  return `Marked ${count} ${count === 1 ? "item" : "items"} as read`;
}

/** A feed's unread count as the sidebar shows it: nothing for none, "999+" above 999. */
export function unreadLabel(count: number): string {
  if (count <= 0) return "";
  return count > 999 ? "999+" : String(count);
}

// Articles already fetched, so moving back and forth with j and k never
// waits. Kept small: only the last few are needed.
const loaded = new Map<number, FullArticle>();
const loading = new Map<number, Promise<FullArticle>>();
const KEEP = 20;

/** The article, if it's already here, without waiting. */
export function articleNow(id: number): FullArticle | undefined {
  return loaded.get(id);
}

/** The article, from the ones already here or from the server. */
export function readArticle(id: number): Promise<FullArticle> {
  const here = loaded.get(id);
  if (here) return Promise.resolve(here);
  const pending = loading.get(id);
  if (pending) return pending;
  const request = getJson(`/api/articles/${id}`)
    .then((body) => {
      if (!isRecord(body) || !isRecord(body.article)) throw new Error("slowfeed sent an unexpected answer");
      const article = toFullArticle(body.article);
      loaded.set(id, article);
      if (loaded.size > KEEP) loaded.delete(loaded.keys().next().value as number);
      return article;
    })
    .finally(() => loading.delete(id));
  loading.set(id, request);
  return request;
}

/** Fetches an article in advance, so it shows at once when asked for. */
export function prefetch(id: number): void {
  readArticle(id).catch(() => {
    // Nothing to do: it's fetched again when actually opened.
  });
}

/** Follows a feed from a feed's or a website's address. */
export async function addFeed(address: string): Promise<AddResult> {
  let response: Response;
  try {
    response = await api("/api/feeds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address }),
    });
  } catch {
    return { kind: "problem", reason: "trouble" };
  }
  const body: unknown = await response.json().catch(() => null);
  if (!isRecord(body)) return { kind: "problem", reason: "trouble" };
  if (isRecord(body.feed)) return { kind: "added", feed: toFeed(body.feed) };
  if (Array.isArray(body.choices)) {
    const choices = body.choices.filter(isRecord).map((choice) => ({
      title: String(choice.title ?? ""),
      url: String(choice.url ?? ""),
    }));
    return { kind: "choose", choices };
  }
  if (body.error === "already" && typeof body.feed_id === "number") return { kind: "already", feedId: body.feed_id };
  const reason = PROBLEMS.find((problem) => problem === body.error) ?? "trouble";
  return { kind: "problem", reason };
}

/**
 * What the item list's line says on arriving, after unsubscribing or
 * deleting a folder. `undo` reverses it; it answers a problem to say, if any.
 */
export type Notice = { message: string; undo?: () => Promise<string | undefined> };

/** Why a change to feeds or folders wasn't made. */
export type Refusal = "no-name" | "already" | "too-late" | "gone" | "trouble";

/** Sends a change to feeds or folders. Unlike marks, the screen waits for the answer. */
async function change(path: string, body: unknown): Promise<{ refusal?: Refusal; answer?: Record<string, unknown> }> {
  // Marks sent just before (an article read, then Unsubscribe) are saved first.
  await saved();
  let response: Response;
  try {
    response = await api(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { refusal: "trouble" };
  }
  const answer: unknown = await response.json().catch(() => null);
  if (response.ok) return { answer: isRecord(answer) ? answer : {} };
  if (response.status === 404) return { refusal: "gone" };
  const error = isRecord(answer) ? answer.error : undefined;
  if (error === "no-name" || error === "already" || error === "too-late") return { refusal: error };
  return { refusal: "trouble" };
}

/** "Edit feed": its name and folders; `newFolder` (if any) is created and chosen too. */
export async function editFeed(id: number, title: string, folders: number[], newFolder: string): Promise<Refusal | undefined> {
  return (await change(`/api/feeds/${id}`, { title, folders, new_folder: newFolder })).refusal;
}

export async function unsubscribe(id: number): Promise<Refusal | undefined> {
  return (await change(`/api/feeds/${id}/unsubscribe`, {})).refusal;
}

/** Undo for unsubscribing. "too-late" once the feed was cleared for good. */
export async function resubscribe(id: number): Promise<Refusal | undefined> {
  return (await change(`/api/feeds/${id}/resubscribe`, {})).refusal;
}

export async function renameFolder(id: number, name: string): Promise<Refusal | undefined> {
  return (await change(`/api/folders/${id}`, { name })).refusal;
}

export async function deleteFolder(id: number): Promise<Refusal | undefined> {
  return (await change(`/api/folders/${id}/delete`, {})).refusal;
}

/** Creates a folder with these feeds in it (Undo for deleting one). */
export async function createFolder(name: string, feeds: number[]): Promise<Refusal | undefined> {
  return (await change("/api/folders", { name, feeds })).refusal;
}

/** What an edit page says when a change wasn't made. */
export function refused(refusal: Refusal, what: "feed" | "folder"): string {
  switch (refusal) {
    case "no-name":
      return `Give the ${what} a name.`;
    case "already":
      return "There's already a folder with that name.";
    case "too-late":
      return "It's too late to undo that.";
    case "gone":
      return `This ${what} isn't here any more.`;
    case "trouble":
      return "That couldn't be saved. Try again in a moment.";
  }
}

/** What an OPML import did. */
export type ImportSummary = { added: number; already: number; foldersAdded: number; unreadable: string[] };

/** Imports an OPML file's feeds and folders. A string is a problem, said plainly. */
export async function importOpml(file: File): Promise<ImportSummary | string> {
  let response: Response;
  try {
    response = await api("/api/opml", {
      method: "POST",
      headers: { "content-type": "text/x-opml" },
      body: await file.text(),
    });
  } catch {
    return "The file couldn't be sent. Try again in a moment.";
  }
  const body: unknown = await response.json().catch(() => null);
  if (response.ok && isRecord(body) && isRecord(body.summary)) {
    const summary = body.summary;
    return {
      added: Number(summary.added ?? 0),
      already: Number(summary.already ?? 0),
      foldersAdded: Number(summary.folders_added ?? 0),
      unreadable: Array.isArray(summary.unreadable) ? summary.unreadable.map(String) : [],
    };
  }
  if (isRecord(body) && body.error === "not-opml") return "That file doesn't look like an OPML file.";
  if (response.status === 413) return "That file lists more feeds than slowfeed can take at once.";
  return "The file couldn't be imported. Try again in a moment.";
}

/** The plain summary after an import (SPEC section 16). */
export function importMessage(summary: ImportSummary): string[] {
  const count = (number: number, one: string, many: string) => `${number} ${number === 1 ? one : many}`;
  const lines = [
    summary.added === 0
      ? "No new feeds were added."
      : `Added ${count(summary.added, "feed", "feeds")}${summary.foldersAdded > 0 ? ` and ${count(summary.foldersAdded, "folder", "folders")}` : ""}. ${summary.added === 1 ? "Its" : "Their"} articles arrive over the next few minutes.`,
  ];
  if (summary.already > 0) {
    lines.push(`${count(summary.already, "feed was", "feeds were")} already here, so ${summary.already === 1 ? "it wasn't" : "they weren't"} added again.`);
  }
  if (summary.unreadable.length > 0) {
    lines.push(`${count(summary.unreadable.length, "line", "lines")} couldn't be read: ${summary.unreadable.join(", ")}.`);
  }
  return lines;
}

/** What the add field says when a feed couldn't be added. Plain and calm. */
export function explain(reason: Problem): string {
  switch (reason) {
    case "not-an-address":
      return "That doesn't look like a web address.";
    case "not-allowed":
      return "slowfeed can't visit that address.";
    case "unreachable":
      return "That site didn't answer. Try again later.";
    case "not-found":
      return "Nothing was found at that address.";
    case "too-big":
      return "That file is too big to be a feed.";
    case "no-feed":
      return "This site doesn't seem to offer a feed.";
    case "trouble":
      return "slowfeed couldn't add that just now. Try again in a moment.";
  }
}

const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const DAY_AND_YEAR = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * An article's time, in the device's time zone, in words that never change
 * while you look: "14:05" today, "23 Oct" this year, "23 Oct 2025" before.
 */
export function when(at: number, now: Date = new Date()): string {
  const date = new Date(at * 1000);
  const sameDay =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) return TIME.format(date);
  if (date.getFullYear() === now.getFullYear()) return DAY.format(date);
  return DAY_AND_YEAR.format(date);
}

async function getJson(path: string): Promise<unknown> {
  const response = await api(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`slowfeed answered ${response.status}`);
  return response.json();
}

function toArticle(article: Record<string, unknown>): Article {
  return {
    id: Number(article.id),
    feedId: Number(article.feed_id),
    feedTitle: String(article.feed_title ?? ""),
    title: String(article.title ?? ""),
    link: text(article.link),
    at: Number(article.at),
    read: article.read === true,
    starred: article.starred === true,
  };
}

function toFullArticle(article: Record<string, unknown>): FullArticle {
  return {
    ...toArticle(article),
    siteUrl: text(article.site_url),
    author: text(article.author),
    content: text(article.content),
    summary: text(article.summary),
    language: text(article.language),
  };
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toFeed(feed: Record<string, unknown>): Feed {
  return {
    id: Number(feed.id),
    title: String(feed.title ?? ""),
    siteUrl: text(feed.site_url),
    unread: Number(feed.unread ?? 0),
    folders: Array.isArray(feed.folders) ? feed.folders.map(Number) : [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
