import { describe, expect, it } from "vitest";
import { HELP_URL, SETTINGS_PAGES, articleIn, helpPage, inSettings, knownPath, parentOf, parse, pathFor, placeAddressesBy, rowFor, sidebarViews, titleFor, withArticle, type SettingsPage } from "./router";

describe("addresses", () => {
  it("gives each fixed view and Settings its own address", () => {
    expect(parse("/unread")).toEqual({ kind: "view", view: "unread" });
    expect(parse("/starred/")).toEqual({ kind: "view", view: "starred" });
    expect(parse("/all")).toEqual({ kind: "view", view: "all" });
    expect(parse("/settings")).toEqual({ kind: "settings" });
    expect(parse("/settings/feed-health")).toEqual({ kind: "your-feeds" });
    expect(parse("/settings/feeds")).toEqual({ kind: "your-feeds" });
    expect(parse("/settings/hidden")).toEqual({ kind: "muted" });
    expect(parse("/settings/muted")).toEqual({ kind: "muted" });
    expect(parse("/settings/rules")).toEqual({ kind: "settings", page: "hiding" });
    expect(parse("/settings/readers/all")).toEqual({ kind: "readers" });
    expect(parse("/settings/readers")).toEqual({ kind: "settings", page: "readers" });
    expect(parse("/settings/hiding")).toEqual({ kind: "settings", page: "hiding" });
    expect(parse("/settings/add-from-anywhere/")).toEqual({ kind: "settings", page: "install" });
    expect(parse("/settings/install")).toEqual({ kind: "settings", page: "install" });
    // Pages that went (decision 0187) open Settings itself.
    expect(parse("/settings/font")).toEqual({ kind: "settings" });
    expect(parse("/settings/sidebar")).toEqual({ kind: "settings" });
    expect(parse("/add-feed")).toEqual({ kind: "add-feed" });
    expect(parse("/new-to-feeds")).toEqual({ kind: "new-to-feeds" });
    expect(parse("/feeds/12")).toEqual({ kind: "feed", id: 12 });
    expect(parse("/folders/4")).toEqual({ kind: "folder", id: 4 });
    expect(parse("/feeds/12/edit")).toEqual({ kind: "about", id: 12, settings: true });
    expect(parse("/people/12")).toEqual({ kind: "feed", id: 12 });
    expect(parse("/publications/7/")).toEqual({ kind: "feed", id: 7 });
    expect(parse("/people/12/about")).toEqual({ kind: "about", id: 12 });
    expect(parse("/publications/7/edit")).toEqual({ kind: "about", id: 7, settings: true });
    expect(parse("/people/12/sources/34")).toEqual({ kind: "about", id: 12, settings: true });
    expect(parse("/folders/4/edit/")).toEqual({ kind: "edit-folder", id: 4 });
  });

  it("only reads well-formed feed addresses", () => {
    expect(parse("/feeds/0")).toEqual({ kind: "view", view: "unread" });
    expect(parse("/feeds/abc")).toEqual({ kind: "view", view: "unread" });
    expect(parse("/feeds/12/more")).toEqual({ kind: "view", view: "unread" });
    expect(parse("/people/12/sources/0")).toEqual({ kind: "view", view: "unread" });
    expect(parse("/publication/7")).toEqual({ kind: "view", view: "unread" });
    expect(parse("/folders/x/edit")).toEqual({ kind: "view", view: "unread" });
  });

  it("opens Unread for the front page or an unknown address", () => {
    expect(parse("/")).toEqual({ kind: "view", view: "unread" });
    expect(parse("/nowhere")).toEqual({ kind: "view", view: "unread" });
  });

  it("knows its own places, so any other address is a wrong turn", () => {
    for (const path of ["/", "/unread", "/unread/", "/starred", "/all", "/settings", "/settings/feeds", "/add-feed", "/new-to-feeds", "/feeds/12", "/folders/4/edit", "/notes"])
      expect(knownPath(path), path).toBe(true);
    // Recently read, saved searches and collections are gone (decision 0174): their old addresses too.
    for (const path of ["/nowhere", "/feeds/0", "/feeds/abc", "/feeds/12/more", "/recent", "/searches/7", "/searches/new", "/collections/3", "/blog", "/settings/nothing", "/settings/toString", "/settings/readers/none"])
      expect(knownPath(path), path).toBe(false);
  });

  it("turns a place back into its address and title", () => {
    expect(pathFor({ kind: "view", view: "starred" })).toBe("/starred");
    expect(pathFor({ kind: "settings" })).toBe("/settings");
    expect(titleFor({ kind: "view", view: "all" })).toBe("All articles · nine turtles");
    expect(titleFor({ kind: "settings" })).toBe("Settings · nine turtles");
    // An open article names the tab (decision 0231).
    expect(titleFor({ kind: "feed", id: 3 }, "Reading Room", "The pleasure of a slow letter")).toBe("The pleasure of a slow letter · nine turtles");
    expect(titleFor({ kind: "feed", id: 3 }, "Reading Room", "")).toBe("Reading Room · nine turtles");
    expect(pathFor({ kind: "your-feeds" })).toBe("/settings/feeds");
    expect(titleFor({ kind: "your-feeds" })).toBe("Everyone you follow · nine turtles");
    expect(pathFor({ kind: "muted" })).toBe("/settings/hidden");
    expect(titleFor({ kind: "muted" })).toBe("Hidden articles · nine turtles");
    expect(pathFor({ kind: "readers" })).toBe("/settings/readers/all");
    expect(pathFor({ kind: "settings", page: "data" })).toBe("/settings/data");
    expect(titleFor({ kind: "settings", page: "data" })).toBe("Your data · nine turtles");
    expect(titleFor({ kind: "readers" })).toBe("All readers · nine turtles");
    expect(pathFor({ kind: "feed", id: 3 })).toBe("/people/3");
    expect(pathFor({ kind: "about", id: 3 })).toBe("/people/3/about");
    // Their settings are on their page: the old Edit and source addresses open it there, under its own address.
    expect(parse("/people/3/edit")).toEqual({ kind: "about", id: 3, settings: true });
    expect(parse("/people/3/sources/9")).toEqual({ kind: "about", id: 3, settings: true });
    expect(pathFor({ kind: "about", id: 3, settings: true })).toBe("/people/3/about");
    expect(titleFor({ kind: "about", id: 3 }, "Alpha")).toBe("Alpha · nine turtles");
    expect(titleFor({ kind: "feed", id: 3 }, "Quiet Notes")).toBe("Quiet Notes · nine turtles");
    expect(titleFor({ kind: "add-feed" })).toBe("Add a person or publication · nine turtles");
    expect(pathFor({ kind: "add-feed" })).toBe("/add");
    expect(parse("/add")).toEqual({ kind: "add-feed" });
    expect(titleFor({ kind: "new-to-feeds" })).toBe("New to feeds? · nine turtles");
    expect(pathFor({ kind: "edit-folder", id: 4 })).toBe("/folders/4/edit");
    expect(titleFor({ kind: "folder", id: 4 }, "Tech")).toBe("Tech · nine turtles");
  });

  it("gives a publication's places their own addresses once the sidebar says which it is (decision 0163)", () => {
    placeAddressesBy((id) => id === 7);
    try {
      expect(pathFor({ kind: "feed", id: 7 })).toBe("/publications/7");
      expect(pathFor({ kind: "about", id: 7 })).toBe("/publications/7/about");
      expect(pathFor({ kind: "feed", id: 3 })).toBe("/people/3");
    } finally {
      placeAddressesBy(() => false);
    }
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
    expect(parentOf({ kind: "settings", page: "hiding" })).toEqual({ kind: "settings" });
    expect(rowFor({ kind: "settings", page: "hiding" })).toBe("hiding");
    expect(parentOf({ kind: "your-feeds" })).toEqual({ kind: "settings" });
    expect(rowFor({ kind: "your-feeds" })).toBe("feeds");
    expect(parentOf({ kind: "muted" })).toEqual({ kind: "settings", page: "hiding" });
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

describe("the Help pages' addresses (decision 0157)", () => {
  it("points at the website's Help, and one page by its file name", () => {
    expect(HELP_URL).toBe("https://nineturtles.app/help/");
    expect(helpPage("every-keyboard-key")).toBe("https://nineturtles.app/help/every-keyboard-key/");
  });
});

describe("the sidebar's lists", () => {
  it("shows Notes from the first day, so its empty list can say how to fill it (decision 0222)", () => {
    expect(sidebarViews(false)).toEqual(["unread", "starred", "notes", "all"]);
    expect(sidebarViews(true)).toEqual(["starred", "notes", "all"]);
  });
});

describe("an open article's address (decision 0233)", () => {
  it("sits under its list's", () => {
    expect(withArticle("/people/5", 29)).toBe("/people/5/articles/29");
    expect(withArticle("/unread", 7)).toBe("/unread/articles/7");
    expect(withArticle("/folders/3", undefined)).toBe("/folders/3");
  });

  it("is read back into the list and the article, and the list is the place", () => {
    expect(articleIn("/people/5/articles/29")).toEqual({ list: "/people/5", article: 29 });
    expect(articleIn("/all/articles/3/")).toEqual({ list: "/all", article: 3 });
    expect(articleIn("/people/5")).toEqual({ list: "/people/5" });
    expect(articleIn("/people/5/articles/0")).toEqual({ list: "/people/5/articles/0" });
    expect(parse("/folders/3/articles/12")).toEqual({ kind: "folder", id: 3 });
    expect(parse("/starred/articles/12")).toEqual({ kind: "view", view: "starred" });
  });

  it("opens only under a list of articles", () => {
    expect(knownPath("/people/5/articles/29")).toBe(true);
    expect(knownPath("/unread/articles/29")).toBe(true);
    expect(knownPath("/settings/articles/29")).toBe(false);
    expect(knownPath("/articles/29")).toBe(false);
    expect(knownPath("/people/5/articles/nope")).toBe(false);
  });
});
