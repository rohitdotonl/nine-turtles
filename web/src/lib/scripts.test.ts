import { describe, expect, it } from "vitest";
import { rightToLeft } from "./scripts";

describe("an article's direction", () => {
  it("is right to left for Arabic, Persian, Urdu and Hebrew, with or without a region", () => {
    for (const language of ["ar", "fa-IR", "ur", "he", "HE-il", "yi"]) expect(rightToLeft(language)).toBe(true);
  });
  it("is left to right for everything else, and when the language isn't known", () => {
    for (const language of ["en", "hi", "zh-Hant", "ja", "arn", null, undefined, ""]) expect(rightToLeft(language)).toBe(false);
  });
});
