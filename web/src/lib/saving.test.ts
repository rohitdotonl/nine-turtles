import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Refused, worthRetrying } from "./saving";

// Each test loads saving.ts afresh, so marks waiting from one never reach the next.
async function load() {
  vi.resetModules();
  return import("./saving");
}

/** A fetch that answers each try with the next of `answers`: a status, or "offline". */
function server(answers: (number | "offline")[]) {
  const fetch = vi.fn(async () => {
    const answer = answers.length > 1 ? answers.shift() : answers[0];
    if (answer === "offline") throw new TypeError("Failed to fetch");
    return new Response(null, { status: answer });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("saving a mark while nine turtles is out of reach", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("knows marks are unsaved until each is saved or has failed", async () => {
    server([503, 200]);
    const { markRead, marksUnsaved } = await load();
    expect(marksUnsaved()).toBe(false);
    const saving = markRead([1], true);
    expect(marksUnsaved()).toBe(true);
    await vi.advanceTimersByTimeAsync(1_000);
    await saving;
    await vi.advanceTimersByTimeAsync(0);
    expect(marksUnsaved()).toBe(false);
  });

  it("tries again until it's back, then counts as saved", async () => {
    const fetch = server([503, "offline", 200]);
    const { markRead } = await load();
    const saving = markRead([1], true);
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(saving).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("gives up about a minute after the mark was made, not before", async () => {
    server(["offline"]);
    const { markRead } = await load();
    let failed = false;
    markRead([1], true).catch(() => (failed = true));
    await vi.advanceTimersByTimeAsync(59_000);
    expect(failed).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(failed).toBe(true);
  });

  it("never adds up the minutes of marks queued behind one another", async () => {
    server(["offline"]);
    const { markRead, markStarred } = await load();
    const failed: string[] = [];
    markRead([1], true).catch(() => failed.push("read"));
    markStarred([2], true).catch(() => failed.push("star"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(failed).toEqual(["read", "star"]);
  });

  it("refused answers fail at once", async () => {
    const fetch = server([500]);
    const { markRead } = await load();
    await expect(markRead([1], true)).rejects.toThrow("500");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("lists don't wait while a mark waits to try again", async () => {
    server(["offline"]);
    const { markRead, saved } = await load();
    markRead([1], true).catch(() => undefined);
    let ready = false;
    saved().then(() => (ready = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(ready).toBe(true);
    let later = false;
    saved().then(() => (later = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(later).toBe(true);
  });
});

describe("saving a mark again", () => {
  it("tries again when nine turtles can't be reached or is restarting, never when it refused", () => {
    expect(worthRetrying(new TypeError("Failed to fetch"))).toBe(true);
    expect(worthRetrying(new DOMException("timed out", "TimeoutError"))).toBe(true);
    for (const status of [502, 503, 504]) expect(worthRetrying(new Refused(status))).toBe(true);
    for (const status of [400, 401, 404, 413, 500]) expect(worthRetrying(new Refused(status))).toBe(false);
  });
});
