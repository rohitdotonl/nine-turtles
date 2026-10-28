// The reader's library as the signed-in screen holds it: the feeds they
// follow and their folders, their saved searches and their collections, each
// loaded from the server and kept in order (A to Z), and the four ways to
// remove one (unsubscribe, delete a folder, a saved search or a collection),
// each answering with the list's "… · Undo" line.
//
// One is made for each signed-in screen (Shell.svelte), never shared, so
// nothing of one reader's is left for the next to see.

import { createFolder, deleteFolder, listFeeds, refused, resubscribe, unsubscribe, type Notice } from "./feeds";
import { newestAnswer } from "./inorder";
import { deleteSaved, listSaved, refusedSaving, saveSearch, type SavedSearch } from "./saved";
import { byName as collectionOrder, deleteCollection, listCollections, makeCollection, refusedCollection, type Collection } from "./collections";
import type { Feed, Folder, Library } from "./shapes";

/** A removal was made, with its line and Undo; or a sentence saying why it wasn't. */
export type Removed = Notice | string;

export class LoadedLibrary {
  /** The feeds you follow, alphabetically; unknown until the server answers. */
  feeds: Feed[] | undefined = $state();
  /** Your folders, alphabetically. */
  folders: Folder[] = $state([]);
  /** The feeds couldn't be loaded. */
  feedsFailed = $state(false);
  /** Your saved searches, alphabetically (SPEC section 14); `searchesLoaded` once the server answered. */
  searches: SavedSearch[] = $state([]);
  searchesLoaded = $state(false);
  /** The saved searches couldn't be loaded, so a saved search's address can't be told from a deleted one. */
  searchesFailed = $state(false);
  /** Your collections, A to Z (SPEC section 34); `collectionsLoaded` once the server (or this device) answered. */
  collections: Collection[] = $state([]);
  collectionsLoaded = $state(false);
  /** The collections couldn't be loaded, so a collection's address can't be told from a deleted one. */
  collectionsFailed = $state(false);

  /** Feeds, folders and collections together, as search and saved searches name them. */
  get names(): Library {
    return { feeds: this.feeds ?? [], folders: this.folders, collections: this.collections };
  }

  /** Counts changed on this screen since the page loaded; see `loadFeeds`. */
  #countChanges = 0;
  // A list asked for again before it arrives answers with the newest ask, so a
  // slow answer from before an unsubscribe can't put the feed back.
  #newestFeeds = newestAnswer(listFeeds);
  #newestSearches = newestAnswer(listSaved);
  #newestCollections = newestAnswer(listCollections);
  #searchesArrived: () => void;

  /** `searchesArrived` runs each time the saved searches have loaded (or failed to). */
  constructor(searchesArrived: () => void = () => {}) {
    this.#searchesArrived = searchesArrived;
  }

  /** Loads the feeds and folders; `then` runs in the same step as they arrive, so nothing shows in between. */
  async loadFeeds(then?: () => void) {
    try {
      // If a mark (or an undo) changes a count while the feeds are on their
      // way, the answer may predate it: ask again, so it isn't overwritten.
      for (let tries = 0; tries < 3; tries++) {
        const before = this.#countChanges;
        const loaded = await this.#newestFeeds();
        if (this.#countChanges === before || tries === 2) {
          this.feeds = loaded.feeds;
          this.folders = loaded.folders;
          then?.();
          break;
        }
      }
      this.feedsFailed = false;
    } catch {
      this.feedsFailed = true;
    }
  }

  async loadSearches() {
    try {
      this.searches = await this.#newestSearches();
      this.searchesFailed = false;
    } catch {
      // The sidebar shows no saved searches until the next try; a saved search's own address says so plainly.
      this.searchesFailed = true;
    }
    this.searchesLoaded = true;
    this.#searchesArrived();
  }

  async loadCollections() {
    try {
      this.collections = await this.#newestCollections();
      this.collectionsFailed = false;
    } catch {
      // The sidebar lists none until the next try; a collection's own address says so plainly.
      this.collectionsFailed = true;
    }
    this.collectionsLoaded = true;
  }

  /** A mark on this screen changed a feed's unread count. */
  unreadChanged(feedId: number, change: number) {
    this.#countChanges++;
    const feed = this.feeds?.find((each) => each.id === feedId);
    // A feed that flows past counts nothing.
    if (feed && !feed.river) feed.unread = Math.max(0, feed.unread + change);
  }

  /** A saved search was made or changed: it takes its place A to Z. */
  searchSaved(saved: SavedSearch) {
    this.searches = [...this.searches.filter((each) => each.id !== saved.id), saved].sort(byName);
  }

  /** A collection made in the sheet joins the sidebar at once, in its place A to Z. */
  collectionMade(made: Collection) {
    this.collections = [...this.collections.filter((each) => each.id !== made.id), made].sort(collectionOrder);
  }

  /** A collection was renamed: it moves to its new place A to Z. */
  collectionRenamed(id: number, name: string) {
    this.collections = this.collections.map((each) => (each.id === id ? { ...each, name } : each)).sort(collectionOrder);
  }

  /** Unsubscribes: "Unsubscribed from … · Undo". */
  async unsubscribe(feed: Feed): Promise<Removed> {
    const refusal = await unsubscribe(feed.id);
    if (refusal) return refused(refusal, "feed");
    await this.loadFeeds();
    return {
      message: `Unsubscribed from ${feed.title}`,
      undo: async () => {
        const problem = await resubscribe(feed.id);
        if (problem) return refused(problem, "feed");
        await this.loadFeeds();
        return undefined;
      },
    };
  }

  /** Deletes a folder (never its feeds): "Deleted the folder … · Undo", which puts its feeds, rules and saved searches back. */
  async deleteFolder(folder: Folder): Promise<Removed> {
    const inside = (this.feeds ?? []).filter((feed) => feed.folders.includes(folder.id)).map((feed) => feed.id);
    const { refusal, rules, searches } = await deleteFolder(folder.id);
    if (refusal) return refused(refusal, "folder");
    await this.loadFeeds();
    return {
      message: `Deleted the folder ${folder.name}`,
      undo: async () => {
        const problem = await createFolder(folder.name, inside, rules, searches);
        if (problem) return refused(problem, "folder");
        await this.loadFeeds();
        if (searches.length > 0) await this.loadSearches();
        return undefined;
      },
    };
  }

  /** Deletes a saved search (never an article): "Deleted the saved search … · Undo". */
  async deleteSearch(saved: SavedSearch): Promise<Removed> {
    const refusal = await deleteSaved(saved.id);
    if (refusal) return refusedSaving(refusal);
    this.searches = this.searches.filter((each) => each.id !== saved.id);
    // Asking again outranks a list already on its way from before the delete.
    void this.loadSearches();
    return {
      message: `Deleted the saved search ${saved.name}`,
      undo: async () => {
        const back = await saveSearch(saved.name, saved.query);
        if (typeof back === "string") return refusedSaving(back);
        await this.loadSearches();
        return undefined;
      },
    };
  }

  /** Deletes a collection (never an article): "Deleted the collection … · Undo", which limits its saved searches to it again. */
  async deleteCollection(collection: Collection): Promise<Removed> {
    const held = await deleteCollection(collection.id);
    if (typeof held === "string") return refusedCollection(held);
    this.collections = this.collections.filter((each) => each.id !== collection.id);
    // Asking again outranks a list already on its way from before the delete.
    void this.loadCollections();
    return {
      message: `Deleted the collection ${collection.name}`,
      undo: async () => {
        const back = await makeCollection(collection.name, held);
        if (typeof back === "string") return refusedCollection(back);
        // Its saved searches are limited to it again.
        await Promise.all([this.loadCollections(), held.searches.length > 0 ? this.loadSearches() : undefined]);
        return undefined;
      },
    };
  }
}

function byName(one: SavedSearch, other: SavedSearch): number {
  return one.name.localeCompare(other.name, undefined, { sensitivity: "base" }) || one.id - other.id;
}
