import { describe, expect, it } from "vitest";
import { emptyText, insteadOfList, missingFrom, NOT_FOUND, type Found } from "./listWording";

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
    expect(insteadOfList({ kind: "feed", id: 1 }, found({ feed: false }))).toBe("You don't follow this feed. It may have been an old address.");
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
  it("says plainly what each empty list would hold", () => {
    expect(emptyText({ kind: "view", view: "unread" })).toBe("Nothing unread.");
    expect(emptyText({ kind: "view", view: "recent" })).toBe("Articles you open will show here.");
    expect(emptyText({ kind: "feed", id: 1 })).toBe("This feed has no articles yet.");
    expect(emptyText({ kind: "view", view: "all" })).toBe("No articles yet.");
  });
});
