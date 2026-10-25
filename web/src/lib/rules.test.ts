import { describe as group, expect, it } from "vitest";
import type { Feed, Folder } from "./feeds";
import { applyQuestion, appliedMessage, describe, ruleRefused, type Rule } from "./rules";

const feeds: Feed[] = [{ id: 3, title: "Garden Notes", siteUrl: null, unread: 0, folders: [7] }];
const folders: Folder[] = [{ id: 7, name: "Tech" }];

const rule = (change: Partial<Rule>): Rule => ({
  id: 1,
  words: "sponsored",
  titleOnly: true,
  author: "",
  feedId: null,
  folderId: null,
  placeGone: false,
  action: "mute",
  paused: false,
  ...change,
});

group("a rule in words", () => {
  it("says what it looks for, where, and what it does, in one sentence", () => {
    expect(describe(rule({}), feeds, folders)).toBe("Mute articles with “sponsored” in the title, in all feeds.");
    expect(describe(rule({ titleOnly: false, folderId: 7 }), feeds, folders)).toBe(
      "Mute articles with “sponsored” in the title or text, in the Tech folder.",
    );
    expect(describe(rule({ words: "", author: "Jane Doe", action: "star", feedId: 3 }), feeds, folders)).toBe(
      "Star articles by Jane Doe, in Garden Notes.",
    );
    expect(describe(rule({ words: "giveaway", author: "Jane Doe", action: "read" }), feeds, folders)).toBe(
      "Mark as read any article with “giveaway” in the title, by Jane Doe, in all feeds.",
    );
  });

  it("says plainly when its feed or folder is gone", () => {
    expect(describe(rule({ placeGone: true }), feeds, folders)).toBe(
      "Mute articles with “sponsored” in the title, in a feed or folder that's gone.",
    );
    expect(describe(rule({ feedId: 99 }), feeds, folders)).toContain("in a feed you no longer follow");
  });

  it("asks before touching articles already here, with the number first", () => {
    expect(applyQuestion("mute", 37)).toBe("Also mute the 37 unread articles that match?");
    expect(applyQuestion("star", 1)).toBe("Also star the 1 unread article that matches?");
    expect(applyQuestion("read", 2)).toBe("Also mark as read the 2 unread articles that match?");
    expect(appliedMessage("mute", 37)).toBe("Muted 37 articles.");
    expect(appliedMessage("read", 1)).toBe("Marked 1 article as read.");
  });

  it("never shows an error code", () => {
    expect(ruleRefused("nothing-to-match")).toBe("Write a word, a phrase or an author to look for.");
    expect(ruleRefused("trouble")).not.toMatch(/[0-9]/);
  });
});
