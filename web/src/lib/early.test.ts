import { afterEach, describe, expect, it, vi } from "vitest";
import { askEarly, forgetEarly, forgetLists, LISTS_KEY, noteList, SLOW_MS, takeEarly } from "./early";
import { away, connection } from "./connection.svelte";

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

describe("a slow connection doesn't hold opening up (decision 0320)", () => {
  it("takes what the page already asked for, instead of asking again", async () => {
    const asked = answering();
    const handed = Promise.resolve(new Response('{"from":"page"}'));
    vi.stubGlobal("nineTurtlesEarly", { "/api/session": handed });
    askEarly("/settings");
    expect(asked).not.toContain("/api/session");
    expect(await (await takeEarly("/api/session"))?.json()).toEqual({ from: "page" });
  });

  it("notes the list each address opens, for the page to ask for next time", () => {
    answering();
    const kept: Record<string, string> = { "nine-turtles.sort": "newest" };
    vi.stubGlobal("localStorage", { getItem: (key: string) => kept[key] ?? null, setItem: (key: string, value: string) => (kept[key] = value), removeItem: (key: string) => delete kept[key] });
    askEarly("/folders/7");
    expect(JSON.parse(kept[LISTS_KEY] ?? "{}")).toEqual({ "/folders/7": "/api/articles?folder=7&order=newest" });
    noteList("/settings", undefined);
    expect(Object.keys(JSON.parse(kept[LISTS_KEY] ?? "{}"))).toEqual(["/folders/7"]);
    // They name the reader's people and folders: gone on signing out, or with another reader.
    forgetLists();
    expect(kept[LISTS_KEY]).toBeUndefined();
  });

  it("on a device with kept copies, gives up waiting after a few seconds, and still hears the answer", async () => {
    vi.useFakeTimers();
    let answer: (response: Response) => void = () => {};
    vi.stubGlobal("fetch", () => new Promise<Response>((resolve) => (answer = resolve)));
    vi.stubGlobal("localStorage", { getItem: (key: string) => (key === "nine-turtles.reader" ? "3" : null) });
    askEarly("/settings");
    const taken = takeEarly("/api/feeds");
    const failed = expect(taken).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(SLOW_MS);
    await failed;
    expect(connection.offline).toBe(true);
    expect(away().why).toBe("The connection is slow.");
    answer(new Response("{}"));
    await vi.advanceTimersByTimeAsync(0);
    expect(connection.offline).toBe(false);
    expect(connection.slow).toBe(false);
  });

  it("says nine turtles can't be reached, not that the connection is slow, when the late answer fails instead", async () => {
    vi.useFakeTimers();
    let fail: (problem: unknown) => void = () => {};
    vi.stubGlobal("fetch", () => new Promise<Response>((_, reject) => (fail = reject)));
    vi.stubGlobal("localStorage", { getItem: (key: string) => (key === "nine-turtles.reader" ? "3" : null) });
    askEarly("/settings");
    const failed = expect(takeEarly("/api/feeds")).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(SLOW_MS);
    await failed;
    expect(away().why).toBe("The connection is slow.");
    fail(new TypeError("Failed to fetch"));
    await vi.advanceTimersByTimeAsync(0);
    expect(connection.offline).toBe(true);
    expect(away().why).toBe("nine turtles can't be reached right now.");
  });

  it("waits as long as it takes on a device that has never been signed in (nothing kept to show)", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", () => new Promise<Response>(() => {}));
    askEarly("/settings");
    let settled = false;
    takeEarly("/api/feeds")?.then(() => (settled = true), () => (settled = true));
    await vi.advanceTimersByTimeAsync(SLOW_MS * 2);
    expect(settled).toBe(false);
  });
});
