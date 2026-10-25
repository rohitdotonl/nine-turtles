import { describe, expect, it } from "vitest";
import { describe as describeQuery, sameQuery, suggestedName, toQuery } from "./saved";
import type { Query } from "./search";

const library = {
  feeds: [{ id: 3, title: "Garden Notes", siteUrl: null, unread: 0, folders: [2] }],
  folders: [{ id: 2, name: "Tech" }],
};

const climate: Query = { words: '"climate" news', scope: { kind: "folder", id: 2 }, unread: true, starred: false, after: "2026-10-01", before: "" };

describe("saved searches", () => {
  it("read back what was saved, and nothing they can't understand", () => {
    expect(toQuery(JSON.parse(JSON.stringify(climate)))).toEqual(climate);
    expect(toQuery({ scope: { kind: "feed", id: 3 }, starred: true })).toEqual({
      words: "",
      scope: { kind: "feed", id: 3 },
      unread: false,
      starred: true,
      after: "",
      before: "",
    });
    // Anything odd is simply not a filter: never an error.
    expect(toQuery({ scope: { kind: "folder", id: 0 } }).scope).toEqual({ kind: "folder", id: 0 });
    expect(toQuery({ words: 4, scope: { kind: "folder", id: -1 }, unread: "yes", after: "yesterday" })).toEqual({
      words: "",
      scope: { kind: "all" },
      unread: false,
      starred: false,
      after: "",
      before: "",
    });
    expect(toQuery(null).scope).toEqual({ kind: "all" });
    expect(toQuery({ scope: { kind: "view", view: "starred" } }).scope).toEqual({ kind: "view", view: "starred" });
  });

  it("are named after their words, or else their chips", () => {
    expect(suggestedName(climate, library)).toBe("climate news");
    expect(suggestedName({ ...climate, words: "" }, library)).toBe("In Tech, Unread, After 1 Oct 2026");
  });

  it("say in words what they search for", () => {
    expect(describeQuery(climate, library)).toBe('"climate" news · In Tech · Unread · After 1 Oct 2026');
    expect(describeQuery({ ...climate, words: "", scope: { kind: "feed", id: 3 }, unread: false, after: "" }, library)).toBe("In Garden Notes");
  });

  it("know when the search field still holds what was saved", () => {
    expect(sameQuery(climate, { ...climate })).toBe(true);
    expect(sameQuery(climate, { ...climate, unread: false })).toBe(false);
    expect(sameQuery(climate, { ...climate, scope: { kind: "all" } })).toBe(false);
  });
});
