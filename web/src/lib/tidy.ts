// Everyone you follow (SPEC section 15, decision 0186): everyone, with the
// title of their newest piece and when it came, the quiet ones saying so,
// and moving or unsubscribing from several in one go, each with one Undo.

import type { Folder } from "./shapes";
import { change, type Refusal } from "./feeds";
import { api } from "./updates.svelte";
import { isRecord } from "./http";

export type Tended = {
  id: number;
  title: string;
  /** When its newest article was published, or null if it has none. */
  lastPosted: number | null;
  /** That article's title, if it has one. */
  lastTitle: string | null;
  /** Listed under People or Publications, as in the sidebar (decision 0163). */
  kind: "person" | "publication";
  addedAt: number;
  /** The folders it's in, by number. */
  folders: number[];
};

export async function listTended(): Promise<{ feeds: Tended[]; folders: Folder[] }> {
  const response = await api("/api/tidy/feeds", { cache: "no-store" });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
  const body: unknown = await response.json();
  const feeds = isRecord(body) && Array.isArray(body.feeds) ? body.feeds : [];
  const folders = isRecord(body) && Array.isArray(body.folders) ? body.folders : [];
  return {
    feeds: feeds.filter(isRecord).map((feed) => ({
      id: Number(feed.id),
      title: String(feed.title ?? ""),
      lastPosted: typeof feed.last_posted === "number" ? feed.last_posted : null,
      lastTitle: typeof feed.last_title === "string" && feed.last_title.trim() !== "" ? feed.last_title.trim() : null,
      kind: feed.kind === "publication" ? "publication" : "person",
      addedAt: Number(feed.added_at ?? 0),
      folders: Array.isArray(feed.folders) ? feed.folders.map(Number) : [],
    })),
    folders: folders.filter(isRecord).map((folder) => ({ id: Number(folder.id), name: String(folder.name ?? "") })),
  };
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

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** "today", "4 November", or "14 March 2025", in the device's time zone. */
function day(at: number, now: Date): string {
  const date = new Date(at * 1000);
  if (date.toDateString() === now.toDateString()) return "today";
  return (date.getFullYear() === now.getFullYear() ? DAY_MONTH : DAY_MONTH_YEAR).format(date);
}

/**
 * A row's second line: their newest title and when it came ("“On walking”,
 * 4 November"), "Quiet since 14 March: “On walking”" after six months, and
 * the folders it's in after a dot.
 */
export function rowLine(feed: Tended, folders: string[], now: Date = new Date()): string {
  let line: string;
  if (feed.lastPosted === null) line = "Nothing written yet";
  else {
    const when = day(feed.lastPosted, now);
    const title = feed.lastTitle ? `“${feed.lastTitle}”` : null;
    if (isQuiet(feed, now.getTime() / 1000)) line = title ? `Quiet since ${when}: ${title}` : `Quiet since ${when}`;
    else if (title) line = `${title}, ${when}`;
    else line = when === "today" ? "Last wrote today" : `Last wrote on ${when}`;
  }
  return folders.length > 0 ? `${line} · ${folders.join(", ")}` : line;
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

/** Undo for moving: each feed goes back to the folders it was in. */
export async function restoreFolders(feeds: { id: number; folders: number[] }[]): Promise<Refusal | undefined> {
  return (await change("/api/tidy/restore", { feeds })).refusal;
}
