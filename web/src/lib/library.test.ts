import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Feed, Folder } from "./shapes";

const server = vi.hoisted(() => ({
  listFeeds: vi.fn(),
  unsubscribe: vi.fn(),
  resubscribe: vi.fn(),
  deleteFolder: vi.fn(),
  createFolder: vi.fn(),
  listSaved: vi.fn(),
  deleteSaved: vi.fn(),
  saveSearch: vi.fn(),
  listCollections: vi.fn(),
  deleteCollection: vi.fn(),
  makeCollection: vi.fn(),
}));

vi.mock("./feeds", async (actual) => ({
  ...(await actual<typeof import("./feeds")>()),
  listFeeds: server.listFeeds,
  unsubscribe: server.unsubscribe,
  resubscribe: server.resubscribe,
  deleteFolder: server.deleteFolder,
  createFolder: server.createFolder,
}));
vi.mock("./saved", async (actual) => ({
  ...(await actual<typeof import("./saved")>()),
  listSaved: server.listSaved,
  deleteSaved: server.deleteSaved,
  saveSearch: server.saveSearch,
}));
vi.mock("./collections", async (actual) => ({
  ...(await actual<typeof import("./collections")>()),
  listCollections: server.listCollections,
  deleteCollection: server.deleteCollection,
  makeCollection: server.makeCollection,
}));

const { LoadedLibrary } = await import("./library.svelte");

function feed(id: number, unread = 0, folders: number[] = []): Feed {
  return { id, title: `Feed ${id}`, siteUrl: null, unread, folders, river: false, check: "automatic", openOnSite: false };
}

/** An answer the test hands back when it chooses. */
function later<T>() {
  let give!: (value: T) => void;
  const promise = new Promise<T>((resolve) => (give = resolve));
  return { promise, give };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  for (const each of Object.values(server)) each.mockReset();
});

describe("the reader's library", () => {
  it("never lets a slow list from before an unsubscribe put the feed back", async () => {
    const before = later<{ feeds: Feed[]; folders: Folder[] }>();
    const after = later<{ feeds: Feed[]; folders: Folder[] }>();
    server.listFeeds.mockReturnValueOnce(before.promise).mockReturnValueOnce(after.promise);
    server.unsubscribe.mockResolvedValue(undefined);
    const library = new LoadedLibrary();

    const first = library.loadFeeds();
    const removing = library.unsubscribe(feed(1));
    after.give({ feeds: [feed(2)], folders: [] });
    before.give({ feeds: [feed(1), feed(2)], folders: [] });
    await Promise.all([first, removing]);

    expect(library.feeds?.map((each) => each.id)).toEqual([2]);
  });

  it("asks again when a count changed while the feeds were on their way", async () => {
    const stale = later<{ feeds: Feed[]; folders: Folder[] }>();
    server.listFeeds.mockReturnValueOnce(stale.promise).mockResolvedValueOnce({ feeds: [feed(1, 4)], folders: [] });
    const library = new LoadedLibrary();

    const loading = library.loadFeeds();
    library.unreadChanged(1, -1);
    stale.give({ feeds: [feed(1, 5)], folders: [] });
    await loading;

    expect(server.listFeeds).toHaveBeenCalledTimes(2);
    expect(library.feeds?.[0]?.unread).toBe(4);
  });

  it("puts a deleted folder back with its feeds, rules and saved searches on Undo", async () => {
    server.listFeeds.mockResolvedValue({ feeds: [feed(1, 0, [7]), feed(2)], folders: [{ id: 7, name: "News" }] });
    server.deleteFolder.mockResolvedValue({ rules: [3], searches: [9] });
    server.createFolder.mockResolvedValue(undefined);
    server.listSaved.mockResolvedValue([]);
    const library = new LoadedLibrary();
    await library.loadFeeds();

    const done = await library.deleteFolder({ id: 7, name: "News" });
    if (typeof done === "string") throw new Error(done);
    expect(done.message).toBe("Deleted the folder News");
    expect(await done.undo?.()).toBeUndefined();

    expect(server.createFolder).toHaveBeenCalledWith("News", [1], [3], [9]);
    expect(server.listSaved).toHaveBeenCalled();
  });

  it("says why a removal or its Undo wasn't made", async () => {
    server.unsubscribe.mockResolvedValueOnce("gone");
    const library = new LoadedLibrary();
    expect(typeof (await library.unsubscribe(feed(1)))).toBe("string");

    server.unsubscribe.mockResolvedValueOnce(undefined);
    server.listFeeds.mockResolvedValue({ feeds: [], folders: [] });
    server.resubscribe.mockResolvedValueOnce("trouble");
    const done = await library.unsubscribe(feed(1));
    if (typeof done === "string") throw new Error(done);
    expect(typeof (await done.undo?.())).toBe("string");
  });

  it("takes a deleted saved search off at once, and tells the screen each time searches arrive", async () => {
    const arrived = vi.fn();
    server.listSaved.mockResolvedValue([{ id: 1, name: "a", query: {} }]);
    server.deleteSaved.mockResolvedValue(undefined);
    const library = new LoadedLibrary(arrived);
    await library.loadSearches();
    expect(arrived).toHaveBeenCalledTimes(1);

    server.listSaved.mockResolvedValue([]);
    const done = await library.deleteSearch({ id: 1, name: "a", query: {} as never });
    expect(typeof done).toBe("object");
    expect(library.searches).toEqual([]);
    await settle();
    expect(arrived).toHaveBeenCalledTimes(2);
  });

  it("keeps saved searches and collections A to Z as they're made and renamed", () => {
    const library = new LoadedLibrary();
    library.searchSaved({ id: 2, name: "beta", query: {} as never });
    library.searchSaved({ id: 1, name: "Alpha", query: {} as never });
    expect(library.searches.map((each) => each.name)).toEqual(["Alpha", "beta"]);

    library.collectionMade({ id: 1, name: "Later" });
    library.collectionMade({ id: 2, name: "Keep" });
    library.collectionRenamed(2, "Zoo");
    expect(library.collections.map((each) => each.name)).toEqual(["Later", "Zoo"]);
    expect(library.names.collections).toBe(library.collections);
  });
});
