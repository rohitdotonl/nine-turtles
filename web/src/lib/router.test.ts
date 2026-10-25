import { describe, expect, it } from "vitest";
import { parse, pathFor, titleFor } from "./router";

describe("addresses", () => {
  it("gives each fixed view and Settings its own address", () => {
    expect(parse("/unread")).toEqual({ kind: "view", view: "unread" });
    expect(parse("/starred/")).toEqual({ kind: "view", view: "starred" });
    expect(parse("/all")).toEqual({ kind: "view", view: "all" });
    expect(parse("/settings")).toEqual({ kind: "settings" });
    expect(parse("/settings/feed-health")).toEqual({ kind: "feed-health" });
    expect(parse("/add-feed")).toEqual({ kind: "add-feed" });
    expect(parse("/new-to-feeds")).toEqual({ kind: "new-to-feeds" });
    expect(parse("/feeds/12")).toEqual({ kind: "feed", id: 12 });
    expect(parse("/folders/4")).toEqual({ kind: "folder", id: 4 });
    expect(parse("/feeds/12/edit")).toEqual({ kind: "edit-feed", id: 12 });
    expect(parse("/folders/4/edit/")).toEqual({ kind: "edit-folder", id: 4 });
  });

  it("only reads well-formed feed addresses", () => {
    expect(parse("/feeds/0")).toEqual({ kind: "view", view: "unread" });
    expect(parse("/feeds/abc")).toEqual({ kind: "view", view: "unread" });
    expect(parse("/feeds/12/more")).toEqual({ kind: "view", view: "unread" });
    expect(parse("/folders/x/edit")).toEqual({ kind: "view", view: "unread" });
  });

  it("opens Unread for the front page or an unknown address", () => {
    expect(parse("/")).toEqual({ kind: "view", view: "unread" });
    expect(parse("/nowhere")).toEqual({ kind: "view", view: "unread" });
  });

  it("turns a place back into its address and title", () => {
    expect(pathFor({ kind: "view", view: "starred" })).toBe("/starred");
    expect(pathFor({ kind: "settings" })).toBe("/settings");
    expect(titleFor({ kind: "view", view: "all" })).toBe("All · nine turtles");
    expect(titleFor({ kind: "settings" })).toBe("Settings · nine turtles");
    expect(pathFor({ kind: "feed-health" })).toBe("/settings/feed-health");
    expect(titleFor({ kind: "feed-health" })).toBe("Feed health · nine turtles");
    expect(pathFor({ kind: "feed", id: 3 })).toBe("/feeds/3");
    expect(titleFor({ kind: "feed", id: 3 }, "Quiet Notes")).toBe("Quiet Notes · nine turtles");
    expect(titleFor({ kind: "add-feed" })).toBe("Add a feed · nine turtles");
    expect(titleFor({ kind: "new-to-feeds" })).toBe("New to feeds? · nine turtles");
    expect(pathFor({ kind: "edit-folder", id: 4 })).toBe("/folders/4/edit");
    expect(titleFor({ kind: "folder", id: 4 }, "Tech")).toBe("Tech · nine turtles");
    expect(titleFor({ kind: "edit-feed", id: 3 })).toBe("Edit feed · nine turtles");
  });
});
