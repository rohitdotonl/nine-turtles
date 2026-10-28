import { describe, expect, it } from "vitest";
import { isFirstVisit, newToFeedsGivesWay, welcomeFor, type WelcomeScene } from "./firstVisit";

/** A first visit on Unread, on a computer with a reading area beside the list. */
function scene(changes: Partial<WelcomeScene> = {}): WelcomeScene {
  return { firstVisit: true, under: { kind: "view", view: "unread" }, article: true, phone: false, missing: false, ...changes };
}

describe("isFirstVisit", () => {
  it("is true only once the feeds have loaded and there are none", () => {
    expect(isFirstVisit(undefined)).toBe(false);
    expect(isFirstVisit([])).toBe(true);
    expect(isFirstVisit([{}])).toBe(false);
  });
});

describe("welcomeFor", () => {
  it("shows nothing once the reader follows something", () => {
    expect(welcomeFor(scene({ firstVisit: false }))).toEqual({ shown: false, wide: false, alone: false });
  });

  it("leaves Starred its own list", () => {
    expect(welcomeFor(scene({ under: { kind: "view", view: "starred" } })).shown).toBe(false);
    expect(welcomeFor(scene({ under: { kind: "view", view: "all" } })).shown).toBe(true);
  });

  it("takes the list's room with a reading area beside it", () => {
    expect(welcomeFor(scene())).toEqual({ shown: true, wide: true, alone: false });
    expect(welcomeFor(scene({ article: false })).wide).toBe(false);
  });

  it("is the phone screen's one heading", () => {
    expect(welcomeFor(scene({ phone: true, article: false }))).toEqual({ shown: true, wide: false, alone: true });
  });

  it("gives way to the not-found line, but still counts as shown", () => {
    expect(welcomeFor(scene({ missing: true }))).toEqual({ shown: true, wide: false, alone: false });
    expect(welcomeFor(scene({ missing: true, phone: true }))).toEqual({ shown: true, wide: false, alone: false });
  });
});

describe("newToFeedsGivesWay", () => {
  const newToFeeds = { kind: "new-to-feeds" } as const;
  it("swaps New to feeds? for home only once something is followed", () => {
    expect(newToFeedsGivesWay(newToFeeds, undefined)).toBe(false);
    expect(newToFeedsGivesWay(newToFeeds, [])).toBe(false);
    expect(newToFeedsGivesWay(newToFeeds, [{}])).toBe(true);
  });

  it("leaves every other place alone", () => {
    expect(newToFeedsGivesWay({ kind: "view", view: "unread" }, [{}])).toBe(false);
  });
});
