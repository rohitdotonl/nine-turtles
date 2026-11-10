import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { askingEvery, bringsIn } from "./asking";

describe("bringsIn", () => {
  it("is only Unread and All articles, and only while some feeds wait (decision 0249)", () => {
    expect(bringsIn(3, { view: "unread" })).toBe(true);
    expect(bringsIn(3, { view: "all" })).toBe(true);
    expect(bringsIn(0, { view: "unread" })).toBe(false);
    expect(bringsIn(3, { view: "starred" })).toBe(false);
    expect(bringsIn(3, { feed: 4 })).toBe(false);
  });
});

describe("askingEvery", () => {
  const page = { hidden: false };
  beforeEach(() => (vi.useFakeTimers(), vi.stubGlobal("document", page), (page.hidden = false)));
  afterEach(() => (vi.useRealTimers(), vi.unstubAllGlobals()));

  it("asks once a minute, or every five seconds while filling in, and once more just after", () => {
    let filling = false;
    const asks: boolean[] = [];
    const stop = askingEvery(() => filling, (fills) => asks.push(fills));
    vi.advanceTimersByTime(55_000);
    expect(asks).toEqual([]);
    vi.advanceTimersByTime(5_000);
    expect(asks).toEqual([false]);
    filling = true;
    vi.advanceTimersByTime(10_000);
    expect(asks).toEqual([false, true, true]);
    filling = false;
    vi.advanceTimersByTime(10_000);
    // The ask just after filling in ends still fills in; then quiet again.
    expect(asks).toEqual([false, true, true, true]);
    stop();
  });

  it("asks nothing while the tab is hidden", () => {
    page.hidden = true;
    const asks: boolean[] = [];
    const stop = askingEvery(() => true, (fills) => asks.push(fills));
    vi.advanceTimersByTime(120_000);
    expect(asks).toEqual([]);
    stop();
  });
});
