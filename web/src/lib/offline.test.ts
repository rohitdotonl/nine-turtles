import { describe, expect, it } from "vitest";
import type { Article, Library } from "./feeds";
import { offsetFrom } from "./connection.svelte";
import { KEEP_STARRED, KEEP_UNREAD, NeedsConnection, countsAfter, inParts, keptList, toKeep, withMark, type Kept } from "./offline";

function row(id: number, more: Partial<Article> = {}): Article {
  return { id, feedId: 1, feedTitle: "Garden", title: `Post ${id}`, link: null, at: id * 100, read: false, starred: false, muted: false, ...more };
}

function kept(id: number, more: Partial<Kept> = {}): Kept {
  return { ...row(id), siteUrl: null, author: null, content: "<p>Words</p>", summary: null, language: null, first: true, ...more };
}

describe("what's kept for reading offline", () => {
  it("is the first 200 of the reader's list and the newest 200 starred, each once", () => {
    const first = Array.from({ length: 250 }, (_, index) => row(index + 1));
    const starred = [row(5, { starred: true }), ...Array.from({ length: 250 }, (_, index) => row(1000 + index, { starred: true }))];
    const keep = toKeep(first, starred);
    expect(keep.size).toBe(KEEP_UNREAD + KEEP_STARRED - 1);
    expect(keep.get(5)?.first).toBe(true);
    expect(keep.has(201)).toBe(false);
    expect(keep.get(1000)?.first).toBe(false);
    expect(keep.has(1000 + KEEP_STARRED - 1)).toBe(false);
  });
});

describe("lists without a connection", () => {
  const all = [
    kept(1),
    kept(2, { read: true }),
    kept(3, { starred: true, first: false, read: true }),
    kept(4, { feedId: 2, feedTitle: "Notes" }),
    kept(5, { muted: true, starred: true, first: false }),
  ];
  const ids = (articles: Article[]) => articles.map((article) => article.id);

  it("Unread shows the kept first page still unread, in the reader's order", () => {
    expect(ids(keptList(all, { view: "unread" }, "newest"))).toEqual([4, 1]);
    expect(ids(keptList(all, { view: "unread" }, "oldest"))).toEqual([1, 4]);
  });

  it("Starred shows every starred copy, muted ones too", () => {
    expect(ids(keptList(all, { view: "starred" }, "newest"))).toEqual([5, 3]);
  });

  it("All, a feed and a folder show what's kept, never a muted one", () => {
    expect(ids(keptList(all, { view: "all" }, "newest"))).toEqual([4, 3, 2, 1]);
    expect(ids(keptList(all, { feed: 2 }, "newest"))).toEqual([4]);
    const library: Library = {
      feeds: [{ id: 2, title: "Notes", siteUrl: null, unread: 1, folders: [7], river: false, check: "automatic", openOnSite: false }],
      folders: [{ id: 7, name: "Friends" }],
    };
    expect(ids(keptList(all, { folder: 7 }, "newest", library))).toEqual([4]);
  });

  it("lists rows only, never the kept text", () => {
    expect(keptList(all, { view: "all" }, "newest")[0]).not.toHaveProperty("content");
  });

  it("search says plainly that it needs a connection", () => {
    expect(() => keptList(all, { search: { q: "garden" } }, "newest")).toThrow(NeedsConnection);
  });
});

describe("marks made without a connection", () => {
  it("show on the copy at once; marking unread unmutes, as on the server", () => {
    expect(withMark(kept(1), { kind: "read", value: true }).read).toBe(true);
    expect(withMark(kept(1, { read: true, muted: true }), { kind: "read", value: false })).toMatchObject({ read: false, muted: false });
    expect(withMark(kept(1), { kind: "starred", value: true }).starred).toBe(true);
  });

  it("are sent oldest first, those made together in one request", () => {
    const parts = inParts([
      { key: "read:2", kind: "read", id: 2, value: true, at: 20 },
      { key: "read:1", kind: "read", id: 1, value: true, at: 10 },
      { key: "read:3", kind: "read", id: 3, value: true, at: 10 },
      { key: "starred:1", kind: "starred", id: 1, value: true, at: 15 },
    ]);
    expect(parts).toEqual([
      { kind: "read", value: true, at: 10, ids: [1, 3] },
      { kind: "starred", value: true, at: 15, ids: [1] },
      { kind: "read", value: true, at: 20, ids: [2] },
    ]);
  });

  it("move the kept sidebar counts, never below nothing and never for a feed that flows past", () => {
    const library: Library = {
      feeds: [
        { id: 1, title: "Garden", siteUrl: null, unread: 1, folders: [], river: false, check: "automatic", openOnSite: false },
        { id: 2, title: "River", siteUrl: null, unread: 0, folders: [], river: true, check: "automatic", openOnSite: false },
      ],
      folders: [],
    };
    const before = new Map([
      [1, kept(1)],
      [2, kept(2)],
      [3, kept(3, { feedId: 2 })],
    ]);
    const after = countsAfter(library, before, [kept(1, { read: true }), kept(2, { read: true }), kept(3, { feedId: 2, read: true })]);
    expect(after.feeds.map((feed) => feed.unread)).toEqual([0, 0]);
  });
});

describe("the server's clock", () => {
  it("is followed only when it's clearly apart, not for the Date header's rounding", () => {
    expect(offsetFrom(1_000_000, 1_000_600, 0)).toBe(0);
    expect(offsetFrom(1_300_000, 1_000_000, 0)).toBe(300_000);
    expect(offsetFrom(1_300_000, 1_000_500, 300_000)).toBe(300_000);
  });
});
