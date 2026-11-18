import { describe, expect, it } from "vitest";
import { rowsOf } from "./people";
import { pinnedRows } from "./pins";
import type { Feed } from "./shapes";

const place = (id: number, more: Partial<Feed> = {}): Feed => ({ id, title: `Place ${id}`, siteUrl: null, unread: 0, folders: [], ...more });

describe("Pinned (decision 0310)", () => {
  it("lists only the pinned rows, the first pinned first", () => {
    const rows = [place(1, { pinnedAt: 300 }), place(2), place(3, { pinnedAt: 100 }), place(4, { pinnedAt: null })];
    expect(pinnedRows(rows).map((row) => row.id)).toEqual([3, 1]);
  });

  it("pins a person's row when any place of theirs is pinned, from the earliest", () => {
    const feeds = [place(1, { person: 7, addedAt: 1, pinnedAt: 500 }), place(2, { person: 7, addedAt: 2, pinnedAt: 200 }), place(3, { pinnedAt: 300 })];
    const rows = rowsOf(feeds, [{ id: 7, name: "Mira" }]);
    expect(pinnedRows(rows).map((row) => [row.title, row.pinnedAt])).toEqual([["Mira", 200], ["Place 3", 300]]);
  });
});
