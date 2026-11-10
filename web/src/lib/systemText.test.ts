import { describe, expect, it } from "vitest";
import { textScale } from "./systemText";

describe("textScale", () => {
  it("leaves the app as designed at the iPhone's default size", () => {
    expect(textScale(17)).toBe(1);
  });
  it("grows with the system's text size", () => {
    expect(textScale(21)).toBe(1.235);
  });
  it("never shrinks the app, so touch targets stay 44px", () => {
    expect(textScale(14)).toBe(1);
  });
  it("stops at twice the size, where everything still works", () => {
    expect(textScale(53)).toBe(2);
  });
  it("ignores a size it can't read", () => {
    expect(textScale(Number.NaN)).toBe(1);
    expect(textScale(0)).toBe(1);
  });
});
