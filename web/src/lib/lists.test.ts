import { describe, expect, it } from "vitest";
import { endOfList, markedAllMessage, newItemsMessage } from "./lists";

describe("mark all as read", () => {
  it("says how many items it marked, in plain words", () => {
    expect(markedAllMessage(1)).toBe("Marked 1 article as read");
    expect(markedAllMessage(23)).toBe("Marked 23 articles as read");
    expect(markedAllMessage(0)).toBe("Everything here is already read.");
  });
});

describe("the end of a list", () => {
  it("says \"for now\" only in Unread; other lists simply end, and a search runs out of results", () => {
    expect(endOfList({ view: "unread" })).toBe("That's everything for now.");
    for (const view of ["starred", "notes", "all"] as const) expect(endOfList({ view })).toBe("That's everything.");
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
