// Where the keyboard's place lands on arriving somewhere (decisions 0038 and
// 0120): a page's heading, the add field, a sheet's heading, the welcome's, or
// back on the Settings row that opened a page. The screen (`Shell.svelte`)
// binds the headings and hands over what's on screen; these choose among
// them, so the rules are in one place and can be tested without drawing
// anything. Moving between articles is `moving.ts`.
import type { Route } from "./router";

/** The places the keyboard can land, as the screen binds them. */
export interface Headings {
  list?: HTMLHeadingElement;
  sheet?: HTMLHeadingElement;
  welcome?: HTMLHeadingElement;
  settings?: HTMLHeadingElement;
  health?: HTMLHeadingElement;
  yourFeeds?: HTMLHeadingElement;
  muted?: HTMLHeadingElement;
  readers?: HTMLHeadingElement;
  add?: HTMLInputElement;
}

/** What's on screen: a phone, a sheet open, the welcome in the list's room, and the Settings row to go back to (`Move.returnRow`). */
export interface LandingScene {
  phone: boolean;
  sheetShown: boolean;
  welcome: boolean;
  returnRow?: string;
}

const settingsRow = (row: string) => document.querySelector<HTMLElement>(`[data-settings-row="${row}"]`);

/** Where the keyboard's place goes on arriving at `place`: its heading, or the add field. */
export function landingFor(place: Route, headings: Headings, scene: LandingScene): HTMLElement | undefined {
  // Edit pages bind their heading to `list` too.
  if (place.kind === "settings") {
    // Back from one of its pages: to the row that opened it, if it's there.
    return (scene.returnRow && settingsRow(scene.returnRow)) || headings.settings;
  }
  if (place.kind === "feed-health") return headings.health;
  if (place.kind === "your-feeds") return headings.yourFeeds;
  if (place.kind === "muted") return headings.muted;
  if (place.kind === "readers") return headings.readers;
  if (place.kind === "add-feed") return headings.add;
  if (place.kind === "new-to-feeds") return scene.phone ? headings.list : headings.sheet;
  // "Save search" starts in its name field, which the sheet gives the keyboard itself.
  if (scene.sheetShown) return place.kind === "save-search" ? undefined : headings.sheet;
  if (scene.welcome) return headings.welcome;
  return headings.list;
}

/**
 * Moves the keyboard's place on arriving back: the row that opened the page, when it's drawn. A
 * row shown only once its page has loaded (Rules' "Muted articles") is waited for a moment;
 * meanwhile the keyboard rests on the heading, and stays wherever the reader moves it.
 * `landing` is `landingFor` with the screen's headings; `returnRow` answers the row now, as
 * another move can change it while this waits.
 */
export function focusArriving(place: Route, landing: (place: Route) => HTMLElement | undefined, returnRow: () => string | undefined) {
  const first = landing(place);
  first?.focus();
  const row = returnRow();
  if (!row || place.kind !== "settings" || settingsRow(row)) return;
  let frames = 0;
  const wait = () => {
    if (returnRow() !== row || document.activeElement !== first) return;
    const found = settingsRow(row);
    if (found) found.focus();
    else if (++frames < 180) requestAnimationFrame(wait);
  };
  requestAnimationFrame(wait);
}
