import { describe, expect, it } from "vitest";
import { keptWords, removeWords } from "./keeping";

describe("what was kept from a place (SPEC section 42)", () => {
  it("says it in plain words", () => {
    expect(keptWords({ starred: 3, marked: 1, note: true })).toBe(
      "You starred 3 of their articles, highlighted or noted 1 and wrote a note on them.",
    );
  });

  it("names exactly what the red button removes (decision 0237)", () => {
    expect(removeWords({ starred: 2, marked: 0, note: false })).toBe("Remove the 2 starred articles too");
    expect(removeWords({ starred: 1, marked: 0, note: false })).toBe("Remove the starred article too");
    expect(removeWords({ starred: 0, marked: 0, note: true })).toBe("Remove your note on them too");
    expect(removeWords({ starred: 1, marked: 3, note: true })).toBe(
      "Remove the starred article, the 3 highlighted or noted articles and your note on them too",
    );
  });
});
