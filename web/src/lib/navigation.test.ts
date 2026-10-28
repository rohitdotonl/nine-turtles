import { afterEach, describe, expect, it, vi } from "vitest";
import { homeFor, isList, isOver, moveTo, Opener, opensFromHere, stepFor, Steps, underSheet, type Browser, type Here } from "./navigation";
import type { Route } from "./router";

const unread: Route = { kind: "view", view: "unread" };
const all: Route = { kind: "view", view: "all" };
const feed: Route = { kind: "feed", id: 7 };
const addFeed: Route = { kind: "add-feed" };
const editFeed: Route = { kind: "edit-feed", id: 7 };
const settings: Route = { kind: "settings" };
const health: Route = { kind: "feed-health" };

/** On a computer, at `route`, over `lastPlace` if it's a sheet. */
function here(route: Route, lastPlace: Route = unread, phone = false): Here {
  return { route, under: underSheet(route, lastPlace, phone), phone };
}

describe("places", () => {
  it("knows which places are lists and which open over another", () => {
    const lists: Route[] = [unread, feed, { kind: "folder", id: 1 }, { kind: "search", id: 2 }, { kind: "collection", id: 3 }];
    expect(lists.every(isList)).toBe(true);
    expect(isList(settings) || isList(addFeed)).toBe(false);
    expect(isOver(addFeed) && isOver(editFeed) && isOver({ kind: "save-search" })).toBe(true);
    expect(isOver(settings) || isOver(feed)).toBe(false);
  });

  it("leads Unread to All in river mode, and nothing else", () => {
    expect(homeFor(unread, "river")).toEqual(all);
    expect(homeFor(unread, "inbox")).toBe(unread);
    expect(homeFor(feed, "river")).toBe(feed);
  });

  it("shows under a sheet the thing edited, or the last list", () => {
    expect(underSheet(editFeed, unread, false)).toEqual(feed);
    expect(underSheet({ kind: "edit-folder", id: 2 }, unread, false)).toEqual({ kind: "folder", id: 2 });
    expect(underSheet({ kind: "edit-search", id: 3 }, unread, false)).toEqual({ kind: "search", id: 3 });
    expect(underSheet(addFeed, feed, false)).toBe(feed);
    // On a phone a sheet is a screen of its own, with nothing under it.
    expect(underSheet(addFeed, feed, true)).toBe(addFeed);
    expect(underSheet(settings, feed, false)).toBe(settings);
  });
});

describe("moveTo", () => {
  it("opens a sheet over the place, keeping its article", () => {
    expect(moveTo(here(feed), addFeed)).toEqual({ keepsArticle: true, sameScreen: true, opening: true, closing: false, returnRow: undefined });
  });

  it("closes a sheet back to the place under it, keeping its article", () => {
    expect(moveTo(here(addFeed, feed), feed)).toEqual({ keepsArticle: true, sameScreen: true, opening: false, closing: true, returnRow: undefined });
    expect(moveTo(here(editFeed), feed)).toMatchObject({ keepsArticle: true, closing: true });
  });

  it("closes a sheet elsewhere: the article goes", () => {
    expect(moveTo(here(addFeed, feed), unread)).toMatchObject({ keepsArticle: false, sameScreen: false, closing: true });
  });

  it("keeps everything when staying put, and nothing when moving between places", () => {
    expect(moveTo(here(feed), { kind: "feed", id: 7 })).toMatchObject({ keepsArticle: true, sameScreen: false });
    expect(moveTo(here(feed), unread)).toEqual({ keepsArticle: false, sameScreen: false, opening: false, closing: false, returnRow: undefined });
  });

  it("on a phone, a sheet is a screen of its own: nothing is kept and nothing opens over", () => {
    expect(moveTo(here(feed, unread, true), addFeed)).toEqual({ keepsArticle: false, sameScreen: false, opening: false, closing: false, returnRow: undefined });
    expect(moveTo(here(addFeed, feed, true), feed)).toMatchObject({ keepsArticle: false, closing: false });
  });

  it("going back from a page opened from Settings names the row that opened it", () => {
    expect(moveTo(here(health), settings).returnRow).toBe("feed-health");
    expect(moveTo(here(health), unread).returnRow).toBeUndefined();
    expect(moveTo(here(settings), health).returnRow).toBeUndefined();
  });

  it("knows a page opened from where you are", () => {
    expect(opensFromHere(settings, health)).toBe(true);
    expect(opensFromHere(unread, health)).toBe(false);
    expect(opensFromHere(settings, unread)).toBe(false);
  });
});

describe("Opener", () => {
  /** Just enough of an element: whether it's on the page, and whether it was given the keyboard. */
  class FakeElement {
    focused = false;
    constructor(public isConnected = true) {}
    focus() {
      this.focused = true;
    }
  }
  const body = new FakeElement();

  afterEach(() => vi.unstubAllGlobals());

  function stub() {
    vi.stubGlobal("HTMLElement", FakeElement);
    vi.stubGlobal("document", { body });
  }

  it("gives the keyboard back to what opened the sheet, once", async () => {
    stub();
    const opener = new Opener();
    const button = new FakeElement();
    opener.remember(button as unknown as Element);
    expect(opener.giveBack()).toBe(true);
    await Promise.resolve();
    expect(button.focused).toBe(true);
    expect(opener.giveBack()).toBe(false);
  });

  it("gives nothing back when the opener is gone, is the page itself, or was forgotten", () => {
    stub();
    const opener = new Opener();
    opener.remember(new FakeElement(false) as unknown as Element);
    expect(opener.giveBack()).toBe(false);
    opener.remember(body as unknown as Element);
    expect(opener.giveBack()).toBe(false);
    opener.remember(new FakeElement() as unknown as Element);
    opener.forget();
    expect(opener.giveBack()).toBe(false);
    opener.remember(null);
    expect(opener.giveBack()).toBe(false);
  });
});

describe("stepFor", () => {
  it("adds a step when the address or the screen changes, and none when both stay", () => {
    expect(stepFor(feed, "list", "/", false)).toEqual({ screen: "list", back: "list", fromParent: false });
    expect(stepFor(settings, "list", "/feeds/7", false)).toEqual({ screen: "page", back: "list", fromParent: false });
    expect(stepFor(health, "page", "/settings", true)).toEqual({ screen: "page", back: "page", fromParent: true });
    // The same place, from the article (a phone) or the feeds (home): back to its list is a step.
    expect(stepFor(feed, "article", "/feeds/7", false)).toEqual({ screen: "list", back: "article", fromParent: false });
    expect(stepFor(feed, "list", "/feeds/7", false)).toBeUndefined();
  });
});

describe("Steps", () => {
  /** A browser history that records what's asked of it, and the screen's hands. */
  function made(state: unknown = null, path = "/feeds/7") {
    const asked: string[] = [];
    const browser: Browser = {
      get state() {
        return state;
      },
      back: () => asked.push("back"),
      pushState: (step, _, url) => {
        asked.push(`push ${url} ${JSON.stringify(step)}`);
        state = step;
      },
      replaceState: (step, _, url) => asked.push(`replace ${url} ${JSON.stringify(step)}`),
    };
    const steps = new Steps({ arrive: (screen) => asked.push(`arrive ${screen}`), goUnder: () => asked.push("go under") }, browser, () => path);
    return { steps, asked };
  }

  it("steps back in history when the step before was that screen, and moves in place when not", () => {
    const before = made({ screen: "list", back: "home" });
    before.steps.back("home");
    expect(before.asked).toEqual(["back"]);
    // Arrived straight from a link or a reload: nothing before it to go back to.
    const straight = made({ screen: "list" });
    straight.steps.back("home");
    expect(straight.asked).toEqual(['replace /feeds/7 {"screen":"home"}', "arrive home"]);
  });

  it("closes a sheet opened with a step by stepping back, so Back doesn't reopen it", () => {
    const { steps, asked } = made({ screen: "list" });
    steps.goTo(addFeed, "list", false, true);
    steps.closeSheet();
    expect(asked).toEqual(['push /add-feed {"screen":"page","back":"list","fromParent":false}', "back"]);
  });

  it("closes a sheet with no step of its own by going to the place under it", () => {
    // Opened by the browser's Forward: the step is the browser's, not one we added.
    const forward = made({ screen: "page", back: "list" });
    forward.steps.sheetOpenedByBrowser();
    forward.steps.closeSheet();
    expect(forward.asked).toEqual(["go under"]);
    // Opened where the address and screen didn't change: no step was added.
    const inPlace = made({ screen: "page", back: "list" }, "/add-feed");
    inPlace.steps.goTo(addFeed, "page", false, true);
    inPlace.steps.closeSheet();
    expect(inPlace.asked).toEqual(["go under"]);
  });

  it("opens an article on a phone as a step on from its list", () => {
    const { steps, asked } = made({ screen: "list" });
    steps.openArticle();
    expect(asked).toEqual(['push /feeds/7 {"screen":"article","back":"list"}']);
    expect(steps.cameFrom("list")).toBe(true);
    steps.goBack();
    expect(asked.at(-1)).toBe("back");
  });
});
