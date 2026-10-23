import { describe, expect, it } from "vitest";
import { verdict } from "./updates.svelte";

describe("telling a tab that slowfeed was updated", () => {
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
