import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Feed, Folder } from "./shapes";

const server = vi.hoisted(() => ({
  listFeeds: vi.fn(),
  unsubscribe: vi.fn(),
  resubscribe: vi.fn(),
  deleteFolder: vi.fn(),
  change: vi.fn(),
  editFeed: vi.fn(),
  saveOrder: vi.fn(),
  restoreFolders: vi.fn(),
  unsubscribeAll: vi.fn(),
}));

vi.mock("./feeds", async (actual) => ({
  ...(await actual<typeof import("./feeds")>()),
  listFeeds: server.listFeeds,
  unsubscribe: server.unsubscribe,
  resubscribe: server.resubscribe,
  deleteFolder: server.deleteFolder,
  change: server.change,
  editFeed: server.editFeed,
}));
vi.mock("./arranging", async (actual) => ({
  ...(await actual<typeof import("./arranging")>()),
  saveOrder: server.saveOrder,
}));
vi.mock("./tidy", async (actual) => ({
  ...(await actual<typeof import("./tidy")>()),
  restoreFolders: server.restoreFolders,
}));
vi.mock("./people", async (actual) => ({
  ...(await actual<typeof import("./people")>()),
  unsubscribeAll: server.unsubscribeAll,
}));
const { LoadedLibrary } = await import("./library.svelte");

function feed(id: number, unread = 0, folders: number[] = []): Feed {
  return { id, title: `Feed ${id}`, siteUrl: null, unread, folders };
}

/** An answer the test hands back when it chooses. */
function later<T>() {
  let give!: (value: T) => void;
  const promise = new Promise<T>((resolve) => (give = resolve));
  return { promise, give };
}

beforeEach(() => {
  for (const each of Object.values(server)) each.mockReset();
});

describe("the reader's library", () => {
  it("never lets a slow list from before an unsubscribe put the feed back", async () => {
    const before = later<{ feeds: Feed[]; folders: Folder[] }>();
    const after = later<{ feeds: Feed[]; folders: Folder[] }>();
    server.listFeeds.mockReturnValueOnce(before.promise).mockReturnValueOnce(after.promise);
    server.unsubscribeAll.mockResolvedValue({ left: [1] });
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

  it("catching up quietly keeps the dots as they were when the server can't answer", async () => {
    server.listFeeds.mockResolvedValueOnce({ feeds: [feed(1, 3)], folders: [] }).mockRejectedValueOnce(new Error("restarting"));
    const library = new LoadedLibrary();
    await library.loadFeeds();

    await library.catchUp();

    expect(library.feedsFailed).toBe(false);
    expect(library.feeds?.[0]?.unread).toBe(3);
  });

  it("puts a deleted folder back with its feeds, in its place, on Undo", async () => {
    const folders = [{ id: 7, name: "News" }, { id: 8, name: "Later" }];
    server.listFeeds.mockResolvedValue({ feeds: [feed(1, 0, [7]), feed(2)], folders });
    server.deleteFolder.mockResolvedValue(undefined);
    server.change.mockResolvedValue({ answer: { folder: { id: 9, name: "News" } } });
    const library = new LoadedLibrary();
    await library.loadFeeds();

    const done = await library.deleteFolder({ id: 7, name: "News" });
    if (typeof done === "string") throw new Error(done);
    expect(done.message).toBe("Deleted the folder News.");
    expect(await done.undo?.()).toBeUndefined();

    expect(server.change).toHaveBeenCalledWith("/api/folders", { name: "News", feeds: [1] });
    expect(server.saveOrder).toHaveBeenCalledWith([9, 8]);
  });

  it("orders the folders at once, and puts them back if the order can't be saved", async () => {
    const folders = [{ id: 1, name: "A" }, { id: 2, name: "B" }];
    server.listFeeds.mockResolvedValue({ feeds: [], folders });
    const library = new LoadedLibrary();
    await library.loadFeeds();

    server.saveOrder.mockResolvedValueOnce(undefined);
    const done = await library.orderFolders([2, 1], folders[1]!);
    expect(library.folders.map((each) => each.id)).toEqual([2, 1]);
    if (typeof done === "string") throw new Error(done);
    expect(done.message).toBe("Moved the folder B.");
    await done.undo?.();
    expect(library.folders.map((each) => each.id)).toEqual([1, 2]);

    server.saveOrder.mockResolvedValueOnce("trouble");
    expect(await library.orderFolders([2, 1], folders[1]!)).toBe("The folder B couldn't be moved. Try again in a moment.");
    expect(library.folders.map((each) => each.id)).toEqual([1, 2]);
  });

  it("files someone in a folder by dragging, and a folder left empty goes, coming back on Undo", async () => {
    const folders = [{ id: 7, name: "Friends" }, { id: 8, name: "Design" }];
    server.listFeeds.mockResolvedValueOnce({ feeds: [feed(1, 0, [7])], folders });
    const library = new LoadedLibrary();
    await library.loadFeeds();
    server.editFeed.mockResolvedValue(undefined);
    server.deleteFolder.mockResolvedValue(undefined);
    server.listFeeds.mockResolvedValue({ feeds: [feed(1, 0, [8])], folders });

    const done = await library.file(library.rows![0]!, folders[0]!, folders[1]!, false);
    if (typeof done !== "object") throw new Error(String(done));
    expect(server.editFeed).toHaveBeenCalledWith(1, { folders: [8] });
    expect(server.deleteFolder).toHaveBeenCalledWith(7);
    expect(done.message).toBe("Moved Feed 1 to Design. Friends went too, as it's empty.");

    server.change.mockResolvedValue({ answer: { folder: { id: 9, name: "Friends" } } });
    expect(await done.undo?.()).toBeUndefined();
    expect(server.saveOrder).toHaveBeenCalledWith([9, 8]);
    expect(server.restoreFolders).toHaveBeenCalledWith([{ id: 1, folders: [9] }]);
  });

  it("keeps someone in both folders, and changes nothing when they're already there", async () => {
    const folders = [{ id: 7, name: "Friends" }, { id: 8, name: "Design" }];
    server.listFeeds.mockResolvedValue({ feeds: [feed(1, 0, [7])], folders });
    const library = new LoadedLibrary();
    await library.loadFeeds();
    server.editFeed.mockResolvedValue(undefined);

    const kept = await library.file(library.rows![0]!, folders[0]!, folders[1]!, true);
    expect(server.editFeed).toHaveBeenCalledWith(1, { folders: [7, 8] });
    expect(typeof kept === "object" && kept.message).toBe("Added Feed 1 to Design.");
    expect(server.deleteFolder).not.toHaveBeenCalled();
    expect(await library.file(library.rows![0]!, null, folders[0]!, false)).toBeUndefined();
  });

  it("takes a publication out of a folder onto People as a person, and Undo puts back both", async () => {
    const folders = [{ id: 7, name: "News" }, { id: 8, name: "Later" }];
    const publication = { ...feed(1, 0, [7, 8]), kind: "publication" as const };
    server.listFeeds.mockResolvedValue({ feeds: [publication], folders });
    const library = new LoadedLibrary();
    await library.loadFeeds();
    server.editFeed.mockResolvedValue(undefined);

    const done = await library.file(library.rows![0]!, folders[0]!, null, false, "person");
    if (typeof done !== "object") throw new Error(String(done));
    expect(server.editFeed).toHaveBeenCalledWith(1, { folders: [8], kind: "person" });
    expect(done.message).toBe("Took Feed 1 out of News. Feed 1 is now a person.");
    await done.undo?.();
    expect(server.restoreFolders).toHaveBeenCalledWith([{ id: 1, folders: [7, 8] }]);
    expect(server.editFeed).toHaveBeenLastCalledWith(1, { kind: "publication" });
  });

  it("never says a folder went when it couldn't be deleted", async () => {
    const folders = [{ id: 7, name: "Friends" }, { id: 8, name: "Design" }];
    server.listFeeds.mockResolvedValueOnce({ feeds: [feed(1, 0, [7])], folders });
    const library = new LoadedLibrary();
    await library.loadFeeds();
    server.editFeed.mockResolvedValue(undefined);
    server.deleteFolder.mockResolvedValue("trouble");
    server.listFeeds.mockResolvedValue({ feeds: [feed(1, 0, [8])], folders });

    const done = await library.file(library.rows![0]!, folders[0]!, folders[1]!, false);
    expect(typeof done === "object" && done.message).toBe("Moved Feed 1 to Design.");
  });

  it("says why a removal or its Undo wasn't made", async () => {
    server.unsubscribeAll.mockResolvedValueOnce({ refusal: "You don't follow them any more.", left: [] });
    const library = new LoadedLibrary();
    expect(typeof (await library.unsubscribe(feed(1)))).toBe("string");

    server.unsubscribeAll.mockResolvedValueOnce({ left: [1] });
    server.listFeeds.mockResolvedValue({ feeds: [], folders: [] });
    server.resubscribe.mockResolvedValueOnce("trouble");
    const done = await library.unsubscribe(feed(1));
    if (typeof done === "string") throw new Error(done);
    expect(typeof (await done.undo?.())).toBe("string");
  });
});
