import { describe, expect, it } from "vitest";
import { authorBesides } from "./byline";

describe("authorBesides", () => {
  it("names the author only when they aren't the source", () => {
    expect(authorBesides("Hal Brennan", "Garden Letters")).toBe("Hal Brennan");
    expect(authorBesides("garden letters ", "Garden Letters")).toBeUndefined();
  });
});
