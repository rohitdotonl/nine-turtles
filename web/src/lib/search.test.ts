import { describe, expect, it } from "vitest";
import type { Library } from "./shapes";
import {
  boldParts,
  chipsFor,
  emptyQuery,
  isSearching,
  resultsTitle,
  searchParams,
  searchedTerms,
  withoutChip,
  type Query,
} from "./search";

const library: Library = {
  feeds: [
    { id: 1, title: "Garden Notes", siteUrl: null, unread: 0, folders: [7] },
    { id: 2, title: "Gardening Weekly", siteUrl: null, unread: 0, folders: [] },
    { id: 3, title: "हिंदी कविता", siteUrl: null, unread: 0, folders: [] },
  ],
  folders: [{ id: 7, name: "Tech" }],
};

const all: Query = emptyQuery({ kind: "view", view: "all" });

describe("the results' title", () => {
  it("says where the search looks: All articles, or the feed, folder or view", () => {
    expect(resultsTitle({ kind: "all" }, library)).toBe("Results in All articles");
    expect(resultsTitle({ kind: "feed", id: 1 }, library)).toBe("Results in Garden Notes");
    expect(resultsTitle({ kind: "folder", id: 7 }, library)).toBe("Results in Tech");
    expect(resultsTitle({ kind: "view", view: "starred" }, library)).toBe("Results in Starred");
  });
});

describe("chips", () => {
  it("say what's searched in plain words, as the options menu names it", () => {
    const query: Query = { ...all, unread: true, starred: true, after: "2026-10-01", before: "2026-03-01" };
    expect(chipsFor(query, library).map((chip) => chip.label)).toEqual(["Unread", "Starred", "After 1 Oct 2026", "Before 1 Mar 2026"]);
  });
});

describe("where a search starts", () => {
  it("is limited to where you are, shown as a chip", () => {
    const query = emptyQuery({ kind: "folder", id: 7 });
    expect(chipsFor(query, library)).toEqual([{ key: "scope", label: "in: Tech" }]);
    expect(chipsFor(emptyQuery({ kind: "view", view: "unread" }), library)).toEqual([{ key: "scope", label: "in: Unread" }]);
    expect(chipsFor(all, library)).toEqual([]);
  });

  it("covers everything once the chip is removed", () => {
    const query = withoutChip(emptyQuery({ kind: "feed", id: 1 }), "scope");
    expect(query.scope).toEqual({ kind: "all" });
    expect(searchParams({ ...query, words: "tomatoes" })).toEqual({ q: "tomatoes" });
  });

  it("isn't a search until something is typed or filtered", () => {
    expect(isSearching(emptyQuery({ kind: "folder", id: 7 }))).toBe(false);
    expect(isSearching({ ...all, words: " " })).toBe(false);
    expect(isSearching({ ...all, words: "slow" })).toBe(true);
    expect(isSearching({ ...all, starred: true })).toBe(true);
  });
});

describe("what the server is asked", () => {
  it("takes what's typed as plain words: nothing is a filter any more (decision 0180)", () => {
    expect(searchParams({ ...all, words: "  is:starred   feed:x " }).q).toBe("is:starred feed:x");
    expect(searchParams({ ...all, words: "is:starred" }).starred).toBeUndefined();
  });


  it("includes the view a search started in", () => {
    expect(searchParams({ ...emptyQuery({ kind: "view", view: "unread" }), words: "slow" })).toEqual({
      q: "slow",
      unread: "true",
    });
    expect(searchParams({ ...emptyQuery({ kind: "folder", id: 7 }), words: "x", starred: true })).toEqual({
      q: "x",
      folder: "7",
      starred: "true",
    });
  });

  it("turns dates into this device's days: after the whole day, before its start", () => {
    const params = searchParams({ ...all, after: "2026-01-31", before: "2026-03-01" });
    expect(Number(params.since)).toBe(new Date(2026, 1, 1).getTime() / 1000);
    expect(Number(params.until)).toBe(new Date(2026, 2, 1).getTime() / 1000);
  });
});

describe("bold matches", () => {
  it("bolds each word that starts with a searched word, ignoring capitals and accents", () => {
    const terms = searchedTerms("cafe read");
    expect(terms).toEqual(["cafe", "read"]);
    expect(boldParts("Reading at the Café, again", terms)).toEqual([
      { text: "Reading", bold: true },
      { text: " at the ", bold: false },
      { text: "Café", bold: true },
      { text: ", again", bold: false },
    ]);
  });

  it("keeps Hindi words whole", () => {
    expect(boldParts("नई किताबें आई", searchedTerms("किता"))).toEqual([
      { text: "नई ", bold: false },
      { text: "किताबें", bold: true },
      { text: " आई", bold: false },
    ]);
  });

  it("leaves a title alone when nothing is searched", () => {
    expect(boldParts("A quiet morning", [])).toEqual([{ text: "A quiet morning", bold: false }]);
  });
});
