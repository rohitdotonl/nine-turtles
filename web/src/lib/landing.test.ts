import { afterEach, describe, expect, it, vi } from "vitest";
import { focusArriving, landingFor, type Headings, type LandingScene } from "./landing";
import type { Route } from "./router";

/** A stand-in for an element: it records being focused, as the document's active element. */
class Spot {
  constructor(readonly name: string) {}
  focus() {
    page.activeElement = this;
  }
}

/** The page as these tests draw it: the Settings rows on screen and where the keyboard is. */
const page: { activeElement: unknown; rows: Record<string, Spot> } = { activeElement: null, rows: {} };

function stubPage() {
  page.activeElement = null;
  page.rows = {};
  vi.stubGlobal("document", {
    get activeElement() {
      return page.activeElement;
    },
    querySelector: (selector: string) => page.rows[/data-settings-row="(.*)"/.exec(selector)?.[1] ?? ""] ?? null,
  });
}

/** Each heading as its own spot, named for where it is. */
const headings = Object.fromEntries(
  ["list", "sheet", "welcome", "settings", "health", "yourFeeds", "muted", "readers", "add"].map((name) => [name, new Spot(name)]),
) as unknown as Headings;

const computer: LandingScene = { phone: false, sheetShown: false, welcome: false };
const landing = (place: Route, scene: LandingScene = computer) => (landingFor(place, headings, scene) as unknown as Spot | undefined)?.name;

afterEach(() => vi.unstubAllGlobals());

describe("where the keyboard lands", () => {
  it("lands on each page's own heading, and on the add field when adding a feed", () => {
    stubPage();
    expect(landing({ kind: "settings" })).toBe("settings");
    expect(landing({ kind: "feed-health" })).toBe("health");
    expect(landing({ kind: "your-feeds" })).toBe("yourFeeds");
    expect(landing({ kind: "muted" })).toBe("muted");
    expect(landing({ kind: "readers" })).toBe("readers");
    expect(landing({ kind: "add-feed" })).toBe("add");
  });

  it("lands on a list's title, or the welcome's when it takes the list's room", () => {
    expect(landing({ kind: "view", view: "unread" })).toBe("list");
    expect(landing({ kind: "feed", id: 7 })).toBe("list");
    expect(landing({ kind: "view", view: "unread" }, { ...computer, welcome: true })).toBe("welcome");
  });

  it("lands on a sheet's heading, except Save search, which starts in its name field", () => {
    const sheet = { ...computer, sheetShown: true };
    expect(landing({ kind: "edit-feed", id: 7 }, sheet)).toBe("sheet");
    expect(landing({ kind: "save-search" }, sheet)).toBeUndefined();
    // On a phone it's a page, with the list's heading.
    expect(landing({ kind: "save-search" })).toBe("list");
  });

  it("lands on New to feeds' heading: the sheet's on a computer, the page's on a phone", () => {
    expect(landing({ kind: "new-to-feeds" })).toBe("sheet");
    expect(landing({ kind: "new-to-feeds" }, { ...computer, phone: true })).toBe("list");
  });

  it("goes back to the Settings row that opened a page, when it's drawn", () => {
    stubPage();
    expect(landing({ kind: "settings" }, { ...computer, returnRow: "rules" })).toBe("settings");
    page.rows.rules = new Spot("rules");
    expect(landing({ kind: "settings" }, { ...computer, returnRow: "rules" })).toBe("rules");
  });
});

describe("arriving back", () => {
  /** Frames the page is waiting on, run one at a time with `frame()`. */
  let frames: (() => void)[] = [];
  const frame = () => frames.shift()?.();

  function arrive(place: Route, row: () => string | undefined) {
    stubPage();
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (wait: () => void) => frames.push(wait));
    return (scene: LandingScene) => focusArriving(place, (to) => landingFor(to, headings, { ...scene, returnRow: row() }), row);
  }

  it("lands on the row straight away when it's there, and waits for nothing", () => {
    const go = arrive({ kind: "settings" }, () => "rules");
    page.rows.rules = new Spot("rules");
    go(computer);
    expect((page.activeElement as Spot).name).toBe("rules");
    expect(frames).toHaveLength(0);
  });

  it("rests on the heading, then moves to the row once its page draws it", () => {
    const go = arrive({ kind: "settings" }, () => "muted");
    go(computer);
    expect((page.activeElement as Spot).name).toBe("settings");
    frame();
    expect((page.activeElement as Spot).name).toBe("settings");
    page.rows.muted = new Spot("muted");
    frame();
    expect((page.activeElement as Spot).name).toBe("muted");
    expect(frames).toHaveLength(0);
  });

  it("stops waiting once the reader moves the keyboard, or moves on", () => {
    let row: string | undefined = "muted";
    const go = arrive({ kind: "settings" }, () => row);
    go(computer);
    page.activeElement = new Spot("elsewhere");
    page.rows.muted = new Spot("muted");
    frame();
    expect((page.activeElement as Spot).name).toBe("elsewhere");
    expect(frames).toHaveLength(0);

    const again = arrive({ kind: "settings" }, () => row);
    again(computer);
    row = undefined;
    page.rows.muted = new Spot("muted");
    frame();
    expect((page.activeElement as Spot).name).toBe("settings");
  });

  it("gives up after about three seconds", () => {
    const go = arrive({ kind: "settings" }, () => "muted");
    go(computer);
    for (let i = 0; i < 200 && frames.length > 0; i++) frame();
    expect(frames).toHaveLength(0);
    expect((page.activeElement as Spot).name).toBe("settings");
  });

  it("waits only for a Settings row", () => {
    const go = arrive({ kind: "feed-health" }, () => "rules");
    go(computer);
    expect((page.activeElement as Spot).name).toBe("health");
    expect(frames).toHaveLength(0);
  });
});
