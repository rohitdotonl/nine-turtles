// The list's heading (SPEC section 6): the place's own name ("Quiet Notes"),
// "Folder not found" for an address that names a place the reader doesn't
// have, or "Results in …" while a search's results show. The screen
// (`Shell.svelte`) hands over what it has found, so the rules for which words
// the heading shows are here, in one place, and can be tested without drawing
// anything. The browser tab's title and the phone's Back button use the same
// place name, through `titleFor` and `nameFor` in `router.ts`.
import { NOT_FOUND, type Missing } from "./listWording";
import { nameFor, type Route } from "./router";
import { resultsTitle, type Scope } from "./search";
import type { Library } from "./shapes";

/** The feed or folder the address names, if the reader has it. */
export type Places = {
  feed?: { title: string };
  folder?: { name: string };
};

/** The place's own name, for the heading, the tab's title and the phone's Back button. */
export function placeNameOf(places: Places): string | undefined {
  return places.feed?.title ?? places.folder?.name;
}

/** What the screen knows when naming the list. */
export type HeadingScene = {
  /** The place the list shows (under any sheet). */
  under: Route;
  placeName: string | undefined;
  /** The kind of place the address names that the reader doesn't have, if any. */
  missing: Missing | undefined;
  /** Where the search whose results show looks, if results show. */
  results: Scope | undefined;
  /** Feeds and folders, to name where a search looks. */
  names: Library;
};

/** The list's heading. A missing place says so first; results show their own heading. */
export function headingFor(scene: HeadingScene): string {
  if (scene.missing) return NOT_FOUND[scene.missing];
  if (scene.results) return resultsTitle(scene.results, scene.names);
  return nameFor(scene.under, scene.placeName);
}
