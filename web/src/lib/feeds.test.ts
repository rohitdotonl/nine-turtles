import { describe, expect, it } from "vitest";
import { explain, markedAllMessage, newItemsMessage, unreadLabel, when, type Problem } from "./feeds";

describe("article times", () => {
  const now = new Date(2026, 9, 23, 18, 0);
  const at = (date: Date) => date.getTime() / 1000;

  it("show the time for today, the day for this year, and the year before that", () => {
    expect(when(at(new Date(2026, 9, 23, 14, 5)), now)).toBe("14:05");
    expect(when(at(new Date(2026, 9, 22, 23, 59)), now)).toBe("22 Oct");
    expect(when(at(new Date(2026, 0, 1, 9, 0)), now)).toBe("1 Jan");
    expect(when(at(new Date(2025, 9, 23, 14, 5)), now)).toBe("23 Oct 2025");
  });
});

describe("the add field's messages", () => {
  it("are calm, plain and never an error code", () => {
    const problems: Problem[] = ["not-an-address", "not-allowed", "unreachable", "not-found", "too-big", "no-feed", "trouble"];
    for (const problem of problems) {
      const message = explain(problem);
      expect(message).not.toMatch(/!|error|[0-9]{3}/i);
      expect(message.endsWith(".")).toBe(true);
    }
    expect(explain("no-feed")).toBe("This site doesn't seem to offer a feed.");
  });
});

describe("unread counts", () => {
  it("show nothing for none, the number up to 999, and 999+ above", () => {
    expect(unreadLabel(0)).toBe("");
    expect(unreadLabel(1)).toBe("1");
    expect(unreadLabel(999)).toBe("999");
    expect(unreadLabel(1000)).toBe("999+");
    expect(unreadLabel(25000)).toBe("999+");
  });
});

describe("mark all as read", () => {
  it("says how many items it marked, in plain words", () => {
    expect(markedAllMessage(1)).toBe("Marked 1 item as read");
    expect(markedAllMessage(23)).toBe("Marked 23 items as read");
    expect(markedAllMessage(0)).toBe("Everything here is already read.");
  });
});

describe("new items", () => {
  it("are announced in one quiet line, never with a number", () => {
    expect(newItemsMessage(false)).toBe("New items · press r");
    expect(newItemsMessage(true)).toBe("New items · tap Refresh");
    expect(newItemsMessage(false)).not.toMatch(/[0-9!]/);
  });
});
