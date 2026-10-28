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
  it("is caught up only in Unread; other lists simply end, and a search runs out of results", () => {
    expect(endOfList({ view: "unread" })).toBe("You're all caught up.");
    for (const view of ["starred", "all", "recent", "upnext"] as const) expect(endOfList({ view })).toBe("That's everything.");
    expect(endOfList({ feed: 1 })).toBe("That's everything.");
    expect(endOfList({ folder: 2 })).toBe("That's everything.");
    expect(endOfList({ collection: 3 })).toBe("That's everything.");
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
