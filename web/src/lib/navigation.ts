// Moving between places on the signed-in screen (Shell.svelte): which places
// are lists, which open as a sheet over the place you were, what a move keeps
// (the open article, the search) and where the keyboard goes back to. Shell
// does the moving (focus, what's shown); the rules for each move are decided
// here, the same for a click (`go`) and for the browser's Back and Forward.
// `Steps` keeps the browser's history: the step each move adds, and the steps
// back (the phone's back arrow, closing a sheet).

import { parentOf, pathFor, rowFor, type Route } from "./router";
import type { ReadingMode } from "./reading";
import { stepOf, type Screen, type Step } from "./steps";

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

/**
 * The step `go` adds to the browser's history for a move to `next` from the screen `from`, at the
 * address `at`; none when both the address and the screen stay the same. `fromParent`: `next` was
 * opened from where you are (`opensFromHere`).
 */
export function stepFor(next: Route, from: Screen, at: string, fromParent: boolean): Step | undefined {
  const to: Screen = isList(next) ? "list" : "page";
  if (pathFor(next) === at && from === to) return undefined;
  return { screen: to, back: from, fromParent };
}

/** The part of the browser's history `Steps` uses (`window.history` has it). */
export type Browser = {
  readonly state: unknown;
  back(): void;
  pushState(state: unknown, unused: string, url?: string): void;
  replaceState(state: unknown, unused: string, url?: string): void;
};

/** What `Steps` asks of the screen. */
export type StepHands = {
  /** Shows `screen`, as after the browser's Back (Shell's `arrive`). */
  arrive(screen: Screen): void;
  /** Goes to the place under the sheet, without a step back. */
  goUnder(): void;
};

/** The browser's history as nine turtles moves through it: one per signed-in screen. */
export class Steps {
  #hands: StepHands;
  #browser: Browser;
  #path: () => string;
  /** The sheet on screen was opened with a step in the browser's history, so closing it is a step back. */
  #sheetPushed = false;

  constructor(hands: StepHands, browser: Browser = history, path: () => string = () => location.pathname) {
    this.#hands = hands;
    this.#browser = browser;
    this.#path = path;
  }

  /** The step before this one in the browser's history showed `screen`. */
  cameFrom(screen: Screen): boolean {
    return stepOf(this.#browser.state)?.back === screen;
  }

  /** One step back in the browser's history, as its Back button does. */
  goBack() {
    this.#browser.back();
  }

  /**
   * `go` moves to `next` from the screen `from`: adds its step (`stepFor`). `opening`: a sheet
   * opens with this move, and remembers whether it added a step, for `closeSheet`.
   */
  goTo(next: Route, from: Screen, fromParent: boolean, opening: boolean) {
    const step = stepFor(next, from, this.#path(), fromParent);
    if (step) this.#browser.pushState(step, "", pathFor(next));
    if (opening) this.#sheetPushed = step !== undefined;
  }

  /** On a phone the article is a screen of its own, one step on from its list. */
  openArticle() {
    this.#browser.pushState({ screen: "article", back: "list" } satisfies Step, "", this.#path());
  }

  /** The browser's Back or Forward opened a sheet: no step of ours to go back from it. */
  sheetOpenedByBrowser() {
    this.#sheetPushed = false;
  }

  /**
   * The phone's labeled back arrow, and Escape on a phone: one step back, to
   * `screen`. If that's the step before this one in the browser's history,
   * it's the same as the system's back; after arriving straight from a link
   * or a reload, it moves there in place.
   */
  back(screen: Screen) {
    if (this.cameFrom(screen)) {
      this.#browser.back();
      return;
    }
    this.#browser.replaceState({ screen }, "", this.#path());
    this.#hands.arrive(screen);
  }

  /** Closes a sheet: a step back if it opened with one, so Back doesn't reopen it. */
  closeSheet() {
    if (this.#sheetPushed && this.cameFrom("list")) this.#browser.back();
    else this.#hands.goUnder();
  }
}
