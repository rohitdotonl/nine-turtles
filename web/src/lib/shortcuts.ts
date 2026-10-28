// What a shortcut does on the signed-in screen (SPEC.md section 19).
// `keyboard.ts` decides which action a key press means; this file decides
// whether that action applies to what's on screen right now, and if so asks
// the screen (`Shell.svelte`) to do it. The screen hands over a snapshot of
// itself at the moment of the press (`KeyScene`) and the things it can do
// (`KeyHands`), so every rule about when a key works is here, in one place,
// and can be tested without drawing anything.
import type { Action } from "./keyboard";
import type { ArticleMove } from "./moving";
import { TEXT_SIZES } from "./preferences";
import { parse, type Route } from "./router";

/** The signed-in screen as it is when a key is pressed. */
export type KeyScene = {
  /** River mode: there's no Unread view and nothing to mark as read by hand. */
  river: boolean;
  /** An article list is the place (a view, feed, folder, search or collection), not a page or sheet. */
  onList: boolean;
  /** A search's results are showing. */
  searching: boolean;
  /** Recently read or Up Next, each in its own order, with no search showing: their menus have no marks. */
  ownOrder: boolean;
  /** Which panes are in view, and whether the article has the whole screen. */
  sidebar: boolean;
  list: boolean;
  article: boolean;
  reading: boolean;
  /** The keyboard's place is in the open article. */
  inArticle: boolean;
  /** An article is chosen in the list, and its link if it has one. */
  selected: boolean;
  link?: string;
  /** The article is drawn (so it can page and copy its link). */
  articleDrawn: boolean;
  /** The feed or folder whose list this is, and the first folder that feed is in. */
  feed?: number;
  folder?: number;
  feedsFolder?: number;
  /** The article text size, as a place in `TEXT_SIZES`. */
  textSize: number;
};

/** What the screen does when a shortcut applies. */
export type KeyHands = {
  openCheatSheet(): void;
  toggleSidebar(): void;
  toggleList(): void;
  toggleBoth(): void;
  go(place: Route): void;
  escape(): void;
  startSearch(): void;
  /** Another article in the list (`moving.ts`). */
  move(to: ArticleMove, step: 1 | -1): void;
  /** The feed after or before this place in the sidebar's order, if there is one. */
  feedAfter(step: 1 | -1): Route | undefined;
  open(): void;
  openLink(link: string): void;
  page(step: 1 | -1): void;
  copyLink(): void;
  markOlderRead(): void;
  markAllRead(): void;
  toggleFolder(id: number): void;
  star(): void;
  collect(): void;
  markUnread(): void;
  undo(): void;
  refresh(): void;
  setTextSize(size: number): void;
};

/**
 * Whether a key is nine turtles' to act on, or the browser's. Space with no
 * article open scrolls whatever it's on. Home and End choose from the list
 * only while the list is in view and the keyboard isn't in the open article:
 * there, and on a page that isn't a list, they scroll as usual (decision 0110).
 * Every other shortcut is ours, even where it does nothing.
 */
export function keyIsOurs(action: Action, key: string, scene: KeyScene): boolean {
  if (action.kind === "page") return scene.articleDrawn && scene.selected && scene.article && scene.onList;
  if (action.kind === "move-end" && (key === "Home" || key === "End")) return scene.onList && scene.list && !scene.reading && !scene.inArticle;
  return true;
}

/**
 * Mark all as read and Shift+O work where the list's More menu offers them:
 * not in river mode, not in Recently read or Up Next, and only with the list
 * or its article in view.
 */
function canMarkAll(scene: KeyScene): boolean {
  return !scene.river && scene.onList && !scene.ownOrder && (scene.list || scene.article || scene.reading);
}

/** Does what a shortcut means here, or nothing where it doesn't apply. */
export function carryOut(action: Action, scene: KeyScene, hands: KeyHands) {
  switch (action.kind) {
    case "cheat-sheet":
      hands.openCheatSheet();
      break;
    case "toggle-sidebar":
      hands.toggleSidebar();
      break;
    case "toggle-list":
      hands.toggleList();
      break;
    case "toggle-both":
      hands.toggleBoth();
      break;
    case "go":
      // g u does nothing in river mode: there's no Unread view.
      if (!(scene.river && action.view === "unread")) hands.go({ kind: "view", view: action.view });
      break;
    case "go-to":
      hands.go(parse(action.path));
      break;
    case "move-end":
      hands.move("moveToEnd", action.step);
      break;
    case "move-feed": {
      const next = scene.onList ? hands.feedAfter(action.step) : undefined;
      if (next) hands.go(next);
      break;
    }
    case "search":
      hands.startSearch();
      break;
    case "add-feed":
      hands.go({ kind: "add-feed" });
      break;
    case "escape":
      hands.escape();
      break;
    case "move":
      hands.move("move", action.step);
      break;
    case "move-unread":
      if (!scene.river) hands.move("moveUnread", action.step);
      break;
    case "open":
      hands.open();
      break;
    case "open-original":
      if (scene.link && scene.article) hands.openLink(scene.link);
      break;
    case "page":
      hands.page(action.step);
      break;
    case "copy-link":
      if (scene.selected && scene.article && scene.onList) hands.copyLink();
      break;
    case "mark-older-read":
      if (scene.selected && canMarkAll(scene)) hands.markOlderRead();
      break;
    case "toggle-folder": {
      // The folder you're in, or the first folder of the feed you're in.
      const folder = scene.folder ?? scene.feedsFolder;
      if (scene.onList && scene.sidebar && folder !== undefined) hands.toggleFolder(folder);
      break;
    }
    case "edit-place":
      if (scene.onList && !scene.searching) {
        if (scene.feed !== undefined) hands.go({ kind: "edit-feed", id: scene.feed });
        else if (scene.folder !== undefined) hands.go({ kind: "edit-folder", id: scene.folder });
      }
      break;
    case "star":
      if (scene.selected && scene.onList) hands.star();
      break;
    case "collect":
      if (scene.selected && scene.onList) hands.collect();
      break;
    case "mark-unread":
      if (scene.selected && scene.onList) hands.markUnread();
      break;
    case "mark-all-read":
      if (canMarkAll(scene)) hands.markAllRead();
      break;
    case "undo":
      if (scene.onList) hands.undo();
      break;
    case "refresh":
      if (scene.onList && (scene.list || scene.article || scene.reading)) hands.refresh();
      break;
    case "text-size":
      if (scene.selected && scene.article) {
        const size = scene.textSize + action.step;
        if (size >= 0 && size < TEXT_SIZES.length) hands.setTextSize(size);
      }
      break;
  }
}
