import { describe, expect, it } from "vitest";
import type { Action } from "./keyboard";
import { TEXT_SIZES } from "./preferences";
import type { Route } from "./router";
import { carryOut, keyIsOurs, type KeyHands, type KeyScene } from "./shortcuts";

/** A computer's three panes, Unread on, an article chosen and drawn. */
function scene(changes: Partial<KeyScene> = {}): KeyScene {
  return {
    unreadOff: false,
    onList: true,
    searching: false,
    sidebar: true,
    list: true,
    article: true,
    reading: false,
    inArticle: false,
    selected: true,
    link: "https://example.com/post",
    articleDrawn: true,
    textSize: 2,
    ...changes,
  };
}

/** Hands that write down what they were asked to do. */
function hands(next?: Route) {
  const done: unknown[][] = [];
  const note =
    (name: string) =>
    (...args: unknown[]) => {
      done.push([name, ...args]);
    };
  const handed: KeyHands = {
    openCheatSheet: note("openCheatSheet"),
    toggleBoth: note("toggleBoth"),
    go: note("go"),
    escape: note("escape"),
    startSearch: note("startSearch"),
    move: note("move"),
    rowAfter: () => next,
    open: note("open"),
    openLink: note("openLink"),
    page: note("page"),
    copyLink: note("copyLink"),
    markAllRead: note("markAllRead"),
    toggleFolder: note("toggleFolder"),
    movePane: note("movePane"),
    moveRow: note("moveRow"),
    star: note("star"),
    inArticle: note("inArticle"),
    markUnread: note("markUnread"),
    undo: note("undo"),
    refresh: note("refresh"),
    setTextSize: note("setTextSize"),
  };
  return { handed, done };
}

function run(action: Action, at: KeyScene, next?: Route): unknown[][] {
  const { handed, done } = hands(next);
  carryOut(action, at, handed);
  return done;
}

describe("keyIsOurs", () => {
  it("leaves Space to the browser with no article open on a list", () => {
    const page: Action = { kind: "page", step: 1 };
    expect(keyIsOurs(page, " ", scene())).toBe(true);
    expect(keyIsOurs(page, " ", scene({ selected: false }))).toBe(false);
    expect(keyIsOurs(page, " ", scene({ articleDrawn: false }))).toBe(false);
    expect(keyIsOurs(page, " ", scene({ article: false }))).toBe(false);
    expect(keyIsOurs(page, " ", scene({ onList: false }))).toBe(false);
  });

  it("lets Home and End scroll the article or a page, and choose from the list otherwise", () => {
    const end: Action = { kind: "move-end", step: 1 };
    expect(keyIsOurs(end, "End", scene())).toBe(true);
    expect(keyIsOurs(end, "End", scene({ inArticle: true }))).toBe(false);
    expect(keyIsOurs(end, "Home", scene({ reading: true }))).toBe(false);
    expect(keyIsOurs(end, "Home", scene({ list: false }))).toBe(false);
    expect(keyIsOurs(end, "End", scene({ onList: false }))).toBe(false);
    // The same action on a letter the reader chose is always ours.
    expect(keyIsOurs(end, "e", scene({ inArticle: true }))).toBe(true);
  });

  it("keeps every other shortcut, even where it does nothing", () => {
    expect(keyIsOurs({ kind: "star" }, "s", scene({ selected: false, onList: false }))).toBe(true);
  });
});

describe("carryOut", () => {
  it("does nothing for g u with Unread off, which has no Unread", () => {
    expect(run({ kind: "go", view: "unread" }, scene({ unreadOff: true }))).toEqual([]);
    expect(run({ kind: "go", view: "starred" }, scene({ unreadOff: true }))).toEqual([["go", { kind: "view", view: "starred" }]]);
  });

  it("goes to a place by its address", () => {
    expect(run({ kind: "go-to", path: "/settings/feeds" }, scene())).toEqual([["go", { kind: "your-feeds" }]]);
  });

  it("goes to the next feed only from a list, and only when there is one", () => {
    const next: Route = { kind: "feed", id: 7 };
    expect(run({ kind: "move-feed", step: 1 }, scene(), next)).toEqual([["go", next]]);
    expect(run({ kind: "move-feed", step: 1 }, scene({ onList: false }), next)).toEqual([]);
    expect(run({ kind: "move-feed", step: 1 }, scene())).toEqual([]);
  });

  it("marks all as read only where the list's menu offers it", () => {
    const all: Action = { kind: "mark-all-read" };
    expect(run(all, scene())).toEqual([["markAllRead"]]);
    expect(run(all, scene({ selected: false }))).toEqual([["markAllRead"]]);
    expect(run(all, scene({ unreadOff: true }))).toEqual([]);
    expect(run(all, scene({ onList: false }))).toEqual([]);
    expect(run(all, scene({ list: false, article: false }))).toEqual([]);
    expect(run(all, scene({ list: false, article: false, reading: true }))).toEqual([["markAllRead"]]);
  });

  it("acts on the chosen article only in a list", () => {
    for (const [kind, did] of [
      ["star", "star"],
      ["mark-unread", "markUnread"],
    ] as const) {
      expect(run({ kind }, scene())).toEqual([[did]]);
      expect(run({ kind }, scene({ selected: false }))).toEqual([]);
      expect(run({ kind }, scene({ onList: false }))).toEqual([]);
    }
  });

  it("opens the original and copies its link only with the article in view", () => {
    expect(run({ kind: "open-original" }, scene())).toEqual([["openLink", "https://example.com/post"]]);
    expect(run({ kind: "open-original" }, scene({ link: undefined }))).toEqual([]);
    expect(run({ kind: "open-original" }, scene({ article: false }))).toEqual([]);
    expect(run({ kind: "copy-link" }, scene())).toEqual([["copyLink"]]);
    expect(run({ kind: "copy-link" }, scene({ onList: false }))).toEqual([]);
  });

  it("writes back about the chosen article only with it in view", () => {
    expect(run({ kind: "write-back" }, scene())).toEqual([["inArticle", "write-back"]]);
    expect(run({ kind: "highlight" }, scene())).toEqual([["inArticle", "highlight"]]);
    expect(run({ kind: "note" }, scene({ article: false }))).toEqual([]);
    expect(run({ kind: "write-back" }, scene({ selected: false }))).toEqual([]);
    expect(run({ kind: "write-back" }, scene({ article: false }))).toEqual([]);
    expect(run({ kind: "write-back" }, scene({ onList: false }))).toEqual([]);
  });

  it("o opens or closes the folder you're in, or the feed's first folder, with the sidebar in view", () => {
    expect(run({ kind: "toggle-folder" }, scene({ folder: 3, feed: 9, feedsFolder: 4 }))).toEqual([["toggleFolder", 3]]);
    expect(run({ kind: "toggle-folder" }, scene({ feed: 9, feedsFolder: 4 }))).toEqual([["toggleFolder", 4]]);
    expect(run({ kind: "toggle-folder" }, scene({ feed: 9 }))).toEqual([]);
    expect(run({ kind: "toggle-folder" }, scene({ folder: 3, sidebar: false }))).toEqual([]);
  });

  it("e opens Edit for the folder or the person whose list this is; ← → move between panes, ↑ ↓ along the sidebar", () => {
    expect(run({ kind: "edit" }, scene({ folder: 3, feed: 9 }))).toEqual([["go", { kind: "edit-folder", id: 3 }]]);
    expect(run({ kind: "edit" }, scene({ feed: 9 }))).toEqual([["go", { kind: "edit-feed", id: 9 }]]);
    expect(run({ kind: "edit" }, scene({ feed: 9, searching: true }))).toEqual([]);
    expect(run({ kind: "edit" }, scene({ feed: 9, onList: false }))).toEqual([]);
    expect(run({ kind: "edit" }, scene({}))).toEqual([]);
    expect(run({ kind: "pane", step: -1 }, scene({}))).toEqual([["movePane", -1]]);
    expect(run({ kind: "pane", step: 1 }, scene({ reading: true }))).toEqual([]);
    expect(run({ kind: "row", step: 1 }, scene({}))).toEqual([["moveRow", 1]]);
    expect(run({ kind: "row", step: 1 }, scene({ sidebar: false }))).toEqual([]);
  });

  it("goes to the page of the person whose list this is, but not from a folder's", () => {
    expect(run({ kind: "about" }, scene({ feed: 9 }))).toEqual([["go", { kind: "about", id: 9 }]]);
    expect(run({ kind: "about" }, scene())).toEqual([]);
  });

  it("refreshes and undoes only on a list", () => {
    expect(run({ kind: "refresh" }, scene())).toEqual([["refresh"]]);
    expect(run({ kind: "refresh" }, scene({ list: false, article: false }))).toEqual([]);
    expect(run({ kind: "undo" }, scene())).toEqual([["undo"]]);
    expect(run({ kind: "undo" }, scene({ onList: false }))).toEqual([]);
  });

  it("changes the text size within its range, with an article in view", () => {
    expect(run({ kind: "text-size", step: 1 }, scene())).toEqual([["setTextSize", 3]]);
    expect(run({ kind: "text-size", step: -1 }, scene({ textSize: 0 }))).toEqual([]);
    expect(run({ kind: "text-size", step: 1 }, scene({ textSize: TEXT_SIZES.length - 1 }))).toEqual([]);
    expect(run({ kind: "text-size", step: 1 }, scene({ selected: false }))).toEqual([]);
  });

  it("passes the rest straight to the screen", () => {
    expect(run({ kind: "cheat-sheet" }, scene())).toEqual([["openCheatSheet"]]);
    expect(run({ kind: "add-feed" }, scene())).toEqual([["go", { kind: "add-feed" }]]);
    expect(run({ kind: "move", step: 1 }, scene())).toEqual([["move", "move", 1]]);
    expect(run({ kind: "move-end", step: -1 }, scene())).toEqual([["move", "moveToEnd", -1]]);
    expect(run({ kind: "page", step: 1 }, scene())).toEqual([["page", 1]]);
    expect(run({ kind: "open" }, scene())).toEqual([["open"]]);
  });
});
