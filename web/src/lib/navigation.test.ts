import { afterEach, describe, expect, it, vi } from "vitest";
import { homeFor, isList, isOver, moveTo, Opener, opensFromHere, underSheet, type Here } from "./navigation";
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
