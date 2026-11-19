import { afterEach, describe, expect, it, vi } from "vitest";
import { askAhead, listArticles, endOfList, markedAllMessage, newItemsMessage, noFurther, notSavedSignedOut, resultCount, withMarks } from "./lists";
import type { Article } from "./shapes";
import { Refused, signedOut } from "./saving";

describe("mark all as read", () => {
  it("says how many items it marked, in plain words", () => {
    expect(markedAllMessage(1)).toBe("Marked 1 article as read.");
    expect(markedAllMessage(23)).toBe("Marked 23 articles as read.");
    expect(markedAllMessage(0)).toBe("Everything here is already read.");
    expect(markedAllMessage(3, "Reading Room")).toBe("Marked 3 articles as read in Reading Room.");
  });
});

describe("the end of a list", () => {
  it("every list ends the same way, and a search runs out of results", () => {
    for (const view of ["unread", "starred", "notes", "all"] as const) expect(endOfList({ view })).toBe("That's everything.");
    expect(endOfList({ feed: 1 })).toBe("That's everything.");
    expect(endOfList({ folder: 2 })).toBe("That's everything.");
    expect(endOfList({ search: { q: "walking" } })).toBe("No more results.");
  });
});

describe("new items", () => {
  it("are announced in one quiet line, never with a number", () => {
    expect(newItemsMessage(false)).toBe("New articles · press r");
    expect(newItemsMessage(true)).toBe("New articles");
    expect(newItemsMessage(false)).not.toMatch(/[0-9!]/);
  });
});

describe("j and k with no article further (decision 0229)", () => {
  it("say which end it is, and that more load as you scroll down", () => {
    expect(noFurther(-1, true)).toBe("That's the first article here.");
    expect(noFurther(1, false)).toBe("That's the last article here.");
    expect(noFurther(1, true)).toBe("That's the last one so far. More load as you scroll down.");
  });
});

describe("a search's count", () => {
  it("says one, many, or many and more", () => {
    expect(resultCount(0, false)).toBe("");
    expect(resultCount(1, false)).toBe("1 result");
    expect(resultCount(12, false)).toBe("12 results");
    expect(resultCount(50, true)).toBe("50+ results");
  });
});

describe("signed out (decision 0230)", () => {
  it("names the real reason a mark wasn't saved", () => {
    expect(notSavedSignedOut("starred", true, 1)).toBe("You're signed out, so the article wasn't saved.");
    expect(notSavedSignedOut("starred", false, 1)).toBe("You're signed out, so the article wasn't removed from Saved.");
    expect(notSavedSignedOut("read", false, 1)).toBe("You're signed out, so the article wasn't marked as unread.");
    expect(notSavedSignedOut("read", true, 12)).toBe("You're signed out, so the 12 articles weren't marked as read.");
  });

  it("counts only the server's 401 as signed out", () => {
    expect(signedOut(new Refused(401))).toBe(true);
    expect(signedOut(new Refused(403))).toBe(false);
    expect(signedOut(new Refused(503))).toBe(false);
    expect(signedOut(new TypeError("offline"))).toBe(false);
  });
});

describe("a list fetched while marks were on their way (decision 0315)", () => {
  const row = (id: number, read = false, starred = false) => ({ id, read, starred }) as Article;
  const rows = [row(1), row(2, false, true), row(3)];

  it("shows each mark, the newest last", () => {
    const marks = [
      { kind: "read" as const, ids: [1, 2], value: true },
      { kind: "read" as const, ids: [2], value: false },
      { kind: "starred" as const, ids: [3], value: true },
    ];
    expect(withMarks(rows, marks, { feed: 4 })).toEqual([row(1, true), row(2, false, true), row(3, false, true)]);
  });

  it("leaves out of Unread what was just read, and out of Saved what was just taken out", () => {
    expect(withMarks(rows, [{ kind: "read", ids: [1], value: true }], { view: "unread" }).map((each) => each.id)).toEqual([2, 3]);
    const saved = [row(1, false, true), row(2, false, true), row(3, true, true)];
    expect(withMarks(saved, [{ kind: "starred", ids: [2], value: false }], { view: "starred" }).map((each) => each.id)).toEqual([1, 3]);
  });

  it("changes nothing without marks", () => {
    expect(withMarks(rows, [], { view: "unread" })).toBe(rows);
  });
});

describe("a list asked for on the press that opens it (decision 0320)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks once as the finger goes down, and the list takes that answer when it opens", async () => {
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (path: string) => {
      asked.push(path);
      return new Response(JSON.stringify({ articles: [], next: null, latest: 7 }));
    });
    vi.stubGlobal("localStorage", { getItem: (key: string) => (key === "nine-turtles.sort" ? "newest" : null) });
    askAhead("/folders/7");
    askAhead("/folders/7");
    await vi.waitFor(() => expect(asked).toEqual(["/api/articles?folder=7&order=newest"]));
    const page = await listArticles({ folder: 7 }, "newest", null, true);
    expect(page.latest).toBe(7);
    expect(asked).toHaveLength(1);
  });

  it("asks nothing for a page that isn't a list, or before the device knows the reader's order", () => {
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (path: string) => {
      asked.push(path);
      return new Response("{}");
    });
    vi.stubGlobal("localStorage", { getItem: (key: string) => (key === "nine-turtles.sort" ? "newest" : null) });
    askAhead("/settings");
    vi.stubGlobal("localStorage", { getItem: () => null });
    askAhead("/folders/8");
    expect(asked).toEqual([]);
  });
});

