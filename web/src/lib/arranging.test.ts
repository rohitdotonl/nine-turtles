import { describe, expect, it } from "vitest";
import { droppedBefore, filedAfter, placeWords, stepped, stepsFor } from "./arranging";

const ORDER = [1, 2, 3, 4];

describe("the reader's order of their folders", () => {
  it("offers only the steps that move a folder", () => {
    expect(stepsFor(ORDER, 1)).toEqual(["down", "bottom"]);
    expect(stepsFor(ORDER, 2)).toEqual(["top", "up", "down", "bottom"]);
    expect(stepsFor(ORDER, 4)).toEqual(["top", "up"]);
    expect(stepsFor([7], 7)).toEqual([]);
    expect(stepsFor(ORDER, 9)).toEqual([]);
  });

  it("moves a folder one step or to either end", () => {
    expect(stepped(ORDER, 3, "up")).toEqual([1, 3, 2, 4]);
    expect(stepped(ORDER, 3, "down")).toEqual([1, 2, 4, 3]);
    expect(stepped(ORDER, 3, "top")).toEqual([3, 1, 2, 4]);
    expect(stepped(ORDER, 2, "bottom")).toEqual([1, 3, 4, 2]);
    expect(stepped(ORDER, 1, "up")).toEqual(ORDER);
  });

  it("puts a dragged folder just before the one it's dropped above, or last", () => {
    expect(droppedBefore(ORDER, 4, 1)).toEqual([4, 1, 2, 3]);
    expect(droppedBefore(ORDER, 1, 3)).toEqual([2, 1, 3, 4]);
    expect(droppedBefore(ORDER, 2, null)).toEqual([1, 3, 4, 2]);
    expect(droppedBefore(ORDER, 2, 2)).toEqual(ORDER);
  });

  it("says where a folder is, for screen readers", () => {
    expect(placeWords(ORDER, 2)).toBe("2 of 4");
  });
});

describe("filing someone by dragging", () => {
  it("moves them from one folder to another, or keeps them in both", () => {
    expect(filedAfter([1, 2], 1, 3, false)).toEqual([2, 3]);
    expect(filedAfter([1, 2], 1, 3, true)).toEqual([1, 2, 3]);
  });

  it("puts someone in no folder into the one they're dropped on", () => {
    expect(filedAfter([], null, 3, false)).toEqual([3]);
  });

  it("takes them out of one folder only", () => {
    expect(filedAfter([1, 2], 1, null, false)).toEqual([2]);
  });

  it("changes nothing when they're already there, or weren't in it", () => {
    expect(filedAfter([1, 3], 1, 3, false)).toBeUndefined();
    expect(filedAfter([2], 1, null, false)).toBeUndefined();
    expect(filedAfter([2], null, null, false)).toBeUndefined();
  });
});
