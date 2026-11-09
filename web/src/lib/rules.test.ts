import { describe as group, expect, it } from "vitest";
import type { Feed } from "./shapes";
import { addedMessage, howLong, previewLine, previewWhere, ruleLine, ruleRefused, wordShown, type Rule } from "./rules";

const feed = (id: number, title: string, places?: number[]): Feed => ({ id, title, siteUrl: null, unread: 0, folders: [], places });
/** The sidebar's rows: Alpha has two places (3 and 4), Garden Notes one. */
const people: Feed[] = [feed(3, "Alpha", [3, 4]), feed(5, "Garden Notes")];

const rule = (change: Partial<Rule>): Rule => ({ id: 1, words: "sponsored", titleOnly: false, feedId: null, placeGone: false, paused: false, until: null, ...change });

group("a word in Settings › Hiding", () => {
  const now = 1_000_000;
  it("says whose articles it hides and for how long", () => {
    expect(ruleLine(rule({}), people, now)).toBe("Everyone · for good");
    expect(ruleLine(rule({ feedId: 5 }), people, now)).toBe("Garden Notes · for good");
    // Any of a person's places stands for them.
    expect(ruleLine(rule({ feedId: 4, until: now + 5 * 86_400 }), people, now)).toBe("Alpha · 5 days left");
  });

  it("counts whole days left, rounded up, and never none", () => {
    expect(howLong(rule({ until: now + 86_400 }), now)).toBe("1 day left");
    expect(howLong(rule({ until: now + 60 }), now)).toBe("1 day left");
    expect(howLong(rule({ until: now + 29.5 * 86_400 }), now)).toBe("30 days left");
    expect(howLong(rule({ paused: true }), now)).toBe("paused");
  });

  it("says when an old word looks in titles only", () => {
    expect(wordShown(rule({ titleOnly: true }))).toBe("“sponsored” (in titles)");
    expect(wordShown(rule({ words: " ai " }))).toBe("“ai”");
  });

  it("says plainly when the person it was for is gone", () => {
    expect(ruleLine(rule({ placeGone: true }), people, now)).toBe("Someone you no longer follow · for good");
    expect(ruleLine(rule({ feedId: 99 }), people, now)).toContain("Someone you no longer follow");
  });

  it("says what adding a word hid at once, and for how long", () => {
    expect(addedMessage("football", 3)).toBe("Hid 3 unread articles about “football”.");
    expect(addedMessage("football", 1, 7)).toBe("Hid 1 unread article about “football”, for a week.");
    expect(addedMessage("election", 0, 30)).toBe("Hiding “election”, for a month. Nothing unread is about it yet.");
  });

  it("never shows an error code", () => {
    expect(ruleRefused("nothing-to-match")).toBe("Write a word or phrase to hide articles about.");
    expect(ruleRefused("trouble")).not.toMatch(/[0-9]/);
  });
});

group("seeing what a word would hide (decision 0216)", () => {
  it("says how many unread articles, or that it matches nothing yet", () => {
    expect(previewLine({ words: "garden", count: 5 })).toBe("“garden” would hide 5 unread articles.");
    expect(previewLine({ words: "garden", count: 1 })).toBe("“garden” would hide 1 unread article.");
    expect(previewLine({ words: "garden", count: 0 })).toBe("“garden” matches nothing unread now.");
  });
  it("names who wrote each one and where the word was found", () => {
    expect(previewWhere({ id: 1, feedTitle: "Ravi Iyer" }, [1])).toBe("Ravi Iyer · in the title");
    expect(previewWhere({ id: 2, feedTitle: "Garden Letters", writer: "Hal Brennan" }, [1])).toBe(
      "Hal Brennan · Garden Letters · in the text",
    );
  });
});
