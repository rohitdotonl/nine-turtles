import { describe, expect, it } from "vitest";
import { authorBesides, siteBesides, titleLength } from "./byline";

describe("authorBesides", () => {
  it("names the author only when they aren't the source", () => {
    expect(authorBesides("Hal Brennan", "Garden Letters")).toBe("Hal Brennan");
    expect(authorBesides("garden letters ", "Garden Letters")).toBeUndefined();
  });

  it("says a name spelled a letter or two differently once (decision 0298)", () => {
    expect(authorBesides("Ana Rodrigues", "Ana Rodriguez")).toBeUndefined();
    expect(authorBesides("Zoë O'Hara", "Zoe OHara")).toBeUndefined();
    // Different people, and short names that differ by a letter, stay apart.
    expect(authorBesides("Ana Rodrigues", "Small Kitchen")).toBe("Ana Rodrigues");
    expect(authorBesides("Jon", "Jan")).toBe("Jon");
    expect(authorBesides("Mike Taylor", "Every")).toBe("Mike Taylor");
  });
});

describe("siteBesides", () => {
  it("names the site when the feed is named for the person", () => {
    expect(siteBesides("Mr. and Mrs. Psmith’s Bookshelf", "John Psmith", undefined, true)).toBe("Mr. and Mrs. Psmith’s Bookshelf");
  });
  it("leaves it out when it's the feed's own name, give or take case and marks", () => {
    expect(siteBesides("Jim Nielsen's Notes", "Jim Nielsen’s Notes", undefined, true)).toBeUndefined();
    expect(siteBesides("  ", "Reading Room", undefined, true)).toBeUndefined();
    expect(siteBesides(null, "Reading Room", undefined, true)).toBeUndefined();
  });
  it("leaves it out for a publication, even one the reader renamed", () => {
    expect(siteBesides("Hacker News: Front Page", "HN", undefined, false)).toBeUndefined();
  });
  it("leaves it out when there's an author besides: the plate names the feed, the byline the author", () => {
    expect(siteBesides("Reading Room Press", "Reading Room", "Asha Rao", true)).toBeUndefined();
  });
});

describe("titleLength", () => {
  it("sizes a title by its length (decision 0294)", () => {
    expect(titleLength("Joy & Curiosity #106")).toBe("short");
    expect(titleLength("You learn more about writing from close reading than from writing advice")).toBe("medium");
    expect(titleLength("Why the bronze age collapsed, did Jesus rise from the dead?, indecent medieval sculpture, are smartphones destroying love?")).toBe("long");
    // Chinese, Japanese and Korean characters are about twice as wide, so they count double.
    expect(titleLength("ゆっくり読むことで文章の書き方を学ぶ二十の方法とその理由について")).toBe("medium");
    expect(titleLength("ゆっくり")).toBe("short");
  });
});
