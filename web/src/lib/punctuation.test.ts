import { describe, expect, it } from "vitest";
import { setsEnglishPunctuation, typeset } from "./punctuation";

describe("setting a typewriter's punctuation properly", () => {
  it("curls quotes and apostrophes the way they face", () => {
    expect(typeset(`"Hello," she said. "It's the '90s."`)).toBe("“Hello,” she said. “It’s the ’90s.”");
    expect(typeset(`a 'quoted' word`)).toBe("a ‘quoted’ word");
    expect(typeset(`("inside")`)).toBe("(“inside”)");
  });

  it("knows which way a quote faces from the text before it", () => {
    expect(typeset(`"`, " ")).toBe("“");
    expect(typeset(`" next`, "d")).toBe("” next");
  });

  it("makes two hyphens a dash and three dots an ellipsis, and leaves longer runs alone", () => {
    expect(typeset("one--two")).toBe("one—two");
    expect(typeset("wait...")).toBe("wait…");
    expect(typeset("---- and ....")).toBe("---- and ....");
    expect(typeset("a single - hyphen")).toBe("a single - hyphen");
  });

  it("is only for English articles, and those whose feed names no language", () => {
    expect(setsEnglishPunctuation(undefined)).toBe(true);
    expect(setsEnglishPunctuation("en-GB")).toBe(true);
    expect(setsEnglishPunctuation("fr")).toBe(false);
    expect(setsEnglishPunctuation("de-DE")).toBe(false);
  });

});
