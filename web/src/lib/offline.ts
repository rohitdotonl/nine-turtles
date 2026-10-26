// Reading offline (SPEC section 31, decision 0100). While nine turtles can be
// reached, it quietly keeps a copy of the reader's first 200 unread articles
// (in their sort order; in river mode, the first 200 of All) and their newest
// 200 starred ones on this device, words only: each image is a short note
// that it shows once the device is back online. Without a connection, Unread,
// Starred, All, feeds and folders list those copies, articles open from them,
// and reading, marking and starring carry on. Those marks wait here and are
// sent once the connection is back, each saying when it was made, so the
// latest mark wins (decision 0100).
//
// The copies live in the browser's own database for this site (IndexedDB),
// never in the tab's memory, and are fetched a few dozen at a time, a moment
// apart, so the app never waits for them. Signing out (or being signed out)
// deletes them, as does switching "Keep articles for reading offline" off in
// Settings; both send any waiting marks first. It's on unless switched off,
// on each device. (Marks still waiting when a sign-in has expired can't be
// saved: the server would refuse them anyway. Decision 0100.)

import type { Article, FullArticle, Library, Order, Page, ReadingMode, Source } from "./feeds";

/** At most this many unread articles, and this many starred ones, are kept (the owner's limit). */
export const KEEP_UNREAD = 200;
export const KEEP_STARRED = 200;
/** How many articles each request for copies asks for: the server gives at most 50. */
const AT_ONCE = 25;
/** The pause between those requests, so the app and the server never feel them. */
const PAUSE_MS = 250;

/** A kept article: what the reading area needs, with whether it was in the reader's first page of Unread (or All). */
export type Kept = FullArticle & { first: boolean };

/** A mark made here and not yet confirmed by the server. */
export type Mark = { key: string; kind: "read" | "starred"; id: number; value: boolean; at: number };

/** What the signed-in screen needs to open without a connection. */
export type KeptSession = { version: string; owner: boolean; email: string | null; emailSending: boolean };

const SWITCH_KEY = "nine-turtles.offline";

/** Whether this device keeps articles for reading offline: yes unless switched off in Settings. */
export function keeping(): boolean {
  try {
    return globalThis.localStorage?.getItem(SWITCH_KEY) !== "off";
  } catch {
    return true;
  }
}

/** Switches keeping on or off on this device. Off sends any waiting marks it can, then deletes every copy. */
export async function setKeeping(on: boolean): Promise<void> {
  // Waiting marks go first, unless there's plainly no connection to send them on.
  if (!on && globalThis.navigator?.onLine !== false) await sendWaiting();
  try {
    if (on) globalThis.localStorage?.removeItem(SWITCH_KEY);
    else globalThis.localStorage?.setItem(SWITCH_KEY, "off");
  } catch {
    // Private browsing may refuse: then it's on for as long as this tab is open.
  }
  if (!on) await forget();
}

// ---- The words the screens say ------------------------------------------

export const SHOWING_KEPT = "Offline. Showing the articles saved on this device.";
export const NOTHING_KEPT_HERE = "Nothing here is saved on this device. It will show when you're back online.";
export const END_OF_KEPT = "That's everything saved on this device.";
export const NOT_KEPT = "This article isn't saved on this device. It opens when you're back online.";
export const SEARCH_NEEDS_CONNECTION = "Search needs a connection. It works again once you're back online.";
export const REFRESH_NEEDS_CONNECTION = "Refresh needs a connection. This is what's saved on this device.";
export const CATCH_UP_NEEDS_CONNECTION = "Catch me up needs a connection. Try again once you're back online.";
export const SETTINGS_NEED_CONNECTION = "Settings need a connection. They open once you're back online.";

/** Thrown for what can't be done without a connection; its message says so. */
export class NeedsConnection extends Error {}

// ---- Choosing what to keep (no database here, so it can be tested) -----

/**
 * Which articles to keep: the first `KEEP_UNREAD` of the reader's list (Unread,
 * or All in river mode) and the first `KEEP_STARRED` starred ones, each once.
 */
export function toKeep(first: Article[], starred: Article[]): Map<number, { row: Article; first: boolean }> {
  const keep = new Map<number, { row: Article; first: boolean }>();
  for (const row of first.slice(0, KEEP_UNREAD)) keep.set(row.id, { row, first: true });
  for (const row of starred.slice(0, KEEP_STARRED)) if (!keep.has(row.id)) keep.set(row.id, { row, first: false });
  return keep;
}

/** A kept article brought up to date with its row in the server's list: its marks and names may have changed. */
export function refreshed(kept: Kept, row: Article, first: boolean): Kept {
  return { ...kept, read: row.read, starred: row.starred, muted: row.muted, feedTitle: row.feedTitle, at: row.at, first };
}

/** A kept article with a mark made on this device. */
export function withMark(kept: Kept, mark: Pick<Mark, "kind" | "value">): Kept {
  return mark.kind === "read" ? { ...kept, read: mark.value, muted: mark.value ? kept.muted : false } : { ...kept, starred: mark.value };
}

/** The feeds a list without a connection shows: one feed, a folder's, or all of them. */
function feedsOf(source: Source, library: Library | undefined): Set<number> | undefined {
  if ("feed" in source) return new Set([source.feed]);
  if ("folder" in source) return new Set((library?.feeds ?? []).filter((feed) => feed.folders.includes(source.folder)).map((feed) => feed.id));
  return undefined;
}

/**
 * A list as it shows without a connection, from the kept articles, in the
 * reader's order. Unread shows those still unread (in river mode it's All
 * that was kept), Starred the starred ones, everything else what's kept.
 * Search can't be done here.
 */
export function keptList(kept: Kept[], source: Source, order: Order, library?: Library): Article[] {
  if ("search" in source) throw new NeedsConnection(SEARCH_NEEDS_CONNECTION);
  const feeds = feedsOf(source, library);
  const view = "view" in source ? source.view : undefined;
  const shown = kept.filter((article) => {
    if (feeds && !feeds.has(article.feedId)) return false;
    if (view === "unread") return article.first && !article.read && !article.muted;
    if (view === "starred") return article.starred;
    // Only Starred lists a muted article, as on the server.
    return !article.muted;
  });
  shown.sort((one, other) => one.at - other.at || one.id - other.id);
  if (order === "newest") shown.reverse();
  return shown.map(({ id, feedId, feedTitle, title, link, at, read, starred, muted }) => ({ id, feedId, feedTitle, title, link, at, read, starred, muted }));
}

/** Marks waiting to be sent, in parts the server takes in one request each: the same mark, made at the same moment. */
export function inParts(marks: Mark[]): { kind: Mark["kind"]; value: boolean; at: number; ids: number[] }[] {
  const parts = new Map<string, { kind: Mark["kind"]; value: boolean; at: number; ids: number[] }>();
  for (const mark of [...marks].sort((one, other) => one.at - other.at)) {
    const key = `${mark.kind}:${mark.value}:${mark.at}`;
    const part = parts.get(key) ?? { kind: mark.kind, value: mark.value, at: mark.at, ids: [] };
    part.ids.push(mark.id);
    parts.set(key, part);
  }
  return [...parts.values()];
}

/** The sidebar's counts, as kept, after read marks made here: each mark that changed an article moves its feed's count. */
export function countsAfter(library: Library, before: Map<number, Kept>, changed: Kept[]): Library {
  const change = new Map<number, number>();
  for (const after of changed) {
    const was = before.get(after.id);
    if (!was || was.read === after.read) continue;
    change.set(after.feedId, (change.get(after.feedId) ?? 0) + (after.read ? -1 : 1));
  }
  if (change.size === 0) return library;
  return {
    ...library,
    feeds: library.feeds.map((feed) => (change.has(feed.id) && !feed.river ? { ...feed, unread: Math.max(0, feed.unread + (change.get(feed.id) ?? 0)) } : feed)),
  };
}

// ---- The database ---------------------------------------------------------

const NAME = "nine-turtles-offline";
type Store = "articles" | "marks" | "about";
let opening: Promise<IDBDatabase> | undefined;

function open(): Promise<IDBDatabase> {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no IndexedDB"));
    const request = indexedDB.open(NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("articles", { keyPath: "id" });
      db.createObjectStore("marks", { keyPath: "key" });
      db.createObjectStore("about");
    };
    request.onsuccess = () => {
      const db = request.result;
      // Another tab deleting the copies (signing out) closes this one's link.
      db.onversionchange = () => {
        db.close();
        opening = undefined;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("blocked"));
  }).catch((problem) => {
    opening = undefined;
    throw problem;
  });
  return opening;
}

/** Runs `work` in one transaction over `stores`; resolves once it's written. */
async function inside<T>(stores: Store[], mode: IDBTransactionMode, work: (tx: IDBTransaction) => Promise<T> | T): Promise<T> {
  const db = await open();
  const tx = db.transaction(stores, mode);
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("aborted"));
  });
  const result = await work(tx);
  await done;
  return result;
}

function ask<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function allKept(): Promise<Kept[]> {
  return inside(["articles"], "readonly", (tx) => ask(tx.objectStore("articles").getAll() as IDBRequest<Kept[]>));
}

async function about<T>(key: string): Promise<T | undefined> {
  try {
    return await inside(["about"], "readonly", (tx) => ask(tx.objectStore("about").get(key) as IDBRequest<T | undefined>));
  } catch {
    return undefined;
  }
}

async function remember(key: string, value: unknown): Promise<void> {
  try {
    await inside(["about"], "readwrite", (tx) => void tx.objectStore("about").put(value, key));
  } catch {
    // Without its database this device simply keeps nothing.
  }
}

/** Deletes every copy and every waiting mark on this device. */
export async function forget(): Promise<void> {
  generation++;
  const db = await opening?.catch(() => undefined);
  db?.close();
  opening = undefined;
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(NAME);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}

// ---- What the rest of the app uses ----------------------------------------

/** Keeps what the signed-in screen needs to open without a connection. */
export function keepSession(session: KeptSession): void {
  if (keeping()) void remember("session", session);
}

/** The signed-in screen as last kept, if this device keeps articles. */
export async function keptSession(): Promise<KeptSession | undefined> {
  return keeping() ? about<KeptSession>("session") : undefined;
}

/** Keeps the sidebar's feeds and folders, as the server last gave them. */
export function keepLibrary(library: Library): void {
  if (keeping()) void remember("library", library);
}

export async function keptLibrary(): Promise<Library | undefined> {
  return keeping() ? about<Library>("library") : undefined;
}

/** A list from the copies on this device, or undefined when there are none to show from. */
export async function keptPage(source: Source, order: Order): Promise<Page | undefined> {
  if (!keeping()) return undefined;
  let kept: Kept[];
  try {
    kept = await allKept();
  } catch {
    return undefined;
  }
  const library = "folder" in source ? await keptLibrary() : undefined;
  return { articles: keptList(kept, source, order, library), next: null, latest: 0, kept: true };
}

/** An article from the copies on this device. */
export async function keptArticle(id: number): Promise<FullArticle | undefined> {
  if (!keeping()) return undefined;
  try {
    const kept = await inside(["articles"], "readonly", (tx) => ask(tx.objectStore("articles").get(id) as IDBRequest<Kept | undefined>));
    if (!kept) return undefined;
    const { first: _first, ...article } = kept;
    return article;
  } catch {
    return undefined;
  }
}

/**
 * A mark made on this device: the copies show it at once, the sidebar's kept
 * counts follow, and it waits here until the server confirms it. Answers
 * whether it was written down, so a mark the server can't take yet is kept
 * for later rather than taken back.
 */
export async function noteMark(kind: Mark["kind"], ids: number[], value: boolean, at: number): Promise<boolean> {
  if (!keeping()) return false;
  try {
    await inside(["articles", "marks", "about"], "readwrite", async (tx) => {
      const articles = tx.objectStore("articles");
      const marks = tx.objectStore("marks");
      const before = new Map<number, Kept>();
      const changed: Kept[] = [];
      for (const id of ids) {
        marks.put({ key: `${kind}:${id}`, kind, id, value, at } satisfies Mark);
        const kept = await ask(articles.get(id) as IDBRequest<Kept | undefined>);
        if (!kept) continue;
        const after = withMark(kept, { kind, value });
        before.set(id, kept);
        changed.push(after);
        articles.put(after);
      }
      if (kind !== "read" || changed.length === 0) return;
      const library = await ask(tx.objectStore("about").get("library") as IDBRequest<Library | undefined>);
      if (library) tx.objectStore("about").put(countsAfter(library, before, changed), "library");
    });
    return true;
  } catch {
    return false;
  }
}

/** The server has these marks: they no longer wait, unless a later one was made since. */
export async function markSent(kind: Mark["kind"], ids: number[], at: number): Promise<void> {
  if (!keeping()) return;
  try {
    await inside(["marks"], "readwrite", async (tx) => {
      const marks = tx.objectStore("marks");
      for (const id of ids) {
        const key = `${kind}:${id}`;
        const waiting = await ask(marks.get(key) as IDBRequest<Mark | undefined>);
        if (waiting && waiting.at === at) marks.delete(key);
      }
    });
  } catch {
    // It's sent again next time, which changes nothing: the server keeps the later mark.
  }
}

async function waitingMarks(): Promise<Mark[]> {
  try {
    return await inside(["marks"], "readonly", (tx) => ask(tx.objectStore("marks").getAll() as IDBRequest<Mark[]>));
  } catch {
    return [];
  }
}

/** How the copies are fetched and marks sent: given by feeds.ts, so this file stays free of the server's details. */
export type Fetchers = {
  list: (source: Source, order: Order, after: string | null) => Promise<Page>;
  several: (ids: number[]) => Promise<FullArticle[]>;
  sendMark: (kind: Mark["kind"], ids: number[], value: boolean, at: number) => Promise<void>;
  /** Whether a failed send was the server saying no, rather than not being reached. */
  refused: (problem: unknown) => boolean;
};

let fetchers: Fetchers | undefined;
/** Bumped by `forget`, so a round of keeping that's under way stops writing. */
let generation = 0;
let running: Promise<void> | undefined;

export function useFetchers(given: Fetchers): void {
  fetchers = given;
}

/**
 * Sends the marks made without a connection, oldest first. Stops at the
 * first that can't reach the server yet; one the server refuses (it
 * answered, but not yes) is dropped, so it never holds up the rest.
 */
export async function sendWaiting(): Promise<void> {
  if (!fetchers || !keeping()) return;
  for (const part of inParts(await waitingMarks())) {
    try {
      await fetchers.sendMark(part.kind, part.ids, part.value, part.at);
    } catch (problem) {
      if (!fetchers.refused(problem)) return;
      await markSent(part.kind, part.ids, part.at);
    }
  }
}

/**
 * Brings the copies up to date: sends waiting marks, asks for the reader's
 * first 200 unread (or All, in river mode) and newest 200 starred, lets go
 * of copies no longer among them, and fetches the missing ones a few at a
 * time. Only one round runs at once; one asked for meanwhile waits for it.
 */
export function keepUpToDate(order: Order, mode: ReadingMode): Promise<void> {
  if (!keeping() || !fetchers) return Promise.resolve();
  running ??= round(fetchers, order, mode).finally(() => (running = undefined));
  return running;
}

async function firstOf(list: Fetchers["list"], source: Source, order: Order, most: number): Promise<Article[]> {
  const rows: Article[] = [];
  let after: string | null = null;
  do {
    const page: Page = await list(source, order, after);
    if (page.kept) throw new NeedsConnection("offline");
    rows.push(...page.articles);
    after = page.next;
  } while (after !== null && rows.length < most);
  return rows.slice(0, most);
}

async function round(using: Fetchers, order: Order, mode: ReadingMode): Promise<void> {
  const mine = generation;
  const still = () => mine === generation && keeping();
  try {
    await sendWaiting();
    const first = await firstOf(using.list, { view: mode === "river" ? "all" : "unread" }, order, KEEP_UNREAD);
    const starred = await firstOf(using.list, { view: "starred" }, "newest", KEEP_STARRED);
    if (!still()) return;
    const keep = toKeep(first, starred);
    const waiting = new Map((await waitingMarks()).map((mark) => [mark.key, mark]));
    const missing: number[] = [];
    await inside(["articles"], "readwrite", async (tx) => {
      const articles = tx.objectStore("articles");
      const here = (await ask(articles.getAll() as IDBRequest<Kept[]>)) ?? [];
      const have = new Set<number>();
      for (const kept of here) {
        const wanted = keep.get(kept.id);
        if (!wanted) {
          articles.delete(kept.id);
          continue;
        }
        have.add(kept.id);
        articles.put(withWaiting(refreshed(kept, wanted.row, wanted.first), waiting));
      }
      for (const id of keep.keys()) if (!have.has(id)) missing.push(id);
    });
    for (let start = 0; start < missing.length; start += AT_ONCE) {
      if (!still()) return;
      const fetched = await using.several(missing.slice(start, start + AT_ONCE));
      if (!still()) return;
      await inside(["articles"], "readwrite", (tx) => {
        for (const article of fetched) {
          const wanted = keep.get(article.id);
          if (wanted) tx.objectStore("articles").put(withWaiting({ ...article, muted: wanted.row.muted, first: wanted.first }, waiting));
        }
      });
      await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    }
  } catch {
    // No connection, or the server is busy: the copies stay as they are until the next round.
  }
}

/** Marks still waiting to be sent win over what the server said: they were made after it last heard. */
function withWaiting(kept: Kept, waiting: Map<string, Mark>): Kept {
  let result = kept;
  for (const kind of ["read", "starred"] as const) {
    const mark = waiting.get(`${kind}:${kept.id}`);
    if (mark) result = withMark(result, mark);
  }
  return result;
}
