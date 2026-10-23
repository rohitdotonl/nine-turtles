import { describe, expect, it } from "vitest";
import { startingStep, stepOf } from "./steps";

describe("phone steps in the browser's history", () => {
  it("reads only steps slowfeed made", () => {
    expect(stepOf(null)).toBeUndefined();
    expect(stepOf({ screen: "elsewhere" })).toBeUndefined();
    expect(stepOf({ screen: "list", back: "home" })).toEqual({ screen: "list", back: "home" });
    expect(stepOf({ screen: "article", back: 3 })).toEqual({ screen: "article", back: undefined });
  });

  it("opens the feeds list on a phone's front page, and a named place as itself", () => {
    expect(startingStep(null, true, "/", true)).toEqual({ screen: "home" });
    expect(startingStep(null, true, "/feeds/3", true)).toEqual({ screen: "list", back: undefined });
    expect(startingStep(null, false, "/", true)).toEqual({ screen: "list", back: undefined });
    expect(startingStep(null, true, "/settings", false)).toEqual({ screen: "page", back: undefined });
  });

  it("keeps the screen across a reload, except an open article, which opens its list", () => {
    expect(startingStep({ screen: "home" }, true, "/unread", true)).toEqual({ screen: "home" });
    expect(startingStep({ screen: "list", back: "home" }, true, "/feeds/3", true)).toEqual({ screen: "list", back: "home" });
    expect(startingStep({ screen: "article", back: "list" }, true, "/feeds/3", true)).toEqual({ screen: "list", back: undefined });
  });
});
