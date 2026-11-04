import { describe as group, expect, it } from "vitest";
import type { Feed } from "./shapes";
import { HIDING_HELP, applyQuestion, appliedMessage, blankWidth, describe, ruleRefused, whoChoice, type Rule } from "./rules";

const feed = (id: number, title: string, places?: number[]): Feed => ({ id, title, siteUrl: null, unread: 0, folders: [], check: "automatic", openOnSite: false, places });
/** The sidebar's rows: Alpha has two places (3 and 4), Garden Notes one. */
const people: Feed[] = [feed(3, "Alpha", [3, 4]), feed(5, "Garden Notes")];

const rule = (change: Partial<Rule>): Rule => ({ id: 1, words: "sponsored", titleOnly: false, feedId: null, placeGone: false, paused: false, ...change });

group("a rule in words", () => {
  it("is one sentence: what it's about, and from whom", () => {
    expect(describe(rule({}), people)).toBe("Hide articles about “sponsored” from everyone.");
    expect(describe(rule({ feedId: 5 }), people)).toBe("Hide articles about “sponsored” from Garden Notes.");
    // Any of a person's places stands for them.
    expect(describe(rule({ feedId: 4 }), people)).toBe("Hide articles about “sponsored” from Alpha.");
  });

  it("says when an old rule looks in titles only", () => {
    expect(describe(rule({ titleOnly: true }), people)).toBe("Hide articles about “sponsored” (in titles) from everyone.");
  });

  it("says plainly when the person it was for is gone", () => {
    expect(describe(rule({ placeGone: true }), people)).toBe("Hide articles about “sponsored” from someone you no longer follow.");
    expect(describe(rule({ feedId: 99 }), people)).toContain("from someone you no longer follow");
  });

  it("asks before touching articles already here, with the number first", () => {
    expect(applyQuestion(12)).toBe("Also hide the 12 unread articles that match?");
    expect(applyQuestion(1)).toBe("Also hide the 1 unread article that matches?");
    expect(appliedMessage(12)).toBe("Hid 12 articles.");
    expect(appliedMessage(1)).toBe("Hid 1 article.");
  });

  it("never shows an error code", () => {
    expect(ruleRefused("nothing-to-match")).toBe("Write a word or phrase to hide articles about.");
    expect(ruleRefused("trouble")).not.toMatch(/[0-9]/);
  });
});

group("the sentence's blanks", () => {
  it("names who is chosen", () => {
    expect(whoChoice("all", people)).toBe("everyone");
    expect(whoChoice("3", people)).toBe("Alpha");
    expect(whoChoice("4", people)).toBe("Alpha");
    expect(whoChoice("", people)).toBe("choose someone…");
    expect(whoChoice("99", people)).toBe("");
  });

  it("sizes a blank to its words, with room for a menu's arrow, up to 28 letters", () => {
    expect(blankWidth("everyone")).toBe("calc(4.3em + 1.25rem)");
    expect(blankWidth("a word", 0.3)).toBe("calc(3.3em + 0.3rem)");
    expect(blankWidth("x".repeat(40))).toBe(blankWidth("x".repeat(28)));
  });

  it("has one quiet line under it", () => {
    expect(HIDING_HELP).toBe("Hidden articles are kept and marked read. Search still finds them.");
  });
});
