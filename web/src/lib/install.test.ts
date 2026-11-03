import { describe, expect, it } from "vitest";
import { GUIDES, deviceOf, otherDevices, type Device } from "./install";

const AGENTS: [string, number, Device][] = [
  ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", 5, "iphone"],
  ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1", 5, "iphone"],
  // An iPad asks for the desktop site: only its touch screen says it isn't a Mac.
  ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15", 5, "ipad"],
  ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15", 0, "mac-safari"],
  ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36", 5, "android"],
  ["Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0", 5, "android"],
  ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", 0, "chrome"],
  ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0", 0, "edge"],
  ["Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0", 0, "firefox"],
  ["Lynx/2.9", 0, "other"],
];

describe("deviceOf", () => {
  it.each(AGENTS)("reads %s as the right device", (userAgent, maxTouchPoints, device) => {
    expect(deviceOf({ userAgent, maxTouchPoints })).toBe(device);
  });
});

describe("the guides", () => {
  it("give every device a place, and steps or a line saying why not", () => {
    for (const guide of Object.values(GUIDES)) {
      expect(guide.where).not.toBe("");
      expect(guide.steps.length > 0 || guide.foot !== undefined).toBe(true);
    }
  });

  it("leave the reader's own device out of the other devices", () => {
    expect(otherDevices("iphone").map((other) => other.name)).toEqual(["Android", "Mac", "Windows, Mac or Linux"]);
    expect(otherDevices("edge").map((other) => other.name)).toEqual(["iPhone and iPad", "Android", "Mac"]);
    expect(otherDevices("other")).toHaveLength(4);
  });
});
