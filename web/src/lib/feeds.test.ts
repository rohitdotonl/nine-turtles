import { describe, expect, it } from "vitest";
import { explain, when, type Problem } from "./feeds";

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
