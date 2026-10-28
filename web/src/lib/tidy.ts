// Tidying many feeds at once (SPEC section 15, "Your feeds"): every feed
// with when it last posted, the quiet ones, and moving or unsubscribing from
// several feeds in one go, each with one Undo.

import type { Folder } from "./shapes";
import { change, type Refusal } from "./feeds";
import { when } from "./times";
import { api } from "./updates.svelte";
import { isRecord } from "./http";

export type Tended = {
  id: number;
  title: string;
  /** When its newest article was published, or null if it has none. */
  lastPosted: number | null;
  addedAt: number;
  /** The folders it's in, by number. */
  folders: number[];
};

/** Which feeds the page shows: all of them, or those quiet for 6 or 12 months. */
export type Showing = "all" | "6" | "12";

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
      addedAt: Number(feed.added_at ?? 0),
      folders: Array.isArray(feed.folders) ? feed.folders.map(Number) : [],
    })),
    folders: folders.filter(isRecord).map((folder) => ({ id: Number(folder.id), name: String(folder.name ?? "") })),
  };
}

const DAY = 24 * 60 * 60;

/**
 * Quiet: nothing posted for about 6 (or 12) months. A feed that has never
 * posted counts from when you added it.
 */
export function isQuiet(feed: Tended, months: 6 | 12, now: number): boolean {
  const since = feed.lastPosted ?? feed.addedAt;
  return now - since >= (months === 6 ? 182 : 365) * DAY;
}

export function shown(feeds: Tended[], showing: Showing, now: number): Tended[] {
  if (showing === "all") return feeds;
  return feeds.filter((feed) => isQuiet(feed, showing === "6" ? 6 : 12, now));
}

/** "Last posted today", "Last posted on 3 Oct 2025", or "Nothing posted yet". */
export function lastPostedWords(feed: Tended, now: Date = new Date()): string {
  if (feed.lastPosted === null) return "Nothing posted yet";
  const at = when(feed.lastPosted, now);
  return /^\d\d:\d\d$/.test(at) ? "Last posted today" : `Last posted on ${at}`;
}

/** The folders' names, A to Z as the sidebar lists them. */
export function folderNames(feed: Tended, folders: Folder[]): string[] {
  return folders.filter((folder) => feed.folders.includes(folder.id)).map((folder) => folder.name);
}

/** "Alpha", or "3 feeds". */
function howMany(titles: string[]): string {
  return titles.length === 1 && titles[0] ? titles[0] : `${titles.length} feeds`;
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
