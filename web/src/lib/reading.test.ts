import { describe, expect, it } from "vitest";
import { homeView } from "./reading";

describe("Unread on or off", () => {
  it("opens on Unread, or on All with Unread off", () => {
    expect(homeView(true)).toBe("unread");
    expect(homeView(false)).toBe("all");
  });
});
