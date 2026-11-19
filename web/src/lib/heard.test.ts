import { describe, expect, it } from "vitest";
import { isLayout } from "./heard";

describe("an article's layout tables", () => {
  const shape = { headed: false, holdsTable: false, inCell: false, columns: 3 };

  it("reads a table holding another table, or held in one, as layout", () => {
    expect(isLayout({ ...shape, holdsTable: true })).toBe(true);
    expect(isLayout({ ...shape, inCell: true })).toBe(true);
  });

  it("reads a table of one column as layout", () => {
    expect(isLayout({ ...shape, columns: 1 })).toBe(true);
    expect(isLayout({ ...shape, columns: 0 })).toBe(true);
  });

  it("keeps a table with headings as data, wherever it sits", () => {
    expect(isLayout({ ...shape, headed: true, holdsTable: true, inCell: true, columns: 1 })).toBe(false);
  });

  it("keeps a plain table of several columns as data", () => {
    expect(isLayout(shape)).toBe(false);
  });
});
