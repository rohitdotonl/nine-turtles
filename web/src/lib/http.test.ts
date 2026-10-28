import { afterEach, describe, expect, it, vi } from "vitest";
import { getJson, isRecord, sendChange } from "./http";

function answering(status: number, body: unknown) {
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isRecord", () => {
  it("takes objects, never lists or nothing", () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord([1])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord("text")).toBe(false);
  });
});

describe("getJson", () => {
  it("answers the JSON, and throws when the server answers with an error", async () => {
    answering(200, { feeds: [] });
    expect(await getJson("/api/feeds")).toEqual({ feeds: [] });
    answering(500, {});
    await expect(getJson("/api/feeds")).rejects.toThrow("500");
  });
});

describe("sendChange", () => {
  it("answers what the server sent back, or an empty answer when it sent none", async () => {
    answering(200, { id: 4 });
    expect(await sendChange("/api/folders", {}, ["no-name"])).toEqual({ answer: { id: 4 } });
    answering(200, [1, 2]);
    expect(await sendChange("/api/folders", {}, ["no-name"])).toEqual({ answer: {} });
  });

  it("names only the errors it was told of; anything else is trouble", async () => {
    answering(422, { error: "no-name" });
    expect(await sendChange("/api/folders", {}, ["no-name", "already"])).toEqual({ refusal: "no-name" });
    answering(422, { error: "too-late" });
    expect(await sendChange("/api/folders", {}, ["no-name", "already"])).toEqual({ refusal: "trouble" });
    answering(404, { error: "no-name" });
    expect(await sendChange("/api/folders/9", {}, ["no-name"])).toEqual({ refusal: "gone" });
  });

  it("is trouble when the server can't be reached", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await sendChange("/api/folders", {}, ["no-name"])).toEqual({ refusal: "trouble" });
  });
});
