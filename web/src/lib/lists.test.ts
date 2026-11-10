import { describe, expect, it } from "vitest";
import { endOfList, markedAllMessage, newItemsMessage, noFurther, resultCount } from "./lists";

describe("mark all as read", () => {
  it("says how many items it marked, in plain words", () => {
    expect(markedAllMessage(1)).toBe("Marked 1 article as read.");
    expect(markedAllMessage(23)).toBe("Marked 23 articles as read.");
    expect(markedAllMessage(0)).toBe("Everything here is already read.");
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
