import { describe, expect, it } from "vitest";
import { carried } from "./articleDrag";

describe("a dragged article", () => {
  it("carries the publisher's link, as a link and as text, and its id", () => {
    expect(carried({ id: 7, link: "https://maya.example/walking" })).toEqual([
      ["text/uri-list", "https://maya.example/walking"],
      ["text/plain", "https://maya.example/walking"],
      ["application/x-nine-turtles-article", "7"],
    ]);
  });

  it("carries only its id when the feed gave no web address", () => {
    expect(carried({ id: 8, link: null })).toEqual([["application/x-nine-turtles-article", "8"]]);
    expect(carried({ id: 9, link: "mailto:maya@example.com" })).toEqual([["application/x-nine-turtles-article", "9"]]);
  });
});
