import { describe, expect, it } from "vitest";
import { authorBesides, spaced } from "./leadOpening";

describe("spaced", () => {
  it("leaves a space after each block's end and each line break, so plain text never runs two together", () => {
    expect(spaced("<p>dinner.</p><p>There</p>")).toBe("<p>dinner.</p> <p>There</p> ");
    expect(spaced("one<br>two<BR/>three</div>four</li >")).toBe("one<br> two<BR/> three</div> four</li > ");
  });
  it("leaves words inside a paragraph alone", () => {
    expect(spaced("<p>a <em>b</em>c</p>")).toBe("<p>a <em>b</em>c</p> ");
  });
});

describe("authorBesides", () => {
  it("names the author only when they aren't the source", () => {
    expect(authorBesides("Hal Brennan", "Garden Letters")).toBe("Hal Brennan");
    expect(authorBesides("garden letters ", "Garden Letters")).toBeUndefined();
  });
});
