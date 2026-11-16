import { describe, expect, it } from "vitest";
import { authorBesides, titleLength } from "./byline";

describe("authorBesides", () => {
  it("names the author only when they aren't the source", () => {
    expect(authorBesides("Hal Brennan", "Garden Letters")).toBe("Hal Brennan");
    expect(authorBesides("garden letters ", "Garden Letters")).toBeUndefined();
  });
});

describe("titleLength", () => {
  it("sizes a title by its length (decision 0294)", () => {
    expect(titleLength("Joy & Curiosity #106")).toBe("short");
    expect(titleLength("You learn more about writing from close reading than from writing advice")).toBe("medium");
    expect(titleLength("Why the bronze age collapsed, did Jesus rise from the dead?, indecent medieval sculpture, are smartphones destroying love?")).toBe("long");
  });
});
