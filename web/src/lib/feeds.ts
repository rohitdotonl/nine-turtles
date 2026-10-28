// Talking to the server about feeds, folders and their articles (SPEC
// sections 3, 5 to 9, 15, 16 and 18), and the words and times the screens
// show for them.
import { HIDEABLE, type Hideable, type View } from "./router";
import type { KeyMap } from "./keyboard";
import { OtherReader, api } from "./updates.svelte";
import { noConnection, serverNow, whenBack } from "./connection.svelte";
import {
  CATCH_UP_NEEDS_CONNECTION,
  READ_PAST_NEEDS_CONNECTION,
  COLLECTIONS_NEED_CONNECTION,
  NeedsConnection,
  RECENT_NEEDS_CONNECTION,
  UP_NEXT_NEEDS_CONNECTION,
  keepLibrary,
  keptArticle,
  keptLibrary,
  keptPage,
  markSent,
  noteMark,
  sending,
  useFetchers,
} from "./offline";
import { episodeFrom, type Episode } from "./podcasts";

export type Feed = {
  id: number;
  title: string;
  siteUrl: string | null;
  /** How many of its articles are unread (none for a feed that flows past). */
  unread: number;
  /** The folders it's in, by number. */
  folders: number[];
  /** When the reader paused it (seconds since 1970), or null while it isn't paused (SPEC section 15). */
  pausedAt?: number | null;
  /**
   * When its checks began failing (seconds since 1970), while the feed health
   * page lists it as not working; null while it works (decision 0106).
   */
  failingSince?: number | null;
} & FeedSettings;

/**
 * A feed's own settings, chosen in Edit feed (SPEC section 15): it flows
 * past as in river mode (no Unread, no count), how often it may be checked,
 * and whether opening one of its articles opens the publisher's page.
 */
export type FeedSettings = { river: boolean; check: Check; openOnSite: boolean };

/** How often a feed is checked in the background: on its own rhythm, or at most hourly or daily. */
export type Check = "automatic" | "hourly" | "daily";

export type Folder = { id: number; name: string };

/** Everything the sidebar lists: feeds and folders, each A to Z; and, where search needs them, the reader's collections (decision 0108). */
export type Library = { feeds: Feed[]; folders: Folder[]; collections?: { id: number; name: string }[] };

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
  /** A rule (or the reader) muted it: only search, the Muted page and Starred show it (SPEC section 27). */
  muted: boolean;
  /**
   * A search result's line of its text around the first searched word, in
   * plain-text pieces, the searched words marked (SPEC section 14). Absent
   * outside search, and when the words were only in the title.
   */
  excerpt?: ExcerptPiece[];
  /** A podcast's episode (SPEC section 35): its row shows a small headphones mark, and its length if known. */
  episode?: boolean;
  /** How long the episode plays, in seconds, if its feed says. */
  episodeSeconds?: number | null;
  /** Only in Recently read: when the reader last opened it (seconds since 1970), for its day headings. */
  opened?: number;
};

/** A piece of a search result's excerpt: plain text, never HTML. */
export type ExcerptPiece = { text: string; match: boolean };

/** One article as the reading area shows it. `content` and `summary` are already cleaned by nine turtles. */
export type FullArticle = Article & {
  siteUrl: string | null;
  author: string | null;
  content: string | null;
  summary: string | null;
  /** The article's language (or its feed's), or null if neither says. */
  language: string | null;
  /** Its audio file, if it's a podcast's episode (SPEC section 35): played from the publisher's own address. */
  audio?: Episode | null;
};

/**
 * One page of the item list. `next` is where the next page starts, or null
 * at the end. `latest` is the newest article's number when it was loaded, to
 * ask later whether anything new has arrived.
 */
export type Page = {
  articles: Article[];
  next: string | null;
  latest: number;
  /** Listed from the copies kept on this device, without a connection (SPEC section 32). */
  kept?: boolean;
};

/**
 * Which articles a list shows: one of the views, one feed's or folder's (all
 * of them), or a search's results (`search.ts` → `searchParams`).
 */
export type Source = { view: View } | { feed: number } | { folder: number } | { collection: number } | { search: Record<string, string> };

/** The reader's sort order, shared across their devices (SPEC section 18). */
export type Order = "newest" | "oldest";

/**
 * Inbox (things to get through: the Unread view, read styling and counts) or
 * river (things flowing past: none of those). Shared across the reader's
 * devices (SPEC section 10). Read state is recorded in both.
 */
export type ReadingMode = "inbox" | "river";

/** Whether the sidebar shows unread counts in inbox mode (decision 0097). Shared across the reader's devices. */
export type Counts = "shown" | "hidden";

/** How long unread waits before it lets go by itself (decision 0097): never, the default, or a week, two or a month. */
export type LetGo = "never" | "week" | "two-weeks" | "month";

const LET_GO: LetGo[] = ["never", "week", "two-weeks", "month"];

/** Where the app opens, and where "/" leads: Unread in inbox mode, All in river mode. */
export function homeView(mode: ReadingMode): "unread" | "all" {
  return mode === "river" ? "all" : "unread";
}

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
  | "too-many"
  | "plan-ended"
  | "offline"
  | "trouble";

const PROBLEMS: Problem[] = ["not-an-address", "not-allowed", "unreachable", "not-found", "too-big", "no-feed", "too-many", "plan-ended"];

/** The sidebar's feeds and folders: from the server, or, without a connection, as this device last kept them. */
export async function listFeeds(): Promise<Library> {
  await saved();
  let body: unknown;
  try {
    body = await getJson("/api/feeds");
  } catch (problem) {
    const kept = noConnection(problem) ? await keptLibrary() : undefined;
    if (kept) return kept;
    throw problem;
  }
  const feeds = isRecord(body) && Array.isArray(body.feeds) ? body.feeds : [];
  const folders = isRecord(body) && Array.isArray(body.folders) ? body.folders : [];
  const library = {
    feeds: feeds.filter(isRecord).map(toFeed),
    folders: folders.filter(isRecord).map((folder) => ({ id: Number(folder.id), name: String(folder.name ?? "") })),
  };
  keepLibrary(library);
  return library;
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

/**
 * Shift+J and Shift+K (decision 0110): the feed after (1) or before (-1)
 * the place you're in, in the sidebar's order: folders A to Z, each with its
 * feeds while it's open, then the feeds in no folder. Feeds in a folded
 * folder are passed over, as you can't see them; a feed in two folders
 * counts once, where it's first listed. Folders, saved searches and Unread,
 * Starred and All aren't stops: from a folder the next feed is the first
 * listed after it, and from the places above the folders (Unread, Starred,
 * All, a saved search) Shift+J goes to the first feed and Shift+K to none.
 * At either end nothing happens: the list ends.
 */
export function feedNextTo(library: Library, open: number[], here: { kind: string; id?: number }, step: 1 | -1): number | undefined {
  const rows: ({ folder: number } | { feed: number })[] = [];
  const seen = new Set<number>();
  for (const folder of library.folders) {
    rows.push({ folder: folder.id });
    if (!open.includes(folder.id)) continue;
    for (const feed of library.feeds) {
      if (!feed.folders.includes(folder.id) || seen.has(feed.id)) continue;
      seen.add(feed.id);
      rows.push({ feed: feed.id });
    }
  }
  for (const feed of library.feeds) if (feed.folders.length === 0 && !seen.has(feed.id)) rows.push({ feed: feed.id });

  let at = -1;
  if (here.kind === "feed") {
    at = rows.findIndex((row) => "feed" in row && row.feed === here.id);
    // A feed in a folded folder: from that folder's row.
    const feed = library.feeds.find((each) => each.id === here.id);
    if (at === -1 && feed) at = rows.findIndex((row) => "folder" in row && feed.folders.includes(row.folder));
  } else if (here.kind === "folder") at = rows.findIndex((row) => "folder" in row && row.folder === here.id);

  for (let index = at + step; index >= 0 && index < rows.length; index += step) {
    const row = rows[index]!;
    if ("feed" in row) return row.feed;
  }
  return undefined;
}

const OPEN_KEY = "nine-turtles.open-folders";
/** Where they were saved before the rename; read when there's nothing under the new name. */
const OLD_OPEN_KEY = "slowfeed.open-folders";

/** The folders open in the sidebar, as this device remembers them. */
export function savedOpenFolders(): number[] {
  try {
    const saved: unknown = JSON.parse(globalThis.localStorage?.getItem(OPEN_KEY) ?? globalThis.localStorage?.getItem(OLD_OPEN_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter((id) => typeof id === "number") : [];
  } catch {
    return [];
  }
}

/** Remembers which folders are open in the sidebar, on this device. */
export function saveOpenFolders(open: number[]) {
  try {
    globalThis.localStorage?.setItem(OPEN_KEY, JSON.stringify(open));
  } catch {
    // Not remembered on this device; the folder still opens.
  }
}

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

// Marks are sent one after another, in the order they were made, so an undo
// can never overtake the mark it undoes. Lists and counts wait for them, so
// a list opened next already shows them; articles themselves never wait, so
// a slow save can't hold up reading. While nine turtles is out of reach and
// marks are waiting to try again, nothing waits for them: lists would fail
// anyway, and say so, rather than hang.
let writes: Promise<unknown> = Promise.resolve();

/** How many marks are still on their way: not yet saved, and not yet failed. A tab only switches to a new version once there are none. */
let unsavedMarks = 0;

/** Whether marks are still on their way to the server. */
export function marksUnsaved(): boolean {
  return unsavedMarks > 0;
}

/** Whether a save is waiting to try again, and who to tell when one starts. */
let retrying = false;
const waitingForSaves = new Set<() => void>();

/** Waits until every mark sent so far has been saved (or has failed), or until saving has to wait to try again. */
export function saved(): Promise<unknown> {
  if (retrying) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      waitingForSaves.delete(done);
      resolve(undefined);
    };
    waitingForSaves.add(done);
    writes.then(done);
  });
}

/**
 * How long saves keep trying while nine turtles can't be reached: about a
 * minute, longer than the server takes to restart when a new version goes
 * live, so a mark made in that moment is saved, not lost. The minute counts
 * from when the mark was made, not from its first try, so marks queued
 * behind one another never add their minutes up.
 */
export const KEEP_TRYING_FOR = 60_000;
/** The pauses between tries, the last repeating; never past the minute. */
export const RETRY_AFTER = [1_000, 2_000, 4_000, 8_000, 15_000];
const LAST_PAUSE = 15_000;

/**
 * Answers meaning "nine turtles is out of reach for a moment" (a restart, or
 * the host's front door between it and you), worth trying again. Any other
 * answer is final.
 */
const OUT_OF_REACH = new Set([502, 503, 504]);

/** The server answered, but not with yes. */
export class Refused extends Error {
  constructor(readonly status: number) {
    super(`nine turtles answered ${status}`);
  }
}

/** Whether a failed save is worth trying again: the connection, a timeout or a restart, never a refusal. */
export function worthRetrying(problem: unknown): boolean {
  // Another reader is signed in on this browser: no try from this tab will be taken.
  if (problem instanceof OtherReader) return false;
  return !(problem instanceof Refused) || OUT_OF_REACH.has(problem.status);
}

function send(path: string, body: unknown): Promise<void> {
  const giveUpAt = Date.now() + KEEP_TRYING_FOR;
  const once = async () => {
    const response = await api(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      // A try that hangs counts as failed, so the next one can start.
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Refused(response.status);
  };
  const sent = writes.then(async () => {
    for (let tries = 0; ; tries++) {
      try {
        return await once();
      } catch (problem) {
        if (!worthRetrying(problem)) throw problem;
        const left = giveUpAt - Date.now();
        if (left <= 0) throw problem;
        retrying = true;
        for (const done of [...waitingForSaves]) done();
        try {
          await new Promise((resolve) => setTimeout(resolve, Math.min(left, RETRY_AFTER[tries] ?? LAST_PAUSE)));
        } finally {
          retrying = false;
        }
      }
    }
  });
  unsavedMarks++;
  const settled = () => void unsavedMarks--;
  sent.then(settled, settled);
  writes = sent.catch(() => undefined);
  return sent;
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

/** How often a feed posts, in plain words ("Posts about 3 times a week"), or nothing if it can't be said just now (decision 0105). */
export async function feedFrequency(id: number): Promise<string | undefined> {
  try {
    const body = await getJson(`/api/feeds/${id}/frequency`);
    return isRecord(body) && typeof body.words === "string" ? body.words : undefined;
  } catch {
    return undefined;
  }
}

/** Marks articles read or unread. The screen has already changed; this tells the server. */
export function markRead(ids: number[], read: boolean): Promise<void> {
  return sendMark("read", ids, read, serverNow());
}

/** Stars or unstars articles. The screen has already changed; this tells the server. */
export function markStarred(ids: number[], starred: boolean): Promise<void> {
  return sendMark("starred", ids, starred, serverNow());
}

/**
 * Sends a mark, saying when it was made, so the latest mark wins (decision
 * 0101). It's written down on this device first: if there's no connection,
 * it waits there and is sent once there is (SPEC section 32), rather than
 * being taken back. Without a connection, nothing is tried until then.
 */
function sendMark(kind: "read" | "starred", ids: number[], value: boolean, at: number): Promise<void> {
  const noted = noteMark(kind, ids, value, at);
  const path = kind === "read" ? "/api/articles/read" : "/api/articles/starred";
  const body = kind === "read" ? { ids, read: value, at } : { ids, starred: value, at };
  const offline = globalThis.navigator?.onLine === false;
  const done = sending(kind, ids, at);
  const sent = offline ? Promise.reject(new TypeError("offline")) : send(path, body);
  sent.then(done, done);
  return sent.then(
    async () => {
      await noted;
      await markSent(kind, ids, at);
    },
    async (problem) => {
      if (noConnection(problem) && (await noted)) return;
      await noted;
      await markSent(kind, ids, at);
      throw problem;
    },
  );
}

/** The settings shared across the reader's devices (SPEC section 18). */
/** `letGo` is unknown when the server can't say, so its choices wait rather than show Never. */
export type Reading = {
  sort: Order;
  mode: ReadingMode;
  counts: Counts;
  letGo: LetGo | undefined;
  keys: KeyMap;
  hidden: Hideable[];
};

/**
 * The settings shared across the reader's devices: the sort order, the
 * reading mode, whether unread counts show, when unread lets go, the keys
 * the reader chose and which lists the sidebar hides. Newest first if the
 * server can't say, the wait unknown, and the mode, counts, keys and hidden
 * lists this device last saw (inbox, shown, nine turtles' own keys, none,
 * if none).
 */
export async function loadSettings(): Promise<Reading> {
  try {
    const body = await getJson("/api/settings");
    const sort = isRecord(body) && body.sort === "oldest" ? "oldest" : "newest";
    const mode = isRecord(body) && body.mode === "river" ? "river" : "inbox";
    const counts = isRecord(body) && body.counts === "hidden" ? "hidden" : "shown";
    const letGo = (isRecord(body) && LET_GO.find((value) => value === body.let_go)) || "never";
    const keys = keysFrom(isRecord(body) ? body.keys : undefined);
    const hidden = isRecord(body) ? hiddenFrom(body.hidden) : [];
    rememberMode(mode);
    rememberCounts(counts);
    rememberKeys(keys);
    rememberHidden(hidden);
    return { sort, mode, counts, letGo, keys, hidden };
  } catch {
    return { sort: "newest", mode: lastMode(), counts: lastCounts(), letGo: undefined, keys: lastKeys(), hidden: lastHidden() };
  }
}

/** The reader's keys, from the server or this device's copy: names and keys only, anything else left out. */
function keysFrom(value: unknown): KeyMap {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

/** Saves the reader's keys, all of them at once (decision 0110): `{}` puts every key back. */
export async function saveKeys(keys: KeyMap): Promise<void> {
  await send("/api/settings", { keys });
  rememberKeys(keys);
}
const KEYS_KEY = "nine-turtles.keys";

/** The keys this device last saw, so a changed key works from the first press, before the server answers, and offline. */
export function lastKeys(): KeyMap {
  try {
    return keysFrom(JSON.parse(globalThis.localStorage?.getItem(KEYS_KEY) ?? "{}"));
  } catch {
    return {};
  }
}

/** Signed out: this device forgets the keys, so whoever signs in next starts from their own (or nine turtles'). */
export function forgetKeys() {
  try {
    globalThis.localStorage?.removeItem(KEYS_KEY);
  } catch {
    // Private browsing: nothing was kept.
  }
}

/** The hidden lists named, in one order; anything else is left out. */
export function hiddenFrom(value: unknown): Hideable[] {
  if (!Array.isArray(value)) return [];
  return HIDEABLE.filter((list) => value.includes(list));
}

/** Hides lists from the sidebar, or shows them again (Settings › Show in the sidebar, decision 0105). */
export async function saveHidden(hidden: Hideable[]): Promise<void> {
  await send("/api/settings", { hidden });
  rememberHidden(hidden);
}

const HIDDEN_KEY = "nine-turtles.hidden";

/** The lists this device last saw hidden, so they don't show for a moment before the server answers. */
export function lastHidden(): Hideable[] {
  try {
    return hiddenFrom(JSON.parse(globalThis.localStorage?.getItem(HIDDEN_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

function rememberHidden(hidden: Hideable[]) {
  try {
    globalThis.localStorage?.setItem(HIDDEN_KEY, JSON.stringify(hidden));
  } catch {
    // Private browsing: the server's answer still decides, a moment later.
  }
}

function rememberKeys(keys: KeyMap) {
  try {
    globalThis.localStorage?.setItem(KEYS_KEY, JSON.stringify(keys));
  } catch {
    // Private browsing: the server's answer still decides, a moment later.
  }
}

export function saveSort(sort: Order): Promise<void> {
  return send("/api/settings", { sort });
}

export async function saveMode(mode: ReadingMode): Promise<void> {
  await send("/api/settings", { mode });
  rememberMode(mode);
}

export async function saveCounts(counts: Counts): Promise<void> {
  await send("/api/settings", { counts });
  rememberCounts(counts);
}

export function saveLetGo(letGo: LetGo): Promise<void> {
  return send("/api/settings", { let_go: letGo });
}

const COUNTS_KEY = "nine-turtles.counts";

/** Whether this device last saw the counts hidden, so they don't show for a moment before the server answers. */
export function lastCounts(): Counts {
  try {
    return globalThis.localStorage?.getItem(COUNTS_KEY) === "hidden" ? "hidden" : "shown";
  } catch {
    return "shown";
  }
}

function rememberCounts(counts: Counts) {
  try {
    globalThis.localStorage?.setItem(COUNTS_KEY, counts);
  } catch {
    // Private browsing: the server's answer still decides, a moment later.
  }
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

const MODE_KEY = "nine-turtles.mode";

/**
 * The reading mode this device last saw, so the app opens in it before the
 * server answers instead of showing Unread for a moment. The server's answer
 * decides.
 */
export function lastMode(): ReadingMode {
  try {
    return globalThis.localStorage?.getItem(MODE_KEY) === "river" ? "river" : "inbox";
  } catch {
    return "inbox";
  }
}

function rememberMode(mode: ReadingMode) {
  try {
    globalThis.localStorage?.setItem(MODE_KEY, mode);
  } catch {
    // Private windows may refuse; the server still has it.
  }
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

/** A feed's unread count as the sidebar shows it: nothing for none, "999+" above 999. */
export function unreadLabel(count: number): string {
  if (count <= 0) return "";
  return count > 999 ? "999+" : String(count);
}

/**
 * Whether a name is written in Devanagari (Hindi, Marathi, Nepali…), which
 * the sidebar sets a touch larger so it sits level with Latin names
 * (decision 0041). The script decides, not a guess at the language.
 */
export function inDevanagari(name: string): boolean {
  return /\p{Script=Devanagari}/u.test(name);
}

// Articles already fetched, so moving back and forth with j and k never
// waits. Kept small: only the last few are needed.
const loaded = new Map<number, FullArticle>();
const loading = new Map<number, Promise<FullArticle>>();
const KEEP = 20;

/** Another reader, or nobody: the articles fetched so far (with the last reader's marks) go. */
export function forgetLoaded(): void {
  loaded.clear();
  loading.clear();
}
/** Those opened from this device's copies, words only: fetched again in full once the connection is back. */
const fromDevice = new Set<number>();
whenBack(() => {
  for (const id of fromDevice) loaded.delete(id);
  fromDevice.clear();
});

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
    .then(
      (body) => {
        if (!isRecord(body) || !isRecord(body.article)) throw new Error("nine turtles sent an unexpected answer");
        return toFullArticle(body.article);
      },
      async (problem) => {
        const kept = noConnection(problem) ? await keptArticle(id) : undefined;
        if (!kept) throw problem;
        fromDevice.add(id);
        return kept;
      },
    )
    .then((article) => {
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
  } catch (problem) {
    return { kind: "problem", reason: noConnection(problem) ? "offline" : "trouble" };
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

/** What looking at a shared page found: its feeds to choose from, a problem to say, or nothing to say ("quiet"). */
export type FindResult = { kind: "found"; choices: Choice[] } | { kind: "problem"; reason: Problem } | { kind: "quiet" };

/**
 * Looks for the feeds a shared page names, without following any (decision
 * 0104): the feed finder's lookup (decision 0099), the same autodiscovery as
 * Add feed. When the finder is busy, or can't be reached, it says nothing:
 * the address stays in the field for the reader to add as usual.
 */
export async function findFeeds(address: string): Promise<FindResult> {
  let response: Response;
  try {
    response = await api(`/api/find-feeds?address=${encodeURIComponent(address)}`, { cache: "no-store" });
  } catch {
    return { kind: "quiet" };
  }
  const body: unknown = await response.json().catch(() => null);
  if (!isRecord(body)) return { kind: "quiet" };
  if (Array.isArray(body.feeds)) {
    const choices = body.feeds.filter(isRecord).map((choice) => ({
      title: String(choice.title ?? ""),
      url: String(choice.url ?? ""),
    }));
    return choices.length > 0 ? { kind: "found", choices } : { kind: "problem", reason: "no-feed" };
  }
  const reason = PROBLEMS.find((problem) => problem === body.error);
  return reason ? { kind: "problem", reason } : { kind: "quiet" };
}

/**
 * What the item list's line says on arriving, after unsubscribing or
 * deleting a folder. `undo` reverses it; it answers a problem to say, if any.
 */
export type Notice = { message: string; undo?: () => Promise<string | undefined> };

/** Why a change to feeds or folders wasn't made. */
export type Refusal = "no-name" | "already" | "too-late" | "gone" | "trouble";

/** Sends a change to feeds or folders. Unlike marks, the screen waits for the answer. */
export async function change(path: string, body: unknown): Promise<{ refusal?: Refusal; answer?: Record<string, unknown> }> {
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
export async function editFeed(
  id: number,
  title: string,
  folders: number[],
  newFolder: string,
  settings: FeedSettings & { paused: boolean },
): Promise<Refusal | undefined> {
  return (
    await change(`/api/feeds/${id}`, {
      title,
      folders,
      new_folder: newFolder,
      river: settings.river,
      check: settings.check,
      open_on_site: settings.openOnSite,
      paused: settings.paused,
    })
  ).refusal;
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

/**
 * Deletes a folder. Answers the rules that applied to it (SPEC section 27) and the saved searches that looked in it,
 * for Undo to hand back.
 */
export async function deleteFolder(id: number): Promise<{ refusal?: Refusal; rules: number[]; searches: number[] }> {
  const { refusal, answer } = await change(`/api/folders/${id}/delete`, {});
  const numbers = (list: unknown) => (Array.isArray(list) ? list.map(Number) : []);
  return { refusal, rules: numbers(answer?.rules), searches: numbers(answer?.searches) };
}

/** Creates a folder with these feeds (and rules and saved searches) in it: Undo for deleting one. */
export async function createFolder(name: string, feeds: number[], rules: number[] = [], searches: number[] = []): Promise<Refusal | undefined> {
  return (await change("/api/folders", { name, feeds, rules, searches })).refusal;
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
  if (isRecord(body) && body.error === "plan-ended") return PLAN_ENDED;
  if (isRecord(body) && body.error === "too-many") {
    return tooManyToImport(Number(body.following ?? 0), Number(body.adding ?? 0), Number(body.most ?? 1000));
  }
  if (response.status === 413) return "That file lists more feeds than nine turtles can take at once.";
  return "The file couldn't be imported. Try again in a moment.";
}

/** Why nothing was imported: the file would take the reader past the most feeds one reader can follow. */
export function tooManyToImport(following: number, adding: number, most: number): string {
  const number = new Intl.NumberFormat("en-GB");
  const feeds = (count: number) => `${number.format(count)} ${count === 1 ? "feed" : "feeds"}`;
  return `Nothing was imported. You follow ${feeds(following)}, and this file would add ${number.format(adding)} more, past the ${number.format(most)} one reader can follow.`;
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

export type StarsSummary = { starred: number; already: number; unreadable: number };

/** Imports a file of starred articles from another feed reader (SPEC section 23). A string is a problem, said plainly. */
export async function importStars(file: File): Promise<StarsSummary | string> {
  let response: Response;
  try {
    response = await api("/api/starred/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await file.text(),
    });
  } catch {
    return "The file couldn't be sent. Try again in a moment.";
  }
  const body: unknown = await response.json().catch(() => null);
  if (response.ok && isRecord(body) && isRecord(body.summary)) {
    const summary = body.summary;
    return {
      starred: Number(summary.starred ?? 0),
      already: Number(summary.already ?? 0),
      unreadable: Number(summary.unreadable ?? 0),
    };
  }
  if (isRecord(body) && body.error === "not-stars") {
    return "That file doesn't look like starred articles from a feed reader. Choose the JSON file your other app exports them in.";
  }
  if (isRecord(body) && body.error === "too-much") {
    return "Nothing was imported. With this file you'd keep more than 10,000 imported articles (or 50 MB of their text), as many as one reader can.";
  }
  if (response.status === 413) return "That file holds more than nine turtles can take at once (10,000 articles, or 25 MB).";
  return "The file couldn't be imported. Try again in a moment.";
}

/** The plain summary after importing starred articles (SPEC section 23). */
export function starsMessage(summary: StarsSummary): string[] {
  const number = new Intl.NumberFormat("en-GB");
  const articles = (count: number) => `${number.format(count)} ${count === 1 ? "article" : "articles"}`;
  const lines = [
    summary.starred === 0
      ? "No new stars were added."
      : `Starred ${articles(summary.starred)}. ${summary.starred === 1 ? "It's in Starred, with a link" : "They're in Starred, each with a link"} to the original.`,
  ];
  if (summary.already > 0) {
    lines.push(`${articles(summary.already)} ${summary.already === 1 ? "was" : "were"} starred here already.`);
  }
  if (summary.unreadable > 0) {
    lines.push(`${articles(summary.unreadable)} couldn't be brought over, as the file gives no link to the original.`);
  }
  return lines;
}

/** Adding a feed or importing, once the reader's trial or plan has ended (SPEC section 29). */
export const PLAN_ENDED = "Your free trial or plan has ended. Choose a plan in Settings to add feeds again.";

/** What the add field says when a feed couldn't be added. Plain and calm. */
export function explain(reason: Problem): string {
  switch (reason) {
    case "not-an-address":
      return "That doesn't look like a web address.";
    case "not-allowed":
      return "nine turtles can't visit that address.";
    case "unreachable":
      return "That site didn't answer. Try again later.";
    case "not-found":
      return "Nothing was found at that address.";
    case "too-big":
      return "That file is too big to be a feed.";
    case "no-feed":
      return "This site doesn't seem to offer a feed. Try the feed's own address, or the site's home page.";
    case "too-many":
      return "You follow 1,000 feeds, as many as one reader can. Unsubscribe from one to add another.";
    case "plan-ended":
      return PLAN_ENDED;
    case "offline":
      return "Adding a feed needs a connection. Try again once you're back online.";
    case "trouble":
      return "nine turtles couldn't add that just now. Try again in a moment.";
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

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "long" });
const LONG_DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" });
const LONG_DAY_AND_YEAR = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

/**
 * Recently read's quiet day headings (SPEC section 5), by the device's own
 * calendar: "Today", "Yesterday", then the weekday for the rest of the last
 * week ("Monday"), then the date ("12 October", with the year when it isn't
 * this one). Never a count.
 */
export function dayHeading(at: number, now: Date = new Date()): string {
  const date = new Date(at * 1000);
  const day = (moment: Date) => Date.UTC(moment.getFullYear(), moment.getMonth(), moment.getDate()) / 86_400_000;
  const ago = day(now) - day(date);
  if (ago <= 0) return "Today";
  if (ago === 1) return "Yesterday";
  if (ago < 7) return WEEKDAY.format(date);
  return (date.getFullYear() === now.getFullYear() ? LONG_DAY : LONG_DAY_AND_YEAR).format(date);
}

/** When a paused feed was paused, for Edit feed: "Paused today.", "Paused on 23 Oct." (SPEC section 15). */
export function pausedSince(at: number, now: Date = new Date()): string {
  const date = new Date(at * 1000);
  const sameDay =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) return "Paused today.";
  return `Paused on ${(date.getFullYear() === now.getFullYear() ? DAY : DAY_AND_YEAR).format(date)}.`;
}

async function getJson(path: string): Promise<unknown> {
  const response = await api(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
  return response.json();
}

export function toArticle(article: Record<string, unknown>): Article {
  return {
    id: Number(article.id),
    feedId: Number(article.feed_id),
    feedTitle: String(article.feed_title ?? ""),
    title: String(article.title ?? ""),
    link: text(article.link),
    at: Number(article.at),
    read: article.read === true,
    starred: article.starred === true,
    muted: article.muted === true,
    ...(Array.isArray(article.excerpt) ? { excerpt: toExcerpt(article.excerpt) } : {}),
    ...(typeof article.opened === "number" ? { opened: article.opened } : {}),
    ...(article.episode === true || typeof article.episode_url === "string"
      ? { episode: true, episodeSeconds: typeof article.episode_seconds === "number" ? article.episode_seconds : null }
      : {}),
  };
}

/** Only well-formed pieces, each kept as text. */
export function toExcerpt(pieces: unknown[]): ExcerptPiece[] {
  return pieces.filter(isRecord).map((piece) => ({ text: String(piece.text ?? ""), match: piece.match === true }));
}

function toFullArticle(article: Record<string, unknown>): FullArticle {
  return {
    ...toArticle(article),
    siteUrl: text(article.site_url),
    author: text(article.author),
    content: text(article.content),
    summary: text(article.summary),
    language: text(article.language),
    audio: episodeFrom(article),
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
    river: feed.river === true,
    check: checkFrom(Number(feed.check_at_most ?? 0)),
    openOnSite: feed.open_on_site === true,
    pausedAt: typeof feed.paused_at === "number" ? feed.paused_at : null,
    failingSince: typeof feed.failing_since === "number" ? feed.failing_since : null,
  };
}

/** The server keeps the shortest wait in seconds: 0, an hour or a day. */
export function checkFrom(seconds: number): Check {
  if (seconds >= 24 * 60 * 60) return "daily";
  if (seconds >= 60 * 60) return "hourly";
  return "automatic";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
