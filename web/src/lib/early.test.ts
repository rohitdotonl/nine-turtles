import { afterEach, describe, expect, it, vi } from "vitest";
import { askEarly, forgetEarly, takeEarly } from "./early";

afterEach(() => {
  forgetEarly();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function answering() {
  const asked: string[] = [];
  vi.stubGlobal("fetch", (path: string) => {
    asked.push(path);
    return Promise.resolve(new Response("{}"));
  });
  return asked;
}

describe("opening asks for the first screen all at once (decision 0314)", () => {
  it("asks who is signed in, their settings and everyone they follow together", () => {
    const asked = answering();
    askEarly("/");
    expect(asked).toEqual(expect.arrayContaining(["/api/session", "/api/settings", "/api/feeds"]));
  });

  it("asks for the list the address opens too, once this device knows the reader's order", () => {
    const asked = answering();
    const kept: Record<string, string> = { "nine-turtles.sort": "oldest", "nine-turtles.unread": "off" };
    vi.stubGlobal("localStorage", { getItem: (key: string) => kept[key] ?? null });
    askEarly("/");
    expect(asked).toContain("/api/articles?view=starred&order=oldest");
    // Unread's address with Unread off opens All.
    askEarly("/unread");
    expect(asked).toContain("/api/articles?view=all&order=oldest");
    askEarly("/folders/7");
    expect(asked).toContain("/api/articles?folder=7&order=oldest");
    // Not a list: nothing more.
    const before = asked.length;
    askEarly("/settings");
    expect(asked.length - before).toBe(3);
  });

  it("hands each answer over once, to a plain request for the same address", async () => {
    answering();
    askEarly("/");
    expect(takeEarly("/api/settings", { method: "POST", body: "{}" })).toBeUndefined();
    const answer = takeEarly("/api/settings", { cache: "no-store" });
    expect(answer).toBeDefined();
    expect((await answer)?.ok).toBe(true);
    expect(takeEarly("/api/settings")).toBeUndefined();
    expect(takeEarly("/api/articles/1")).toBeUndefined();
  });

  it("uses none once nobody is signed in, or after a few seconds", () => {
    answering();
    askEarly("/");
    forgetEarly();
    expect(takeEarly("/api/feeds")).toBeUndefined();

    vi.useFakeTimers();
    askEarly("/");
    vi.advanceTimersByTime(10_000);
    expect(takeEarly("/api/feeds")).toBeUndefined();
  });
});
