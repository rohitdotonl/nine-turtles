import { describe, expect, it } from "vitest";
import type { Feed } from "./shapes";
import { explain, findByName, folderChoice, folderUnread, inDevanagari, plainSourceName, unreadLabel, type Problem } from "./feeds";

describe("the add field's messages", () => {
  it("are calm, plain and never an error code", () => {
    const problems: Problem[] = ["not-an-address", "not-allowed", "unreachable", "not-found", "too-big", "no-feed", "trouble"];
    for (const problem of problems) {
      const message = explain(problem);
      expect(message).not.toMatch(/!|error|[0-9]{3}/i);
      expect(message.endsWith(".")).toBe(true);
    }
    expect(explain("no-feed")).toBe("This site doesn't seem to offer a feed. Try the feed's own address, or the site's home page.");
    // The one number shown is the limit itself.
    expect(explain("too-many")).toBe("You follow 1,000 feeds, as many as one reader can. Unsubscribe from one to add another.");
  });
});

describe("unread counts", () => {
  it("show nothing for none, the number up to 999, and 999+ above", () => {
    expect(unreadLabel(0)).toBe("");
    expect(unreadLabel(1)).toBe("1");
    expect(unreadLabel(999)).toBe("999");
    expect(unreadLabel(1000)).toBe("999+");
    expect(unreadLabel(25000)).toBe("999+");
  });
});

describe("names in Devanagari", () => {
  it("are told apart by their script, whatever the language", () => {
    expect(inDevanagari("धीमी पढ़ाई")).toBe(true);
    expect(inDevanagari("Notes · मराठी")).toBe(true);
    expect(inDevanagari("The Marginalian")).toBe(false);
    expect(inDevanagari("Café ünïcode")).toBe(false);
  });
});

describe("folders and the sidebar search", () => {
  const feed = (id: number, title: string, unread: number, folders: number[]): Feed => ({
    id,
    title,
    siteUrl: null,
    unread,
    folders,
    river: false,
    check: "automatic",
    openOnSite: false,
  });
  const feeds = [feed(1, "Café notes", 3, [1, 2]), feed(2, "Garden Letters", 5, [1]), feed(3, "Quiet Notes", 7, [])];
  const folders = [
    { id: 1, name: "Reading" },
    { id: 2, name: "Notebooks" },
  ];

  it("counts a folder's unread articles from its feeds", () => {
    expect(folderUnread(folders[0]!, feeds)).toBe(8);
    expect(folderUnread(folders[1]!, feeds)).toBe(3);
  });

  it("finds feeds and folders by any part of their name, whatever the capitals or accents", () => {
    const found = findByName({ feeds, folders }, "  NOTE");
    expect(found.feeds.map((each) => each.title)).toEqual(["Café notes", "Quiet Notes"]);
    expect(found.folders.map((each) => each.name)).toEqual(["Notebooks"]);
    expect(findByName({ feeds, folders }, "cafe").feeds.map((each) => each.id)).toEqual([1]);
    expect(findByName({ feeds, folders }, "nothing like it")).toEqual({ feeds: [], folders: [] });
    expect(findByName({ feeds, folders }, " ")).toEqual({ feeds, folders });
  });
});

describe("source names in the article list", () => {
  it("leave out a newsletter sender's address", () => {
    expect(plainSourceName("Every (every1@example.com)")).toBe("Every");
    expect(plainSourceName("Ava <ava@example.com>")).toBe("Ava");
    expect(plainSourceName("Read the Tea Leaves")).toBe("Read the Tea Leaves");
    expect(plainSourceName("Notes (2026)")).toBe("Notes (2026)");
    // A name that is only an address stays as it is.
    expect(plainSourceName("(hi@example.com)")).toBe("(hi@example.com)");
  });
});

describe("folderChoice", () => {
  it("folds the folder you're in, opens a closed one, and only goes to an open one", () => {
    expect(folderChoice(true, true, true)).toBe("fold");
    expect(folderChoice(true, false, true)).toBe("fold");
    expect(folderChoice(false, false, true)).toBe("open-and-go");
    expect(folderChoice(false, true, true)).toBe("go");
  });
  it("only goes there on a phone, in search results or with a key held for a new tab", () => {
    expect(folderChoice(true, true, false)).toBe("go");
    expect(folderChoice(false, false, false)).toBe("go");
  });
});
