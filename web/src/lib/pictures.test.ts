import { describe, expect, it } from "vitest";
import { openLabel, shownSmaller } from "./pictures";

describe("whether a picture is shown clearly smaller than its real size", () => {
  it("offers a big picture squeezed into the column", () => {
    expect(shownSmaller({ width: 1600, height: 1000 }, { width: 640, height: 400 })).toBe(true);
  });

  it("leaves a picture shown at its full size alone", () => {
    expect(shownSmaller({ width: 640, height: 240 }, { width: 640, height: 240 })).toBe(false);
  });

  it("leaves a picture shown only a little smaller alone", () => {
    // 10% smaller: not a clear margin.
    expect(shownSmaller({ width: 700, height: 350 }, { width: 636, height: 318 })).toBe(false);
    // A fifth bigger, but only a few pixels: an icon-sized picture isn't worth opening.
    expect(shownSmaller({ width: 60, height: 60 }, { width: 48, height: 48 })).toBe(false);
  });

  it("counts a tall picture held to a shorter height", () => {
    expect(shownSmaller({ width: 300, height: 2000 }, { width: 300, height: 900 })).toBe(true);
  });

  it("never offers a picture that hasn't loaded, or isn't shown", () => {
    expect(shownSmaller({ width: 0, height: 0 }, { width: 640, height: 400 })).toBe(false);
    expect(shownSmaller({ width: 1600, height: 1000 }, { width: 0, height: 0 })).toBe(false);
  });
});

describe("what screen readers hear", () => {
  it("says what it does, then what the picture shows", () => {
    expect(openLabel("Hills at dusk")).toBe("Open picture larger: Hills at dusk");
    expect(openLabel("  ")).toBe("Open picture larger");
  });
});
