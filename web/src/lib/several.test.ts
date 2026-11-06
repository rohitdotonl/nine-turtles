import { describe, expect, it } from "vitest";
import type { AddResult, Choice } from "./feeds";
import { followedTogether } from "./several";
import type { Feed } from "./shapes";

const feed = (id: number) => ({ id, title: `Feed ${id}` }) as Feed;
const choices: Choice[] = [
  { title: "Posts", url: "https://maya.example/feed" },
  { title: "Comments", url: "https://maya.example/comments" },
  { title: "Podcast", url: "https://maya.example/podcast" },
];
const urls = choices.map((choice) => choice.url);

describe("following several of a site's feeds at once (decision 0199)", () => {
  it("keeps those followed, in the list's order, with their newest titles", () => {
    const results: AddResult[] = [
      { kind: "added", feed: feed(1), latest: "Hello" },
      { kind: "added", feed: feed(2) },
      { kind: "added", feed: feed(3) },
    ];
    const together = followedTogether(urls, results, choices);
    expect(together.added.map((each) => each.feed.id)).toEqual([1, 2, 3]);
    expect(together.added[0]!.latest).toBe("Hello");
    expect(together.note).toBeUndefined();
  });

  it("names the ones that couldn't be followed when others were", () => {
    const results: AddResult[] = [
      { kind: "added", feed: feed(1) },
      { kind: "problem", reason: "unreachable" },
      { kind: "problem", reason: "not-found" },
    ];
    expect(followedTogether(urls, results, choices).note).toBe("Comments and Podcast couldn't be followed: That site didn't answer. Try again later.");
    expect(followedTogether(urls.slice(0, 2), results.slice(0, 2), choices).note).toBe("Comments couldn't be followed: That site didn't answer. Try again later.");
  });

  it("with nothing new followed, says the first problem, or goes to one already followed", () => {
    const failed = followedTogether(urls.slice(0, 2), [{ kind: "problem", reason: "unreachable" }, { kind: "already", feedId: 9 }], choices);
    expect(failed.added).toEqual([]);
    expect(failed.problem).toBe("unreachable");
    expect(failed.already).toBe(9);
    expect(failed.note).toBeUndefined();
  });
});
