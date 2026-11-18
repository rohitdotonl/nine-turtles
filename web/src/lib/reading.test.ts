import { describe, expect, it } from "vitest";
import { newestView } from "./reading";

describe("Unread on or off", () => {
  it("opens on Unread, or on All with Unread off", () => {
    expect(newestView(true)).toBe("unread");
    expect(newestView(false)).toBe("all");
  });
});
