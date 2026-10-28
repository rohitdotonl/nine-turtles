// Moving between places on the signed-in screen (Shell.svelte): which places
// are lists, which open as a sheet over the place you were, what a move keeps
// (the open article, the search) and where the keyboard goes back to. Shell
// does the moving (the browser's history, focus, what's shown); the rules for
// each move are decided here, the same for a click (`go`) and for the
// browser's Back and Forward.

import { parentOf, pathFor, rowFor, type Route } from "./router";
import type { ReadingMode } from "./reading";

/** A place that shows a list of articles: a view, a feed, a folder, a saved search or a collection. */
export function isList(place: Route): boolean {
  return place.kind === "view" || place.kind === "feed" || place.kind === "folder" || place.kind === "search" || place.kind === "collection";
}

/** The short tasks that open over a place: a sheet on a computer, a screen of their own on a phone. */
export function isOver(place: Route): boolean {
  return ["add-feed", "new-to-feeds", "edit-feed", "edit-folder", "save-search", "edit-search"].includes(place.kind);
}

/** River mode has no Unread view: its address (and "/") leads to All. */
export function homeFor(place: Route, mode: ReadingMode): Route {
  return mode === "river" && place.kind === "view" && place.view === "unread" ? { kind: "view", view: "all" } : place;
}

/**
 * Where the list and article come from. On a window wide enough for the list,
 * the short tasks in `isOver` open as a sheet over the place you were, which
 * stays in view: editing over the thing edited, the rest over `lastPlace`, the
 * last list you were on.
 */
export function underSheet(route: Route, lastPlace: Route, phone: boolean): Route {
  if (phone || !isOver(route)) return route;
  if (route.kind === "edit-feed") return { kind: "feed", id: route.id };
  if (route.kind === "edit-folder") return { kind: "folder", id: route.id };
  if (route.kind === "edit-search") return { kind: "search", id: route.id };
  return lastPlace;
}

/** Where you are now: the place, what's under it if it's a sheet, and whether the window is a phone's. */
export type Here = { route: Route; under: Route; phone: boolean };

/** What a move from here to `next` does. */
export type Move = {
  /** The open article (and the search) stay: opening a sheet over a place, closing it back there, or staying put. */
  keepsArticle: boolean;
  /** `keepsArticle`, and the place really changes: a sheet opens or closes, the place under it stays. */
  sameScreen: boolean;
  /** A sheet opens: what has the keyboard now gets it back when the sheet closes. */
  opening: boolean;
  /** A sheet closes. */
  closing: boolean;
  /** Going from a page opened from Settings back to the page it was opened from: the row that opened it, for the keyboard. */
  returnRow: string | undefined;
};

export function moveTo(here: Here, next: Route): Move {
  const { route, under, phone } = here;
  const same = pathFor(route) === pathFor(next);
  const keepsArticle = same || (!phone && ((isOver(next) && !isOver(route)) || (isOver(route) && pathFor(next) === pathFor(under))));
  const sheet = (place: Route) => !phone && isOver(place);
  const parent = parentOf(route);
  return {
    keepsArticle,
    sameScreen: keepsArticle && !same,
    opening: sheet(next) && !sheet(route),
    closing: sheet(route) && !sheet(next),
    returnRow: parent && pathFor(parent) === pathFor(next) ? rowFor(route) : undefined,
  };
}

/** `next` is a page opened from where you are (Settings and its pages), so closing it is a step back. */
export function opensFromHere(route: Route, next: Route): boolean {
  const parent = parentOf(next);
  return parent !== undefined && pathFor(parent) === pathFor(route);
}

/** What had the keyboard when a sheet opened, to give it back when the sheet closes. */
export class Opener {
  #at: Element | null = null;

  /** A sheet opens: remembers what has the keyboard now. */
  remember(at: Element | null) {
    this.#at = at;
  }

  forget() {
    this.#at = null;
  }

  /** The sheet closed: the keyboard goes back to what opened it, if that's still there. Says whether it did; forgets it either way. */
  giveBack(): boolean {
    const at = this.#at;
    this.#at = null;
    if (!(at instanceof HTMLElement) || !at.isConnected || at === document.body) return false;
    queueMicrotask(() => at.focus());
    return true;
  }
}
