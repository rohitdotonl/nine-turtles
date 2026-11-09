import { describe, expect, it } from "vitest";
import { rightToLeft, scriptFamily } from "./scripts";

describe("an article's direction", () => {
  it("is right to left for Arabic, Persian, Urdu, Hebrew and Dhivehi, with or without a region", () => {
    for (const language of ["ar", "fa-IR", "ur", "he", "HE-il", "yi", "dv"]) expect(rightToLeft(language)).toBe(true);
  });
  it("is left to right for everything else, and when the language isn't known", () => {
    for (const language of ["en", "hi", "zh-Hant", "ja", "arn", "ku", "az", null, undefined, ""]) expect(rightToLeft(language)).toBe(false);
  });
});

describe("an article's script family", () => {
  it("follows its language", () => {
    expect(scriptFamily("hi")).toBe("devanagari");
    expect(scriptFamily("mai")).toBe("devanagari");
    expect(scriptFamily("ar-EG")).toBe("arabic");
    expect(scriptFamily("ckb")).toBe("arabic");
    expect(scriptFamily("iw")).toBe("hebrew");
    expect(scriptFamily("ko")).toBe("cjk");
    expect(scriptFamily("zh-Hant")).toBe("cjk");
  });
  it("is none for languages set as English is, or also written in Latin letters", () => {
    for (const language of ["en", "fr", "ru", "ku", "ms", null, undefined]) expect(scriptFamily(language)).toBeUndefined();
  });
});
