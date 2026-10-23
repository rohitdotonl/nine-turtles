import { describe, expect, it } from "vitest";
import { parse, pathFor, titleFor } from "./router";

describe("addresses", () => {
  it("gives each fixed view and Settings its own address", () => {
    expect(parse("/unread")).toEqual({ kind: "view", view: "unread" });
    expect(parse("/starred/")).toEqual({ kind: "view", view: "starred" });
    expect(parse("/all")).toEqual({ kind: "view", view: "all" });
    expect(parse("/settings")).toEqual({ kind: "settings" });
  });

  it("opens Unread for the front page or an unknown address", () => {
    expect(parse("/")).toEqual({ kind: "view", view: "unread" });
    expect(parse("/nowhere")).toEqual({ kind: "view", view: "unread" });
  });

  it("turns a place back into its address and title", () => {
    expect(pathFor({ kind: "view", view: "starred" })).toBe("/starred");
    expect(pathFor({ kind: "settings" })).toBe("/settings");
    expect(titleFor({ kind: "view", view: "all" })).toBe("All · slowfeed");
    expect(titleFor({ kind: "settings" })).toBe("Settings · slowfeed");
  });
});
