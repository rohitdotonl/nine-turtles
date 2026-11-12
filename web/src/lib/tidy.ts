// Everyone you follow (SPEC section 15, decision 0186): everyone, with the
// title of their newest piece and when it came, the quiet ones saying so,
// and moving or unsubscribing from several in one go, each with one Undo.

import type { Folder } from "./shapes";
import { change, type Refusal } from "./feeds";
import { api } from "./updates.svelte";
import { isRecord, sendChange } from "./http";
import { dayOrToday } from "./times";
import { readKept, type Kept } from "./recentlyUnsubscribed";
import { toWhy, type Why } from "./sorting";

/** One row: a person with every place they were joined from, or a place on its own. */
export type Tended = {
  /** The place the row opens: a person's first place, as the sidebar's row. */
  id: number;
  /** The person's name, or the place's. */
  title: string;
  /** When its newest article was published, or null if it has none. */
  lastPosted: number | null;
  /** That article's title, if it has one. */
  lastTitle: string | null;
  /** Listed under People or Publications, as in the sidebar (decision 0163). */
  kind: "person" | "publication";
  /** nine turtles couldn't tell: it could be either, listed to settle (decision 0264); never a person joined from places. */
  open: boolean;
  /** Why it's filed so, which Undo puts back. */
  why: Why | null;
  /** Where it publishes: its website (else its feed's address), and whether that's a YouTube channel. */
  site: string;
  video: boolean;
  addedAt: number;
  /** The folders any of its places are in, by number. */
  folders: number[];
  /** Its places, each with its own folders, for Choose and Undo. */
  places: { id: number; folders: number[] }[];
};

/** A place as the server lists it, with the person it was joined into, if any. */
type Place = Omit<Tended, "places"> & { person: number | null; personName: string | null };

/** Everyone, one row per person, as the sidebar's rows (see `foldPeople`), and who's kept from recent unsubscribes. */
export async function listTended(): Promise<{ feeds: Tended[]; folders: Folder[]; kept: Kept[] }> {
  const response = await api("/api/tidy/feeds", { cache: "no-store" });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
  const body: unknown = await response.json();
  const feeds = isRecord(body) && Array.isArray(body.feeds) ? body.feeds : [];
  const folders = isRecord(body) && Array.isArray(body.folders) ? body.folders : [];
  return {
    feeds: foldPeople(
      feeds.filter(isRecord).map((feed) => ({
        id: Number(feed.id),
        title: String(feed.title ?? ""),
        lastPosted: typeof feed.last_posted === "number" ? feed.last_posted : null,
        lastTitle: typeof feed.last_title === "string" && feed.last_title.trim() !== "" ? feed.last_title.trim() : null,
        kind: feed.kind === "publication" ? "publication" : "person",
        open: feed.open === true,
        why: toWhy(feed.why),
        site: String(feed.site ?? ""),
        video: feed.video === true,
        addedAt: Number(feed.added_at ?? 0),
        folders: Array.isArray(feed.folders) ? feed.folders.map(Number) : [],
        person: typeof feed.person === "number" ? feed.person : null,
        personName: typeof feed.person_name === "string" ? feed.person_name : null,
      })),
    ),
    folders: folders.filter(isRecord).map((folder) => ({ id: Number(folder.id), name: String(folder.name ?? "") })),
    kept: readKept(isRecord(body) ? body.unsubscribed : undefined),
  };
}

/**
 * One row per person, A to Z, as `rowsOf` makes the sidebar's: a person's
 * row takes their name, their first place's number, their newest piece across
 * every place, and every folder any place is in. A place on its own is its
 * own row.
 */
export function foldPeople(places: Place[]): Tended[] {
  const rows: Tended[] = [];
  const done = new Set<number>();
  for (const place of places) {
    const { person, personName, ...own } = place;
    if (person === null) {
      rows.push({ ...own, places: [{ id: own.id, folders: own.folders }] });
      continue;
    }
    if (done.has(person)) continue;
    done.add(person);
    const theirs = places.filter((each) => each.person === person).sort((one, other) => one.addedAt - other.addedAt || one.id - other.id);
    const first = theirs[0]!;
    const newest = theirs.reduce((best, each) => ((each.lastPosted ?? -1) > (best.lastPosted ?? -1) ? each : best));
    rows.push({
      id: first.id,
      title: personName ?? first.title,
      lastPosted: newest.lastPosted,
      lastTitle: newest.lastTitle,
      kind: "person",
      open: false,
      why: null,
      site: first.site,
      video: first.video,
      addedAt: first.addedAt,
      folders: [...new Set(theirs.flatMap((each) => each.folders))],
      places: theirs.map((each) => ({ id: each.id, folders: each.folders })),
    });
  }
  return rows.sort((one, other) => one.title.localeCompare(other.title, undefined, { sensitivity: "base" }) || one.id - other.id);
}

const DAY = 24 * 60 * 60;

/**
 * Quiet: nothing new for about six months. One that has never written
 * counts from when you followed it.
 */
export function isQuiet(feed: Tended, now: number): boolean {
  const since = feed.lastPosted ?? feed.addedAt;
  return now - since >= 182 * DAY;
}

/**
 * A row's second line: their newest title and when it came ("“On walking”,
 * 4 Nov"), "Quiet since 14 Mar: “On walking”" after six months, and
 * the folders it's in after a dot.
 */
export function rowLine(feed: Tended, folders: string[], now: Date = new Date()): string {
  let line: string;
  if (feed.lastPosted === null) line = "Nothing written yet";
  else {
    const when = dayOrToday(feed.lastPosted, now);
    const title = feed.lastTitle ? `“${feed.lastTitle}”` : null;
    if (isQuiet(feed, now.getTime() / 1000)) line = title ? `Quiet since ${when}: ${title}` : `Quiet since ${when}`;
    else if (title) line = `${title}, ${when}`;
    else line = when === "today" ? "Last wrote today" : `Last wrote on ${when}`;
  }
  return folders.length > 0 ? `${line} · ${folders.join(", ")}` : line;
}

/**
 * A row's second line in the list to settle: where they publish ("YouTube
 * channel", or the website without "www."), then their newest title and
 * day: "dynomight.net · “Scattered thoughts”, 26 Oct".
 */
export function settleLine(feed: Tended, now: Date = new Date()): string {
  let where = "YouTube channel";
  if (!feed.video) {
    try {
      where = new URL(feed.site).hostname.replace(/^www\./, "");
    } catch {
      where = feed.site;
    }
  }
  if (feed.lastPosted === null || !feed.lastTitle) return where;
  return `${where} · “${feed.lastTitle}”, ${dayOrToday(feed.lastPosted, now)}`;
}

/** "6 are publications now." */
export function settledMessage(titles: string[]): string {
  return titles.length === 1 ? `${titles[0]} is a publication now.` : `${titles.length} are publications now.`;
}

/** The folders' names, A to Z as the sidebar lists them. */
export function folderNames(feed: Tended, folders: Folder[]): string[] {
  return folders.filter((folder) => feed.folders.includes(folder.id)).map((folder) => folder.name);
}

/** "Alpha", or "3". */
function howMany(titles: string[]): string {
  return titles.length === 1 && titles[0] ? titles[0] : `${titles.length}`;
}

export function movedMessage(titles: string[], folder: string | null): string {
  return folder === null ? `Took ${howMany(titles)} out of every folder.` : `Moved ${howMany(titles)} to ${folder}.`;
}

export function unsubscribedMessage(titles: string[]): string {
  return `Unsubscribed from ${howMany(titles)}.`;
}

/** Unsubscribes from every chosen feed at once. */
export async function unsubscribeAll(ids: number[]): Promise<Refusal | undefined> {
  return (await change("/api/tidy/unsubscribe", { feeds: ids })).refusal;
}

/** Undo for unsubscribing from several feeds. */
export async function resubscribeAll(ids: number[]): Promise<Refusal | undefined> {
  return (await change("/api/tidy/resubscribe", { feeds: ids })).refusal;
}

/** Bring back, under Recently unsubscribed (decision 0240): "too-many" past the most feeds a reader follows. */
export async function bringBackAll(ids: number[]): Promise<Refusal | "too-many" | undefined> {
  return (await sendChange("/api/tidy/resubscribe", { feeds: ids, bring_back: true }, ["too-late", "too-many"])).refusal;
}

/**
 * Moves the chosen feeds to one folder (a new one if `newFolder` is named),
 * or out of every folder (`folder` null). Answers the folder, and whether it
 * was made just now.
 */
export async function moveAll(
  ids: number[],
  folder: number | null,
  newFolder: string,
): Promise<{ folder: number | null; created: boolean } | Refusal> {
  const { refusal, answer } = await change("/api/tidy/move", { feeds: ids, folder, new_folder: newFolder });
  if (refusal) return refusal;
  return { folder: typeof answer?.folder === "number" ? answer.folder : null, created: answer?.created === true };
}

/** Every place of the chosen rows. */
export function placeIds(rows: Tended[]): number[] {
  return rows.flatMap((row) => row.places.map((place) => place.id));
}

/** Undo for moving: each feed goes back to the folders it was in. */
export async function restoreFolders(feeds: { id: number; folders: number[] }[]): Promise<Refusal | undefined> {
  return (await change("/api/tidy/restore", { feeds })).refusal;
}
