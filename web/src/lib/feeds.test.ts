import { describe, expect, it } from "vitest";
import {
  explain,
  findByName,
  folderUnread,
  importMessage,
  markedAllMessage,
  newItemsMessage,
  toExcerpt,
  unreadLabel,
  when,
  type Feed,
  type Problem,
} from "./feeds";

describe("article times", () => {
  const now = new Date(2026, 9, 23, 18, 0);
  const at = (date: Date) => date.getTime() / 1000;

  it("show the time for today, the day for this year, and the year before that", () => {
    expect(when(at(new Date(2026, 9, 23, 14, 5)), now)).toBe("14:05");
    expect(when(at(new Date(2026, 9, 22, 23, 59)), now)).toBe("22 Oct");
    expect(when(at(new Date(2026, 0, 1, 9, 0)), now)).toBe("1 Jan");
    expect(when(at(new Date(2025, 9, 23, 14, 5)), now)).toBe("23 Oct 2025");
  });
});

describe("search excerpts", () => {
  it("keep only text pieces, each a searched word or not, never HTML", () => {
    expect(
      toExcerpt([
        { text: "Late ", match: false },
        { text: "gardening", match: true },
        { text: "<b>notes</b>", match: "yes" },
        "stray",
        null,
      ]),
    ).toEqual([
      { text: "Late ", match: false },
      { text: "gardening", match: true },
      // Text stays text: Svelte shows it as written, tags and all.
      { text: "<b>notes</b>", match: false },
    ]);
  });
});

describe("the add field's messages", () => {
  it("are calm, plain and never an error code", () => {
    const problems: Problem[] = ["not-an-address", "not-allowed", "unreachable", "not-found", "too-big", "no-feed", "trouble"];
    for (const problem of problems) {
      const message = explain(problem);
      expect(message).not.toMatch(/!|error|[0-9]{3}/i);
      expect(message.endsWith(".")).toBe(true);
    }
    expect(explain("no-feed")).toBe("This site doesn't seem to offer a feed. Try the feed's own address, or the site's home page.");
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

describe("mark all as read", () => {
  it("says how many items it marked, in plain words", () => {
    expect(markedAllMessage(1)).toBe("Marked 1 item as read");
    expect(markedAllMessage(23)).toBe("Marked 23 items as read");
    expect(markedAllMessage(0)).toBe("Everything here is already read.");
  });
});

describe("new items", () => {
  it("are announced in one quiet line, never with a number", () => {
    expect(newItemsMessage(false)).toBe("New items · press r");
    expect(newItemsMessage(true)).toBe("New items");
    expect(newItemsMessage(false)).not.toMatch(/[0-9!]/);
  });
});

describe("folders and the sidebar search", () => {
  const feed = (id: number, title: string, unread: number, folders: number[]): Feed => ({
    id,
    title,
    siteUrl: null,
    unread,
    folders,
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

describe("the OPML import summary", () => {
  it("says what was added, what was already here and what couldn't be read", () => {
    expect(importMessage({ added: 120, already: 3, foldersAdded: 8, unreadable: ["Old blog", "x"] })).toEqual([
      "Added 120 feeds and 8 folders. Their articles arrive over the next few minutes.",
      "3 feeds were already here, so they weren't added again.",
      "2 lines couldn't be read: Old blog, x.",
    ]);
    expect(importMessage({ added: 1, already: 1, foldersAdded: 0, unreadable: [] })).toEqual([
      "Added 1 feed. Its articles arrive over the next few minutes.",
      "1 feed was already here, so it wasn't added again.",
    ]);
    expect(importMessage({ added: 0, already: 0, foldersAdded: 0, unreadable: [] })).toEqual(["No new feeds were added."]);
  });
});
