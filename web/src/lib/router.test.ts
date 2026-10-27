import { describe, expect, it } from "vitest";
import { SETTINGS_PAGES, inSettings, knownPath, parentOf, parse, pathFor, rowFor, titleFor, type SettingsPage } from "./router";

describe("addresses", () => {
  it("gives each fixed view and Settings its own address", () => {
    expect(parse("/unread")).toEqual({ kind: "view", view: "unread" });
    expect(parse("/starred/")).toEqual({ kind: "view", view: "starred" });
    expect(parse("/all")).toEqual({ kind: "view", view: "all" });
    expect(parse("/settings")).toEqual({ kind: "settings" });
    expect(parse("/settings/feed-health")).toEqual({ kind: "feed-health" });
    expect(parse("/settings/feeds")).toEqual({ kind: "your-feeds" });
    expect(parse("/settings/muted")).toEqual({ kind: "muted" });
    expect(parse("/settings/readers/all")).toEqual({ kind: "readers" });
    expect(parse("/settings/readers")).toEqual({ kind: "settings", page: "readers" });
    expect(parse("/settings/rules")).toEqual({ kind: "settings", page: "rules" });
    expect(parse("/settings/add-from-anywhere/")).toEqual({ kind: "settings", page: "add-from-anywhere" });
    expect(parse("/add-feed")).toEqual({ kind: "add-feed" });
    expect(parse("/new-to-feeds")).toEqual({ kind: "new-to-feeds" });
    expect(parse("/feeds/12")).toEqual({ kind: "feed", id: 12 });
    expect(parse("/folders/4")).toEqual({ kind: "folder", id: 4 });
    expect(parse("/feeds/12/edit")).toEqual({ kind: "edit-feed", id: 12 });
    expect(parse("/folders/4/edit/")).toEqual({ kind: "edit-folder", id: 4 });
    expect(parse("/searches/7")).toEqual({ kind: "search", id: 7 });
    expect(parse("/searches/7/edit")).toEqual({ kind: "edit-search", id: 7 });
    expect(parse("/searches/new")).toEqual({ kind: "save-search" });
    expect(parse("/searches/0")).toEqual({ kind: "view", view: "unread" });
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

  it("knows its own places, so any other address is a wrong turn", () => {
    for (const path of ["/", "/unread", "/unread/", "/starred", "/all", "/settings", "/settings/feeds", "/add-feed", "/new-to-feeds", "/feeds/12", "/folders/4/edit", "/searches/7", "/searches/new"])
      expect(knownPath(path), path).toBe(true);
    for (const path of ["/nowhere", "/feeds/0", "/feeds/abc", "/feeds/12/more", "/searches/0", "/blog", "/settings/nothing", "/settings/toString", "/settings/readers/none"])
      expect(knownPath(path), path).toBe(false);
  });

  it("turns a place back into its address and title", () => {
    expect(pathFor({ kind: "view", view: "starred" })).toBe("/starred");
    expect(pathFor({ kind: "settings" })).toBe("/settings");
    expect(titleFor({ kind: "view", view: "all" })).toBe("All · nine turtles");
    expect(titleFor({ kind: "settings" })).toBe("Settings · nine turtles");
    expect(pathFor({ kind: "feed-health" })).toBe("/settings/feed-health");
    expect(titleFor({ kind: "feed-health" })).toBe("Feed health · nine turtles");
    expect(pathFor({ kind: "your-feeds" })).toBe("/settings/feeds");
    expect(titleFor({ kind: "your-feeds" })).toBe("Your feeds · nine turtles");
    expect(pathFor({ kind: "muted" })).toBe("/settings/muted");
    expect(titleFor({ kind: "muted" })).toBe("Muted articles · nine turtles");
    expect(pathFor({ kind: "readers" })).toBe("/settings/readers/all");
    expect(pathFor({ kind: "settings", page: "font" })).toBe("/settings/font");
    expect(titleFor({ kind: "settings", page: "font" })).toBe("Font, theme and line width · nine turtles");
    expect(titleFor({ kind: "readers" })).toBe("All readers · nine turtles");
    expect(pathFor({ kind: "feed", id: 3 })).toBe("/feeds/3");
    expect(titleFor({ kind: "feed", id: 3 }, "Quiet Notes")).toBe("Quiet Notes · nine turtles");
    expect(titleFor({ kind: "add-feed" })).toBe("Add a feed · nine turtles");
    expect(titleFor({ kind: "new-to-feeds" })).toBe("New to feeds? · nine turtles");
    expect(pathFor({ kind: "edit-folder", id: 4 })).toBe("/folders/4/edit");
    expect(pathFor({ kind: "search", id: 7 })).toBe("/searches/7");
    expect(pathFor({ kind: "edit-search", id: 7 })).toBe("/searches/7/edit");
    expect(pathFor({ kind: "save-search" })).toBe("/searches/new");
    expect(titleFor({ kind: "search", id: 7 }, "Climate")).toBe("Climate · nine turtles");
    expect(titleFor({ kind: "save-search" })).toBe("Save search · nine turtles");
    expect(titleFor({ kind: "folder", id: 4 }, "Tech")).toBe("Tech · nine turtles");
    expect(titleFor({ kind: "edit-feed", id: 3 })).toBe("Edit feed · nine turtles");
  });

  it("gives each of Settings' own pages an address that comes back to it (decision 0120)", () => {
    for (const page of Object.keys(SETTINGS_PAGES) as SettingsPage[]) {
      expect(parse(pathFor({ kind: "settings", page }))).toEqual({ kind: "settings", page });
      expect(titleFor({ kind: "settings", page })).toBe(`${SETTINGS_PAGES[page]} · nine turtles`);
    }
  });
});

describe("Settings' pages", () => {
  it("go back to the page that opened them, and to the row that did", () => {
    expect(parentOf({ kind: "settings", page: "rules" })).toEqual({ kind: "settings" });
    expect(rowFor({ kind: "settings", page: "rules" })).toBe("rules");
    expect(parentOf({ kind: "feed-health" })).toEqual({ kind: "settings" });
    expect(rowFor({ kind: "feed-health" })).toBe("feed-health");
    expect(parentOf({ kind: "your-feeds" })).toEqual({ kind: "settings" });
    expect(rowFor({ kind: "your-feeds" })).toBe("feeds");
    expect(parentOf({ kind: "muted" })).toEqual({ kind: "settings", page: "rules" });
    expect(rowFor({ kind: "muted" })).toBe("muted");
    expect(parentOf({ kind: "readers" })).toEqual({ kind: "settings", page: "readers" });
    expect(rowFor({ kind: "readers" })).toBe("all-readers");
  });

  it("leave Settings itself and every other place without a parent", () => {
    expect(parentOf({ kind: "settings" })).toBeUndefined();
    expect(parentOf({ kind: "view", view: "unread" })).toBeUndefined();
    expect(inSettings({ kind: "settings" })).toBe(true);
    expect(inSettings({ kind: "muted" })).toBe(true);
    expect(inSettings({ kind: "add-feed" })).toBe(false);
  });
});
