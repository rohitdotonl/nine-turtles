import { describe, expect, it } from "vitest";
import type { Library } from "./feeds";
import {
  boldParts,
  chipsFor,
  emptyQuery,
  isSearching,
  replaceLastWord,
  searchParams,
  searchedTerms,
  suggestions,
  takeFilters,
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
    expect(isSearching({ ...all, words: "is:" })).toBe(false);
    expect(isSearching({ ...all, starred: true })).toBe(true);
  });
});

describe("typed filters", () => {
  it("become chips once a space follows them", () => {
    const typing = takeFilters({ ...all, words: "is:starr" }, library, false);
    expect(typing.query.starred).toBe(false);
    expect(typing.query.words).toBe("is:starr");
    const done = takeFilters({ ...all, words: "slow is:starred reading" }, library, false);
    expect(done.query.starred).toBe(true);
    expect(done.query.words).toBe("slow reading");
    expect(chipsFor(done.query, library)).toEqual([{ key: "starred", label: "Starred", typed: "is:starred" }]);
  });

  it("are all taken on Enter", () => {
    const { query } = takeFilters({ ...all, words: "compost is:unread after:2026-01-31 before:2026-03-01" }, library, true);
    expect(query).toEqual({ ...all, words: "compost", unread: true, after: "2026-01-31", before: "2026-03-01" });
  });

  it("show as chips in plain words, as the options menu names them, keeping how they're typed (decision 0047)", () => {
    const query: Query = { ...all, unread: true, starred: true, after: "2026-10-01", before: "2026-03-01" };
    expect(chipsFor(query, library)).toEqual([
      { key: "unread", label: "Unread", typed: "is:unread" },
      { key: "starred", label: "Starred", typed: "is:starred" },
      { key: "after", label: "After 1 Oct 2026", typed: "after:2026-10-01" },
      { key: "before", label: "Before 1 Mar 2026", typed: "before:2026-03-01" },
    ]);
  });

  it("find feeds and folders by name, in quotes when it has spaces", () => {
    expect(takeFilters({ ...all, words: "feed:\"garden notes\"" }, library, true).query.scope).toEqual({ kind: "feed", id: 1 });
    expect(takeFilters({ ...all, words: "feed:weekly" }, library, true).query.scope).toEqual({ kind: "feed", id: 2 });
    expect(takeFilters({ ...all, words: "folder:tech" }, library, true).query.scope).toEqual({ kind: "folder", id: 7 });
    expect(takeFilters({ ...all, words: "feed:कविता" }, library, true).query.scope).toEqual({ kind: "feed", id: 3 });
  });

  it("wait for a quoted name's closing quote", () => {
    let query: Query = all;
    for (const typed of ['feed:"Garden ', 'feed:"Garden Notes', 'feed:"Garden Notes" ']) {
      const result = takeFilters({ ...query, words: typed }, library, false);
      query = result.query;
      if (typed.endsWith('" ')) {
        expect(query.scope).toEqual({ kind: "feed", id: 1 });
        expect(query.words).toBe("");
      } else {
        expect(result.problem).toBeUndefined();
        expect(query.scope).toEqual({ kind: "all" });
        expect(query.words).toBe(typed);
        // Nothing half typed is searched as words.
        expect(searchParams(query)).toEqual({});
      }
    }
    expect(suggestions('feed:"Garden No', library).map((each) => each.label)).toEqual(["feed:Garden Notes"]);
  });

  it("that can't be applied stay as typed, with a plain reason", () => {
    const unclear = takeFilters({ ...all, words: "feed:gard" }, library, true);
    expect(unclear.query.words).toBe("feed:gard");
    expect(unclear.problem).toBe("No feed matches “gard”.");
    expect(takeFilters({ ...all, words: "after:yesterday" }, library, true).problem).toBe(
      "Write the date as YYYY-MM-DD, like after:2026-10-23.",
    );
    expect(takeFilters({ ...all, words: "after:2026-02-30" }, library, true).problem).toBeDefined();
    expect(takeFilters({ ...all, words: "is:read" }, library, true).problem).toBe("is: can be is:unread or is:starred.");
  });
});

describe("what the server is asked", () => {
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

  it("leaves out a filter still being typed", () => {
    expect(searchParams({ ...all, words: "slow feed:gar" })).toEqual({ q: "slow" });
  });

  it("turns dates into this device's days: after the whole day, before its start", () => {
    const params = searchParams({ ...all, after: "2026-01-31", before: "2026-03-01" });
    expect(Number(params.since)).toBe(new Date(2026, 1, 1).getTime() / 1000);
    expect(Number(params.until)).toBe(new Date(2026, 2, 1).getTime() / 1000);
  });
});

describe("suggestions as you type", () => {
  it("offer filters by their start", () => {
    expect(suggestions("slow fe", library).map((each) => each.label)).toEqual(["feed:"]);
    expect(suggestions("af", library).map((each) => each.label)).toEqual(["after:YYYY-MM-DD"]);
    expect(suggestions("f", library)).toEqual([]);
    expect(suggestions("slow ", library)).toEqual([]);
  });

  it("offer whole filters once one is begun", () => {
    expect(suggestions("is:", library).map((each) => each.label)).toEqual(["is:unread", "is:starred"]);
    expect(suggestions("is:s", library).map((each) => each.label)).toEqual(["is:starred"]);
    expect(suggestions("feed:garden", library).map((each) => each.label)).toEqual([
      "feed:Garden Notes",
      "feed:Gardening Weekly",
    ]);
    const [tech] = suggestions("folder:te", library);
    expect(tech && "query" in tech && tech.query(all).scope).toEqual({ kind: "folder", id: 7 });
  });

  it("replace only the word being typed", () => {
    expect(replaceLastWord("slow fe", "feed:")).toBe("slow feed:");
  });
});

describe("bold matches", () => {
  it("bolds each word that starts with a searched word, ignoring capitals and accents", () => {
    const terms = searchedTerms("cafe read is:starred");
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
