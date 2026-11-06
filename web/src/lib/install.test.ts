import { describe, expect, it } from "vitest";
import { bookmarksBarKey, deviceOf, guideFor, guideForKind, KINDS, kindOf, type BrowserName, type Platform } from "./install";

const AGENTS: [string, number, Platform, BrowserName][] = [
  ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", 5, "iphone", "safari"],
  ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1", 5, "iphone", "chrome"],
  // An iPad asks for the desktop site: only its touch screen says it isn't a Mac.
  ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15", 5, "ipad", "safari"],
  ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15", 0, "mac", "safari"],
  ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36", 5, "android", "chrome"],
  ["Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0", 5, "android", "firefox"],
  ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", 0, "mac", "chrome"],
  ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0", 0, "windows", "edge"],
  ["Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0", 0, "windows", "firefox"],
  ["Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0", 0, "linux", "firefox"],
  ["Lynx/2.9", 0, "other", "other"],
];

describe("deviceOf", () => {
  it.each(AGENTS)("reads %s as the right device and browser", (userAgent, maxTouchPoints, platform, browser) => {
    expect(deviceOf({ userAgent, maxTouchPoints })).toEqual({ platform, browser });
  });
});

describe("the guides", () => {
  it("give every device and browser a place, and steps or a line saying why not", () => {
    for (const [userAgent, maxTouchPoints] of AGENTS) {
      const guide = guideFor(deviceOf({ userAgent, maxTouchPoints }));
      expect(guide.where).not.toBe("");
      expect(guide.steps.length > 0 || guide.foot !== undefined).toBe(true);
    }
    for (const { kind } of KINDS) expect(guideForKind(kind).steps.length).toBeGreaterThan(0);
  });

  it("name the browser on a computer, where the steps differ", () => {
    expect(guideFor({ platform: "mac", browser: "safari" }).where).toBe("Mac, in Safari");
    expect(guideFor({ platform: "windows", browser: "firefox" }).steps[0]).toMatch(/web apps button/);
    expect(guideFor({ platform: "linux", browser: "firefox" }).steps).toEqual([]);
  });

  it("let an iPhone install from any browser", () => {
    expect(guideFor({ platform: "iphone", browser: "chrome" }).steps.length).toBeGreaterThan(0);
  });
});

describe("the tabs", () => {
  it("open on the reader's own kind of device", () => {
    expect(kindOf({ platform: "ipad", browser: "safari" })).toBe("apple");
    expect(kindOf({ platform: "android", browser: "chrome" })).toBe("android");
    expect(kindOf({ platform: "linux", browser: "firefox" })).toBe("computer");
    expect(KINDS.map((kind) => kind.label)).toEqual(["Computer", "Android", "iPhone & iPad"]);
  });
});

describe("bookmarksBarKey", () => {
  it("names the Mac's key on a Mac and Ctrl elsewhere", () => {
    expect(bookmarksBarKey({ platform: "mac", browser: "safari" })).toBe("Command Shift B");
    expect(bookmarksBarKey({ platform: "windows", browser: "edge" })).toBe("Ctrl Shift B");
  });
});
