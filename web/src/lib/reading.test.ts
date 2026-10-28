import { describe, expect, it } from "vitest";
import { homeView } from "./reading";

describe("reading modes", () => {
  it("opens on Unread in inbox mode and on All in river mode", () => {
    expect(homeView("inbox")).toBe("unread");
    expect(homeView("river")).toBe("all");
  });
});
