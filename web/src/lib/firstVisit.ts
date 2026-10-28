// The first visit: before the reader follows anything, Unread and All show the
// welcome instead of a list (SPEC section 2), and "New to feeds?" opens from it
// (decision 0079). The screen (`Shell.svelte`) hands over what it knows, and
// every rule about where the welcome shows is here, so it can be tested without
// drawing anything. The welcome itself is drawn in Shell's `welcome` snippet.
import type { Route } from "./router";

/** No feeds yet, once the feeds have loaded. */
export function isFirstVisit(feeds: readonly unknown[] | undefined): boolean {
  return feeds !== undefined && feeds.length === 0;
}

/** What the screen knows when deciding where the welcome goes. */
export type WelcomeScene = {
  firstVisit: boolean;
  /** The place the list shows (under any sheet). */
  under: Route;
  /** A reading area shows beside the list. */
  article: boolean;
  phone: boolean;
  /** The address names a feed, folder, saved search or collection the reader doesn't have. */
  missing: boolean;
};

/** Where the welcome shows. */
export type Welcome = {
  /** The welcome shows instead of the list. */
  shown: boolean;
  /**
   * With a reading area beside the list, the welcome takes the list's room too: one empty state,
   * not an empty column beside it, as Apple Books shows (decision 0048).
   */
  wide: boolean;
  /** On a phone, the welcome is the screen's one visible heading; the list's title is only for screen readers. */
  alone: boolean;
};

export function welcomeFor(scene: WelcomeScene): Welcome {
  // Starred keeps its own list even with no feeds: it is where its More menu and sort live.
  const starred = scene.under.kind === "view" && scene.under.view === "starred";
  const shown = scene.firstVisit && !starred;
  return {
    shown,
    wide: shown && scene.article && !scene.missing,
    alone: shown && scene.phone && !scene.missing,
  };
}

/**
 * "New to feeds?" belongs to the first visit only (decision 0079): once anything is followed, its
 * address (Back after adding starters, a bookmark) quietly becomes the home view instead. True when
 * the screen should make that swap; false while the feeds are still unknown.
 */
export function newToFeedsGivesWay(route: Route, feeds: readonly unknown[] | undefined): boolean {
  return route.kind === "new-to-feeds" && feeds !== undefined && feeds.length > 0;
}
