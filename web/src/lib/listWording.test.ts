import { describe, expect, it } from "vitest";
import { emptyText, insteadOfList, missingFrom, nothingFound, NOT_FOUND, type Found } from "./listWording";

/** Everything loaded, and the place the address names is one the reader has. */
function found(changes: Partial<Found> = {}): Found {
  return {
    feeds: true,
    feed: true,
    folder: true,
    search: true,
    collection: true,
    searchesLoaded: true,
    searchesFailed: false,
    collectionsLoaded: true,
    collectionsFailed: false,
    ...changes,
  };
}

describe("missingFrom", () => {
  it("names nothing missing for a place the reader has, or a view", () => {
    expect(missingFrom({ kind: "feed", id: 1 }, found())).toBeUndefined();
    expect(missingFrom({ kind: "view", view: "unread" }, found({ feed: false, folder: false }))).toBeUndefined();
  });

  it("names a feed, folder, saved search or collection the reader doesn't have, under its Edit sheet too", () => {
    expect(missingFrom({ kind: "feed", id: 1 }, found({ feed: false }))).toBe("feed");
    expect(missingFrom({ kind: "edit-feed", id: 1 }, found({ feed: false }))).toBe("feed");
    expect(missingFrom({ kind: "folder", id: 1 }, found({ folder: false }))).toBe("folder");
    expect(missingFrom({ kind: "edit-folder", id: 1 }, found({ folder: false }))).toBe("folder");
    expect(missingFrom({ kind: "search", id: 1 }, found({ search: false }))).toBe("search");
    expect(missingFrom({ kind: "edit-search", id: 1 }, found({ search: false }))).toBe("search");
    expect(missingFrom({ kind: "collection", id: 1 }, found({ collection: false }))).toBe("collection");
  });

  it("waits until it can know", () => {
    expect(missingFrom({ kind: "feed", id: 1 }, found({ feeds: false, feed: false }))).toBeUndefined();
    expect(missingFrom({ kind: "search", id: 1 }, found({ searchesLoaded: false, search: false }))).toBeUndefined();
    expect(missingFrom({ kind: "collection", id: 1 }, found({ collectionsLoaded: false, collection: false }))).toBeUndefined();
  });

  it("doesn't call a saved search or collection missing when the list of them couldn't be loaded", () => {
    expect(missingFrom({ kind: "search", id: 1 }, found({ searchesFailed: true, search: false }))).toBeUndefined();
    expect(missingFrom({ kind: "collection", id: 1 }, found({ collectionsFailed: true, collection: false }))).toBeUndefined();
  });
});

describe("insteadOfList", () => {
  it("shows the list when there's nothing to say", () => {
    expect(insteadOfList({ kind: "feed", id: 1 }, found())).toBeUndefined();
    expect(insteadOfList({ kind: "view", view: "all" }, found())).toBeUndefined();
  });

  it("says why a missing place shows no list, with its own heading", () => {
    expect(insteadOfList({ kind: "feed", id: 1 }, found({ feed: false }))).toBe("You don't follow anyone at this address. It may have been an old one.");
    // Their page, Edit and a source's settings too, so a phone never falls back to another list (SPEC section 36).
    for (const place of [{ kind: "about", id: 1 }, { kind: "edit-feed", id: 1 }, { kind: "edit-source", id: 1, source: 2 }] as const)
      expect(insteadOfList(place, found({ feed: false }))).toBe("You don't follow anyone at this address. It may have been an old one.");
    expect(insteadOfList({ kind: "folder", id: 1 }, found({ folder: false }))).toBe("There's no folder here. It may have been deleted or renamed.");
    expect(insteadOfList({ kind: "search", id: 1 }, found({ search: false }))).toBe("There's no saved search here. It may have been deleted.");
    expect(insteadOfList({ kind: "collection", id: 1 }, found({ collection: false }))).toBe("There's no collection here. It may have been deleted.");
    expect(NOT_FOUND.search).toBe("Saved search not found");
  });

  it("says when saved searches or collections couldn't be loaded", () => {
    expect(insteadOfList({ kind: "search", id: 1 }, found({ searchesFailed: true, search: false }))).toBe("Your saved searches couldn't be loaded. Reload the page to try again.");
    expect(insteadOfList({ kind: "collection", id: 1 }, found({ collectionsFailed: true, collection: false }))).toBe("Your collections couldn't be loaded. Reload the page to try again.");
    // A saved search already known still runs.
    expect(insteadOfList({ kind: "search", id: 1 }, found({ searchesFailed: true }))).toBeUndefined();
  });
});

describe("emptyText", () => {
  it("says each empty list in one pattern, with how to start only where there's something to do", () => {
    expect(emptyText({ kind: "view", view: "unread" })).toEqual({ fact: "Nothing unread." });
    expect(emptyText({ kind: "view", view: "recent" })).toEqual({ fact: "Articles you open will show here." });
    expect(emptyText({ kind: "folder", id: 2 })).toEqual({ fact: "Nothing in this folder yet." });
    expect(emptyText({ kind: "view", view: "starred" })).toEqual({ fact: "Nothing starred yet.", how: "Press the star on any article to keep it here." });
    expect(emptyText({ kind: "collection", id: 3 })).toEqual({ fact: "Nothing in this collection yet.", how: "Add an article from its More menu." });
    expect(emptyText({ kind: "view", view: "all" })).toEqual({ fact: "No articles yet." });
  });

  it("says when an empty feed was last checked, and nothing more until it has been", () => {
    const now = new Date(2026, 10, 2, 18, 0);
    const today = new Date(2026, 10, 2, 14, 20).getTime() / 1000;
    const earlier = new Date(2026, 9, 3, 9, 0).getTime() / 1000;
    expect(emptyText({ kind: "feed", id: 1 }, today, now)).toEqual({ fact: "Nothing from this feed yet.", how: "Last checked today at 14:20." });
    expect(emptyText({ kind: "feed", id: 1 }, earlier, now)).toEqual({ fact: "Nothing from this feed yet.", how: "Last checked on 3 Oct." });
    expect(emptyText({ kind: "feed", id: 1 }, null, now)).toEqual({ fact: "Nothing from this feed yet." });
  });
});

describe("nothingFound", () => {
  it("says what a search looked for, and where", () => {
    expect(nothingFound(" walking ", "Starred")).toEqual({ fact: "Nothing found for “walking” in Starred." });
    expect(nothingFound("", "Unread")).toEqual({ fact: "Nothing found in Unread." });
  });
});
