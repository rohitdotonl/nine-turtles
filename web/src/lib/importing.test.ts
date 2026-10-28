import { describe, expect, it } from "vitest";
import { tooManyToImport, importMessage, starsMessage } from "./importing";

describe("an import past the limit", () => {
  it("say why a file that would go past the limit imported nothing", () => {
    expect(tooManyToImport(950, 120, 1000)).toBe(
      "Nothing was imported. You follow 950 feeds, and this file would add 120 more, past the 1,000 one reader can follow.",
    );
    expect(tooManyToImport(1, 1000, 1000)).toContain("You follow 1 feed,");
  });
});

describe("the OPML import summary", () => {
  it("says what was added, what was already here and what couldn't be read", () => {
    expect(importMessage({ added: 120, already: 3, foldersAdded: 8, unreadable: ["Old blog", "x"] })).toEqual([
      "Added 120 feeds and 8 folders. Their articles arrive over the next few minutes.",
      "3 feeds were already here, so they weren't added again.",
      "2 lines couldn't be read: Old blog, x.",
    ]);
    expect(importMessage({ added: 1, already: 1, foldersAdded: 0, unreadable: [] })).toEqual([
      "Added 1 feed. Its articles arrive over the next few minutes.",
      "1 feed was already here, so it wasn't added again.",
    ]);
    expect(importMessage({ added: 0, already: 0, foldersAdded: 0, unreadable: [] })).toEqual(["No new feeds were added."]);
  });
});

describe("the starred import summary", () => {
  it("says what was starred, what was starred already and what couldn't come over", () => {
    expect(starsMessage({ starred: 1200, already: 3, unreadable: 2 })).toEqual([
      "Starred 1,200 articles. They're in Starred, each with a link to the original.",
      "3 articles were starred here already.",
      "2 articles couldn't be brought over, as the file gives no link to the original.",
    ]);
    expect(starsMessage({ starred: 1, already: 1, unreadable: 1 })).toEqual([
      "Starred 1 article. It's in Starred, with a link to the original.",
      "1 article was starred here already.",
      "1 article couldn't be brought over, as the file gives no link to the original.",
    ]);
    expect(starsMessage({ starred: 0, already: 0, unreadable: 0 })).toEqual(["No new stars were added."]);
  });
});
