import { describe, expect, it } from "vitest";
import { moveArticle, nextFeed, type ArticleMove, type MoveScene, type MovingList } from "./moving";
import type { Route } from "./router";
import type { Feed } from "./shapes";

/** A computer's three panes, the keyboard in the list. */
function scene(changes: Partial<MoveScene> = {}): MoveScene {
  return { list: true, article: true, reading: false, inArticle: false, ...changes };
}

/** A list that moves (or not, at an end) and writes down what it was asked. */
function moved(to: ArticleMove, step: 1 | -1, on: MoveScene, moves = true) {
  const asked: string[] = [];
  const list: MovingList = {
    move: (step) => (asked.push(`move ${step}`), moves),
    moveUnread: (step) => (asked.push(`unread ${step}`), moves),
    moveToEnd: (step) => (asked.push(`end ${step}`), moves),
  };
  return { focus: moveArticle(list, to, step, on), asked };
}

describe("moveArticle", () => {
  it("asks the list for the next, the next unread or the end", () => {
    expect(moved("move", 1, scene()).asked).toEqual(["move 1"]);
    expect(moved("moveUnread", -1, scene()).asked).toEqual(["unread -1"]);
    expect(moved("moveToEnd", 1, scene()).asked).toEqual(["end 1"]);
  });

  it("keeps the keyboard in the list when it was there", () => {
    expect(moved("move", 1, scene()).focus).toBe("row");
  });

  it("takes the keyboard to the new article when you were reading", () => {
    expect(moved("move", 1, scene({ inArticle: true })).focus).toBe("article");
    expect(moved("moveToEnd", -1, scene({ reading: true })).focus).toBe("article");
  });

  it("leaves the keyboard on the article when the list is hidden", () => {
    expect(moved("move", -1, scene({ list: false })).focus).toBe("article");
  });

  it("moves with only the reading area, or only an article open on a phone", () => {
    expect(moved("move", 1, scene({ list: false })).asked).toEqual(["move 1"]);
    expect(moved("move", 1, scene({ list: false, article: false, reading: true })).asked).toEqual(["move 1"]);
  });

  it("does nothing at either end of the list", () => {
    expect(moved("move", 1, scene(), false).focus).toBeUndefined();
  });

  it("does nothing with nothing to move through", () => {
    expect(moved("move", 1, scene({ list: false, article: false }))).toEqual({ focus: undefined, asked: [] });
    expect(moveArticle(undefined, "move", 1, scene())).toBeUndefined();
  });
});

describe("nextFeed", () => {
  const feed = (id: number, folders: number[] = []) => ({ id, folders }) as unknown as Feed;
  // Essays (folder 1) holds feed 10; feed 20 is in no folder.
  const library = { feeds: [feed(10, [1]), feed(20)], folders: [{ id: 1, name: "Essays" }] };
  const all: Route = { kind: "view", view: "all" };

  it("goes to the feed after or before, in the sidebar's order", () => {
    expect(nextFeed(library, false, [1], all, 1)).toEqual({ kind: "feed", id: 10 });
    expect(nextFeed(library, false, [1], { kind: "feed", id: 10 }, 1)).toEqual({ kind: "feed", id: 20 });
    expect(nextFeed(library, false, [1], { kind: "feed", id: 20 }, -1)).toEqual({ kind: "feed", id: 10 });
  });

  it("passes over a folded folder's feeds", () => {
    expect(nextFeed(library, false, [], all, 1)).toEqual({ kind: "feed", id: 20 });
  });

  it("counts every folder as open on a phone", () => {
    expect(nextFeed(library, true, [], all, 1)).toEqual({ kind: "feed", id: 10 });
  });

  it("goes nowhere at the end, or before the feeds have loaded", () => {
    expect(nextFeed(library, false, [1], { kind: "feed", id: 20 }, 1)).toBeUndefined();
    expect(nextFeed({ ...library, feeds: undefined }, false, [1], all, 1)).toBeUndefined();
  });
});
