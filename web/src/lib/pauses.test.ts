import { describe, expect, it } from "vitest";
import { typedBreak } from "./pauses";

// The marking itself (classes on the article's blocks) is checked in the browser: tests/last-detail.spec.ts and the ◆ test in tests/reading.spec.ts.
describe("typedBreak (decision 0298)", () => {
  it("knows a section break typed by hand", () => {
    expect(typedBreak("------------------")).toBe(true);
    expect(typedBreak(" * * * ")).toBe(true);
    expect(typedBreak("◆◆◆")).toBe(true);
  });
  it("leaves words alone, and anything shorter than three marks", () => {
    expect(typedBreak("-- a signature")).toBe(false);
    expect(typedBreak("--")).toBe(false);
    expect(typedBreak("")).toBe(false);
  });
});
