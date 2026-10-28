// The reader's feeds and folders (SPEC sections 3, 5, 7 and 15): the
// sidebar's list, adding a feed, editing, unsubscribing and folder changes,
// and the words the screens say about them.
import { api } from "./updates.svelte";
import { noConnection } from "./connection.svelte";
import { keepLibrary, keptLibrary } from "./offline";
import { getJson, isRecord, sendChange } from "./http";
import { deviceJson, setDeviceText } from "./device";
import { saved } from "./saving";
import { toFeed, type Feed, type FeedSettings, type Folder, type Library } from "./shapes";

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

/** The folders open in the sidebar, as this device remembers them. */
export function savedOpenFolders(): number[] {
  const saved = deviceJson(OPEN_KEY) ?? [];
  return Array.isArray(saved) ? saved.filter((id) => typeof id === "number") : [];
}

/** Remembers which folders are open in the sidebar, on this device. */
export function saveOpenFolders(open: number[]) {
  setDeviceText(OPEN_KEY, JSON.stringify(open));
}

/**
 * What choosing a folder's name in the sidebar does: the whole row is its
 * toggle (decision 0123). Choosing the folder you're already in folds or
 * unfolds it and stays put; choosing a closed one opens it and goes there; an
 * open one elsewhere is just gone to. `plain` is false on a phone, in the
 * sidebar's search results, or with ⌘, Ctrl or Shift held (a new tab or
 * window): then it's only gone to.
 */
export function folderChoice(here: boolean, open: boolean, plain: boolean): "fold" | "open-and-go" | "go" {
  if (!plain) return "go";
  if (here) return "fold";
  return open ? "go" : "open-and-go";
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

/** A feed's unread count as the sidebar shows it: nothing for none, "999+" above 999. */
export function unreadLabel(count: number): string {
  if (count <= 0) return "";
  return count > 999 ? "999+" : String(count);
}

/**
 * A source's name as the article list shows it: a newsletter's name without
 * the sender's address that its feed title carries ("Every (hi@every.to)"
 * shows as "Every"). The address says nothing a reader needs on every row.
 */
export function plainSourceName(title: string): string {
  const plain = title.replace(/\s*[(<][^()<>\s]+@[^()<>\s]+[)>]\s*$/, "").trim();
  return plain || title;
}

/**
 * Whether a name is written in Devanagari (Hindi, Marathi, Nepali…), which
 * the sidebar sets a touch larger so it sits level with Latin names
 * (decision 0041). The script decides, not a guess at the language.
 */
export function inDevanagari(name: string): boolean {
  return /\p{Script=Devanagari}/u.test(name);
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
  return sendChange(path, body, ["no-name", "already", "too-late"]);
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
