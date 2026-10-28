import { describe, expect, it } from "vitest";
import { listMenu, type MenuHands, type MenuScene } from "./listMenu";
import type { MenuGroup } from "./MoreMenu.svelte";

/** Unread in inbox mode, newest first, no article chosen. */
function scene(changes: Partial<MenuScene> = {}): MenuScene {
  return { river: false, searching: false, ownOrder: false, unread: true, selected: false, sort: "newest", ...changes };
}

/** Hands that write down what they were asked to do; `failSort` makes saving the sort order fail. */
function hands(failSort = false) {
  const done: unknown[][] = [];
  const note =
    (name: string) =>
    (...args: unknown[]) => {
      done.push([name, ...args]);
    };
  const given: MenuHands = {
    shortcut: (kind) => `key:${kind}`,
    markAllRead: note("markAllRead"),
    markPast: note("markPast"),
    catchUp: note("catchUp"),
    refresh: note("refresh"),
    changeSort: async (next) => {
      done.push(["changeSort", next]);
      if (failSort) throw new Error("not saved");
    },
    say: note("say"),
    holdSearch: note("holdSearch"),
    go: note("go"),
    renameCollection: note("renameCollection"),
    deleteCollection: note("deleteCollection"),
  };
  return { given, done };
}

/** The rows of the menu's `index`th group. */
function rows(groups: MenuGroup[], index: number) {
  const group = groups[index];
  if (!group) throw new Error(`no group ${index}`);
  return group.items;
}

const labels = (groups: MenuGroup[]) => groups.map((group) => group.items.map((item) => item.label));

function choose(groups: MenuGroup[], label: string) {
  const item = groups.flatMap((group) => group.items).find((each) => each.label === label);
  if (!item) throw new Error(`no row "${label}"`);
  item.onSelect();
}

describe("the list's More menu", () => {
  it("in Unread offers marking, Catch me up, Refresh and the sort order, with their keys", () => {
    const groups = listMenu(scene(), hands().given);
    expect(labels(groups)).toEqual([
      ["Mark all as read", "Catch me up", "Refresh"],
      ["Newest first", "Oldest first"],
    ]);
    expect(rows(groups, 0)[0]?.shortcut).toBe("key:mark-all-read");
    expect(groups[1]?.label).toBe("Sort order");
    expect(rows(groups, 1).map((item) => item.checked)).toEqual([true, false]);
  });

  it("puts Shift+O on the older side of the chosen article (decision 0103)", () => {
    const newest = rows(listMenu(scene({ selected: true }), hands().given), 0);
    expect(newest.map((item) => [item.label, item.shortcut])).toContainEqual(["Mark all below as read", "key:mark-older-read"]);
    expect(newest.find((item) => item.label === "Mark all above as read")?.shortcut).toBeUndefined();
    const oldest = rows(listMenu(scene({ selected: true, sort: "oldest" }), hands().given), 0);
    expect(oldest.find((item) => item.label === "Mark all above as read")?.shortcut).toBe("key:mark-older-read");
  });

  it("has no marking in river mode, and Catch me up only in Unread", () => {
    expect(labels(listMenu(scene({ river: true, selected: true }), hands().given))[0]).toEqual(["Refresh"]);
    expect(labels(listMenu(scene({ unread: false, feed: 3 }), hands().given))).toEqual([
      ["Mark all as read", "Refresh"],
      ["Newest first", "Oldest first"],
      ["Edit feed…"],
    ]);
  });

  it("in Recently read or Up Next offers Refresh alone, unless a search is showing", () => {
    expect(labels(listMenu(scene({ ownOrder: true, unread: false }), hands().given))).toEqual([["Refresh"]]);
    expect(labels(listMenu(scene({ ownOrder: true, unread: false, searching: true }), hands().given))[0]).toEqual(["Mark all as read"]);
  });

  it("in search results drops Refresh and Catch me up, and offers Save search, holding the search first", () => {
    const { given, done } = hands();
    const groups = listMenu(scene({ searching: true, selected: true }), given);
    expect(labels(groups)).toEqual([
      ["Mark all as read", "Mark all above as read", "Mark all below as read"],
      ["Newest first", "Oldest first"],
      ["Save search…"],
    ]);
    expect(rows(groups, 0).every((item) => item.shortcut === undefined || item.label === "Mark all as read")).toBe(true);
    choose(groups, "Save search…");
    expect(done).toEqual([["holdSearch"], ["go", { kind: "save-search" }]]);
  });

  it("on a saved search offers Edit saved search, even with its field emptied", () => {
    const { given, done } = hands();
    const groups = listMenu(scene({ unread: false, savedSearch: 7 }), given);
    expect(labels(groups)[2]).toEqual(["Edit saved search…"]);
    choose(groups, "Edit saved search…");
    expect(done).toEqual([["holdSearch"], ["go", { kind: "edit-search", id: 7 }]]);
  });

  it("in a collection offers Rename and Delete", () => {
    const { given, done } = hands();
    const collection = { id: 4, name: "Essays" };
    const groups = listMenu(scene({ unread: false, collection }), given);
    expect(labels(groups)[2]).toEqual(["Rename…", "Delete"]);
    choose(groups, "Rename…");
    choose(groups, "Delete");
    expect(done).toEqual([
      ["renameCollection", collection],
      ["deleteCollection", collection],
    ]);
  });

  it("in a feed's or folder's list offers Edit, with its key", () => {
    const { given, done } = hands();
    const feed = listMenu(scene({ unread: false, feed: 3 }), given);
    expect(rows(feed, 2)[0]?.shortcut).toBe("key:edit-place");
    choose(feed, "Edit feed…");
    choose(listMenu(scene({ unread: false, folder: 5 }), given), "Edit folder…");
    expect(done).toEqual([
      ["go", { kind: "edit-feed", id: 3 }],
      ["go", { kind: "edit-folder", id: 5 }],
    ]);
  });

  it("asks the list to mark, catch up or refresh when those rows are chosen", () => {
    const { given, done } = hands();
    const groups = listMenu(scene({ selected: true }), given);
    for (const label of ["Mark all as read", "Mark all above as read", "Mark all below as read", "Catch me up", "Refresh"]) choose(groups, label);
    expect(done).toEqual([["markAllRead"], ["markPast", "above"], ["markPast", "below"], ["catchUp"], ["refresh"]]);
  });

  it("shows no keys when the screen has none to show (a phone)", () => {
    const { given } = hands();
    const groups = listMenu(scene({ selected: true }), { ...given, shortcut: () => undefined });
    expect(groups.flatMap((group) => group.items).every((item) => item.shortcut === undefined)).toBe(true);
  });

  it("saves a new sort order, leaves the same one alone, and says when it couldn't save", async () => {
    const { given, done } = hands();
    choose(listMenu(scene(), given), "Newest first");
    choose(listMenu(scene(), given), "Oldest first");
    await Promise.resolve();
    expect(done).toEqual([["changeSort", "oldest"]]);

    const failing = hands(true);
    choose(listMenu(scene(), failing.given), "Oldest first");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(failing.done).toEqual([
      ["changeSort", "oldest"],
      ["say", "The sort order couldn't be saved. Try again in a moment."],
    ]);
  });
});
