// The search as the signed-in screen holds it (SPEC section 14): what the
// search field holds, the search whose results the list shows, whether the
// phone's field is out, and where the keyboard was before `/`. Typing
// searches a moment after it stops; a chip or Enter searches at once.
// The field itself is SearchBar.svelte; search.ts reads and words a search.
//
// One is made for each signed-in screen (Shell.svelte), never shared, so
// nothing one reader searched is left for the next to see. Shell keeps the
// moving: going to the place, giving the field the keyboard.

import { emptyQuery, isSearching, type Query } from "./search";
import type { SavedSearch } from "./saved";
import type { Route } from "./router";

/** How long typing must stop before the list searches. */
export const SEARCH_AFTER = 300;

export class Searching {
  /** What the search field holds: chips and words. */
  query: Query = $state(emptyQuery({ kind: "view", view: "unread" }));
  /** The search whose results the list shows, or none: the place's own list. */
  shown: Query | undefined = $state();
  /**
   * On a phone the search field waits behind a Search button beside More, so
   * the list starts right under its title (decision 0060). Once asked for,
   * it stays until you press the button again with nothing searched, press
   * Escape, or go to another place: never on its own, so nothing under your
   * finger moves.
   */
  phoneField = $state(false);
  /**
   * What "Save search" or "Edit saved search" will save: the search showing
   * when it was opened (`holdForSaving`). Shell clears it once used, so Back
   * to "Save search" finds nothing to save. Going to a place keeps it.
   */
  saving: Query | undefined = $state();
  /** Where the keyboard's place was before `/`, to go back to on Escape. */
  #before: Element | null = null;
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(start: Route) {
    this.query = emptyQuery(start);
  }

  /** Searching, or about to: results show, the field holds something, or the phone's field is out. */
  get open(): boolean {
    return this.shown !== undefined || isSearching(this.query) || this.phoneField;
  }

  /** Starts afresh, limited to `place`; on a saved search, as it was saved. */
  reset(place: Route, saved?: SavedSearch) {
    this.stop();
    this.phoneField = false;
    this.query = saved ? $state.snapshot(saved.query) : emptyQuery(place);
    this.shown = saved && isSearching(saved.query) ? $state.snapshot(saved.query) : undefined;
  }

  /** The field is asked for (`/` or the phone's button); `from` had the keyboard, to give it back on Escape (left out: keep the last). */
  started(from?: Element | null) {
    if (from !== undefined) this.#before = from;
    this.phoneField = true;
  }

  /** The phone's Search button pressed again: puts the field away if nothing is searched, and answers whether it did. */
  putAway(): boolean {
    if (!this.phoneField || this.shown || isSearching(this.query)) return false;
    this.phoneField = false;
    return true;
  }

  /** The field changed: search now, or a moment after typing stops. */
  changed(next: Query, now: boolean) {
    this.query = next;
    this.stop();
    const run = () => (this.shown = isSearching(this.query) ? $state.snapshot(this.query) : undefined);
    if (now) run();
    else this.#timer = setTimeout(run, SEARCH_AFTER);
  }

  /** Escape: back to `place`'s own list; answers what had the keyboard before `/`, if anything. */
  close(place: Route, saved?: SavedSearch): Element | null {
    this.reset(place, saved);
    const back = this.#before;
    this.#before = null;
    return back;
  }

  /** What "Save search" or "Edit saved search" would save: the search showing, or else what's typed. */
  toSave(): Query {
    return $state.snapshot(this.shown ?? this.query);
  }

  /** "Save search" or "Edit saved search" opens: holds what it will save. */
  holdForSaving() {
    this.saving = this.toSave();
  }

  /** Forgets a search still waiting for typing to stop. */
  stop() {
    clearTimeout(this.#timer);
    this.#timer = undefined;
  }
}
