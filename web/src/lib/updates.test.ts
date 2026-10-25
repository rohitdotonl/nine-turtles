import { describe, expect, it } from "vitest";
import { readCarried, switchesOnMove, verdict } from "./updates.svelte";

describe("telling a tab that nine turtles was updated", () => {
  it("says nothing while the versions match, or before the tab knows its own", () => {
    expect(verdict("2026-10-23-a", "2026-10-23-a", 200)).toBe("same");
    expect(verdict(undefined, "2026-10-23-a", 400)).toBe("same");
    expect(verdict("2026-10-23-a", null, 400)).toBe("same");
  });

  it("knows a newer version is ready when another version answers", () => {
    expect(verdict("2026-10-23-a", "2026-10-24-b", 200)).toBe("newer");
    // Signed out, or a refusal the screen explains: still just newer.
    expect(verdict("2026-10-23-a", "2026-10-24-b", 401)).toBe("newer");
    expect(verdict("2026-10-23-a", "2026-10-24-b", 409)).toBe("newer");
  });

  it("asks for a reload when the newer version didn't understand the request", () => {
    for (const status of [400, 404, 405, 415, 422]) {
      expect(verdict("2026-10-23-a", "2026-10-24-b", status)).toBe("stranded");
    }
  });
});

describe("switching an open tab to the new version", () => {
  it("switches on the next move once a newer version is ready", () => {
    expect(switchesOnMove(true, false, false)).toBe(true);
  });

  it("stays put while nothing newer is live", () => {
    expect(switchesOnMove(false, false, false)).toBe(false);
  });

  it("waits while marks are still being saved, so none is lost", () => {
    expect(switchesOnMove(true, true, false)).toBe(false);
  });

  it("waits while an Undo is on offer, so it isn't lost", () => {
    expect(switchesOnMove(true, false, true)).toBe(false);
  });
});

describe("what a switch carries to the new version", () => {
  const carried = { keyboard: true, sidebar: "hidden", listHidden: true, lastPlace: "/feeds/3", sidebarScroll: 120 };

  it("reads back a note it wrote", () => {
    expect(readCarried(JSON.parse(JSON.stringify(carried)))).toEqual(carried);
  });

  it("ignores anything else", () => {
    expect(readCarried(null)).toBeUndefined();
    expect(readCarried("keyboard")).toBeUndefined();
    expect(readCarried({ ...carried, sidebar: "sideways" })).toBeUndefined();
    expect(readCarried({ ...carried, sidebarScroll: "far" })).toBeUndefined();
  });
});
