import { describe, expect, it } from "vitest";
import type { Library } from "./shapes";
import {
  boldParts,
  chipsFor,
  emptyQuery,
  fold,
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
    const query: Query = { ...emptyQuery({ kind: "folder", id: 7 }), starred: true };
    expect(chipsFor(query, library).map((chip) => chip.label)).toEqual(["in: Tech", "Starred"]);
    // Starred is the one thing to show only (decision 0189); its chip goes on its own.
    expect(withoutChip(query, "starred")).toEqual({ ...query, starred: false });
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
    // From Notes, only the articles the reader marked (decision 0189).
    expect(searchParams({ ...emptyQuery({ kind: "view", view: "notes" }), words: "soup" })).toEqual({ q: "soup", notes: "true" });
    expect(resultsTitle(emptyQuery({ kind: "view", view: "notes" }).scope, library)).toBe("Results in Notes");
    expect(searchParams({ ...emptyQuery({ kind: "folder", id: 7 }), words: "x", starred: true })).toEqual({
      q: "x",
      folder: "7",
      starred: "true",
    });
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

  it("bolds Chinese and Japanese characters where they stand together, and finds Arabic without its vowel marks", () => {
    expect(searchedTerms("阅读器 Rust语言")).toEqual(["阅读器", "rust", "语言"]);
    expect(boldParts("我又开始用阅读器了", searchedTerms("阅读器"))).toEqual([
      { text: "我又开始用", bold: false },
      { text: "阅读器", bold: true },
      { text: "了", bold: false },
    ]);
    expect(boldParts("朝のコーヒー", searchedTerms("コーヒー"))).toEqual([
      { text: "朝の", bold: false },
      { text: "コーヒー", bold: true },
    ]);
    expect(fold("أَحمد")).toBe("أحمد");
    expect(boldParts("阅读，然后器", searchedTerms("阅读器"))).toEqual([{ text: "阅读，然后器", bold: false }]);
    expect(boldParts("دفتر القِرَاءَة", searchedTerms("القراءة"))).toEqual([
      { text: "دفتر ", bold: false },
      { text: "القِرَاءَة", bold: true },
    ]);
  });
});
