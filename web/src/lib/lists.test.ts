import { describe, expect, it } from "vitest";
import { endOfList, markedAllMessage, newItemsMessage, noFurther, notSavedSignedOut, resultCount } from "./lists";
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
    expect(notSavedSignedOut("starred", true, 1)).toBe("You're signed out, so the star wasn't saved.");
    expect(notSavedSignedOut("starred", false, 1)).toBe("You're signed out, so the star wasn't removed.");
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
