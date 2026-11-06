import { describe, expect, it } from "vitest";
import { folderNames, isQuiet, movedMessage, rowLine, unsubscribedMessage, type Tended } from "./tidy";

const DAY = 24 * 60 * 60;
const NOW = 1_790_000_000;

const feed = (change: Partial<Tended>): Tended => ({
  id: 1,
  title: "A blog",
  lastPosted: NOW - 3 * DAY,
  lastTitle: "On walking",
  kind: "person",
  addedAt: NOW - 400 * DAY,
  folders: [],
  ...change,
});

describe("everyone you follow", () => {
  it("counts six months without anything new as quiet", () => {
    expect(isQuiet(feed({ lastPosted: NOW - 181 * DAY }), NOW)).toBe(false);
    expect(isQuiet(feed({ lastPosted: NOW - 200 * DAY }), NOW)).toBe(true);
    expect(isQuiet(feed({ lastPosted: null }), NOW)).toBe(true);
    expect(isQuiet(feed({ lastPosted: null, addedAt: NOW - 10 * DAY }), NOW)).toBe(false);
  });

  it("says what each one wrote last, and when", () => {
    const now = new Date(2026, 10, 6, 15, 0);
    const at = (date: Date) => Math.floor(date.getTime() / 1000);
    expect(rowLine(feed({ lastPosted: at(new Date(2026, 10, 4, 9, 0)) }), [], now)).toBe("“On walking”, 4 November");
    expect(rowLine(feed({ lastPosted: at(new Date(2026, 10, 6, 9, 0)) }), ["Friends"], now)).toBe("“On walking”, today · Friends");
    expect(rowLine(feed({ lastPosted: at(new Date(2026, 2, 14)) }), [], now)).toBe("Quiet since 14 March: “On walking”");
    expect(rowLine(feed({ lastPosted: at(new Date(2025, 9, 3)), lastTitle: null }), [], now)).toBe("Quiet since 3 October 2025");
    expect(rowLine(feed({ lastPosted: at(new Date(2026, 9, 3)), lastTitle: null }), ["A", "B"], now)).toBe("Last wrote on 3 October · A, B");
    expect(rowLine(feed({ lastPosted: null }), [], now)).toBe("Nothing written yet");
  });

  it("names a feed's folders A to Z", () => {
    const folders = [
      { id: 2, name: "News" },
      { id: 1, name: "Tech" },
    ];
    expect(folderNames(feed({ folders: [1, 2] }), folders)).toEqual(["News", "Tech"]);
  });

  it("says what was done, naming one feed or counting several", () => {
    expect(movedMessage(["Alpha"], "Tech")).toBe("Moved Alpha to Tech.");
    expect(movedMessage(["Alpha", "Beta"], "Tech")).toBe("Moved 2 to Tech.");
    expect(movedMessage(["Alpha", "Beta"], null)).toBe("Took 2 out of every folder.");
    expect(unsubscribedMessage(["Alpha", "Beta", "Gamma"])).toBe("Unsubscribed from 3.");
    expect(unsubscribedMessage(["Alpha"])).toBe("Unsubscribed from Alpha.");
  });
});
