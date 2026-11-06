import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Feed, Folder } from "./shapes";

const server = vi.hoisted(() => ({
  listFeeds: vi.fn(),
  unsubscribe: vi.fn(),
  resubscribe: vi.fn(),
  deleteFolder: vi.fn(),
  createFolder: vi.fn(),
  unsubscribeAll: vi.fn(),
}));

vi.mock("./feeds", async (actual) => ({
  ...(await actual<typeof import("./feeds")>()),
  listFeeds: server.listFeeds,
  unsubscribe: server.unsubscribe,
  resubscribe: server.resubscribe,
  deleteFolder: server.deleteFolder,
  createFolder: server.createFolder,
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

  it("puts a deleted folder back with its feeds on Undo", async () => {
    server.listFeeds.mockResolvedValue({ feeds: [feed(1, 0, [7]), feed(2)], folders: [{ id: 7, name: "News" }] });
    server.deleteFolder.mockResolvedValue(undefined);
    server.createFolder.mockResolvedValue(undefined);
    const library = new LoadedLibrary();
    await library.loadFeeds();

    const done = await library.deleteFolder({ id: 7, name: "News" });
    if (typeof done === "string") throw new Error(done);
    expect(done.message).toBe("Deleted the folder News.");
    expect(await done.undo?.()).toBeUndefined();

    expect(server.createFolder).toHaveBeenCalledWith("News", [1]);
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
