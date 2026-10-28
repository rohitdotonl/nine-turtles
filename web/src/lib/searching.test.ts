import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyQuery, type Query } from "./search";
import { SEARCH_AFTER, Searching } from "./searching.svelte";
import type { SavedSearch } from "./saved";

const FEED = { kind: "feed", id: 4 } as const;
const typed = (words: string): Query => ({ ...emptyQuery(FEED), words });
const SAVED: SavedSearch = { id: 9, name: "Rust", query: { ...emptyQuery({ kind: "view", view: "unread" }), words: "rust" } };

describe("searching", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts limited to where you are, with nothing searched", () => {
    const searching = new Searching(FEED);
    expect(searching.query).toEqual(emptyQuery(FEED));
    expect(searching.shown).toBeUndefined();
    expect(searching.open).toBe(false);
  });

  it("searches a moment after typing stops, and at once when asked", () => {
    const searching = new Searching(FEED);
    searching.changed(typed("ru"), false);
    searching.changed(typed("rust"), false);
    expect(searching.shown).toBeUndefined();
    expect(searching.open).toBe(true);
    vi.advanceTimersByTime(SEARCH_AFTER);
    expect(searching.shown?.words).toBe("rust");

    searching.changed(typed("go"), true);
    expect(searching.shown?.words).toBe("go");
  });

  it("emptying the field brings the place's own list back", () => {
    const searching = new Searching(FEED);
    searching.changed(typed("rust"), true);
    searching.changed(typed(""), true);
    expect(searching.shown).toBeUndefined();
  });

  it("forgets a search still waiting when it starts afresh", () => {
    const searching = new Searching(FEED);
    searching.changed(typed("rust"), false);
    searching.reset({ kind: "view", view: "starred" });
    vi.advanceTimersByTime(SEARCH_AFTER);
    expect(searching.shown).toBeUndefined();
    expect(searching.query).toEqual(emptyQuery({ kind: "view", view: "starred" }));
  });

  it("on a saved search, starts as it was saved", () => {
    const searching = new Searching(FEED);
    searching.reset({ kind: "search", id: 9 }, SAVED);
    expect(searching.query).toEqual(SAVED.query);
    expect(searching.shown).toEqual(SAVED.query);
  });

  it("a saved search with nothing to search for shows the place's own list", () => {
    const searching = new Searching(FEED);
    const empty = { ...SAVED, query: emptyQuery({ kind: "view", view: "unread" }) };
    searching.reset({ kind: "search", id: 9 }, empty);
    expect(searching.query).toEqual(empty.query);
    expect(searching.shown).toBeUndefined();
  });

  it("Escape on a saved search puts back what was saved", () => {
    const searching = new Searching(FEED);
    searching.reset({ kind: "search", id: 9 }, SAVED);
    searching.changed({ ...SAVED.query, words: "rust lang" }, true);
    searching.close({ kind: "search", id: 9 }, SAVED);
    expect(searching.query).toEqual(SAVED.query);
    expect(searching.shown).toEqual(SAVED.query);
  });

  it("puts the phone's field away only when nothing is searched", () => {
    const searching = new Searching(FEED);
    expect(searching.putAway()).toBe(false);
    searching.started();
    searching.changed(typed("rust"), false);
    expect(searching.putAway()).toBe(false);
    searching.changed(typed(""), true);
    expect(searching.putAway()).toBe(true);
    expect(searching.open).toBe(false);
  });

  it("Escape gives back what had the keyboard before, once", () => {
    const searching = new Searching(FEED);
    const before = {} as Element;
    searching.started(before);
    searching.started();
    searching.changed(typed("rust"), true);
    expect(searching.close(FEED)).toBe(before);
    expect(searching.open).toBe(false);
    expect(searching.close(FEED)).toBeNull();
  });

  it("saves the search showing, or else what's typed", () => {
    const searching = new Searching(FEED);
    searching.changed(typed("rust"), true);
    searching.changed(typed("rust lang"), false);
    expect(searching.toSave().words).toBe("rust");
    searching.reset(FEED);
    searching.changed(typed("go"), false);
    expect(searching.toSave().words).toBe("go");
  });

  it("holds what Save search will save, through a move to another place, until it's used", () => {
    const searching = new Searching(FEED);
    searching.changed(typed("rust"), true);
    searching.holdForSaving();
    searching.reset({ kind: "save-search" });
    expect(searching.saving?.words).toBe("rust");
    searching.saving = undefined;
    expect(searching.saving).toBeUndefined();
  });
});
