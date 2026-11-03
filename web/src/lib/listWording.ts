// What the article list says when it has nothing to show (SPEC section 6):
// an address that names a feed, folder, saved search or collection the reader
// doesn't have ("Folder not found"), a list that couldn't be loaded, and a
// place with no articles yet. The screen (`Shell.svelte`) hands over what it
// has found for the place on screen (`Found`), so every rule about which words
// show is here, in one place, and can be tested without drawing anything.
import type { Route } from "./router";
import { lastChecked } from "./times";

/** What the screen knows about the place on screen. */
export type Found = {
  /** The feeds and folders have loaded. */
  feeds: boolean;
  /** The feed, folder, saved search or collection the address names is one the reader has. */
  feed: boolean;
  folder: boolean;
  search: boolean;
  collection: boolean;
  /** The saved searches and collections have loaded, or couldn't be. */
  searchesLoaded: boolean;
  searchesFailed: boolean;
  collectionsLoaded: boolean;
  collectionsFailed: boolean;
};

/** The kind of place an address names that the reader doesn't have. */
export type Missing = "feed" | "folder" | "search" | "collection";

/**
 * Which kind of place the address names that the reader doesn't have, if any.
 * Only once it can be known: a saved search or collection that couldn't be
 * loaded isn't missing, it says so instead (`insteadOfList`).
 */
export function missingFrom(place: Route, found: Found): Missing | undefined {
  if (!found.feeds) return undefined;
  // A person's or publication's list, page, Edit or source settings (SPEC section 36).
  if (["feed", "about", "edit-feed", "edit-source"].includes(place.kind) && !found.feed) return "feed";
  if ((place.kind === "folder" || place.kind === "edit-folder") && !found.folder) return "folder";
  if ((place.kind === "search" || place.kind === "edit-search") && found.searchesLoaded && !found.searchesFailed && !found.search) return "search";
  if (place.kind === "collection" && found.collectionsLoaded && !found.collectionsFailed && !found.collection) return "collection";
  return undefined;
}

/** The list's heading for a place the reader doesn't have. */
export const NOT_FOUND: Record<Missing, string> = {
  feed: "Not found",
  folder: "Folder not found",
  search: "Saved search not found",
  collection: "Collection not found",
};

/** The line under that heading, saying why. */
const NOT_HERE: Record<Missing, string> = {
  feed: "You don't follow anyone at this address. It may have been an old one.",
  folder: "There's no folder here. It may have been deleted or renamed.",
  search: "There's no saved search here. It may have been deleted.",
  collection: "There's no collection here. It may have been deleted.",
};

/** The line the list area shows instead of a list: a place the reader doesn't have, or one that couldn't be loaded. */
export function insteadOfList(place: Route, found: Found): string | undefined {
  const missing = missingFrom(place, found);
  if (missing) return NOT_HERE[missing];
  if (place.kind === "search" && found.searchesFailed && !found.search) return "Your saved searches couldn't be loaded. Reload the page to try again.";
  if (place.kind === "collection" && found.collectionsFailed && !found.collection) return "Your collections couldn't be loaded. Reload the page to try again.";
  return undefined;
}

/**
 * What an empty list says (decision 0142): one short fact, and, only when
 * there's something to do, a quieter line saying how. Every "nothing yet"
 * is said the same way, and a feed says when it was last checked, the fact a
 * reader wonders about ("is it broken, or just quiet?").
 */
export type EmptyWords = { fact: string; how?: string };

export function emptyText(place: Route, checkedAt: number | null = null, now: Date = new Date()): EmptyWords {
  if (place.kind === "feed") return checkedAt === null ? { fact: "Nothing from this feed yet." } : { fact: "Nothing from this feed yet.", how: lastChecked(checkedAt, now) };
  if (place.kind === "folder") return { fact: "Nothing in this folder yet." };
  if (place.kind === "view" && place.view === "unread") return { fact: "Nothing unread." };
  if (place.kind === "view" && place.view === "starred") return { fact: "Nothing starred yet.", how: "Press the star on any article to keep it here." };
  if (place.kind === "view" && place.view === "recent") return { fact: "Articles you open will show here." };
  if (place.kind === "view" && place.view === "upnext") return { fact: "Nothing in Up Next.", how: "Add an episode from its More menu." };
  if (place.kind === "collection") return { fact: "Nothing in this collection yet.", how: "Add an article from its More menu." };
  return { fact: "No articles yet." };
}

/** A search that found nothing says what it looked for and where: "Nothing found for “walking” in Starred." */
export function nothingFound(words: string, where: string): EmptyWords {
  const typed = words.trim();
  return { fact: typed === "" ? `Nothing found in ${where}.` : `Nothing found for “${typed}” in ${where}.` };
}
