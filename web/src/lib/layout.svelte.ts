// Which of the three areas are on screen (SPEC section 4). The layout adapts
// to the window's width only; there are no layout modes to choose. Widths are
// in rem, so zooming in or a larger system text size counts as a narrower
// window and the layout steps down, rather than anything overlapping.
// `ScreenLayout` (below) holds the signed-in screen's arrangement.

import { deviceText, setDeviceText } from "./device";
import type { Carried } from "./updates.svelte";

export type Width = "wide" | "medium" | "narrow";

/** The reader's last use of the sidebar toggle. "auto" until they use it. */
export type SidebarChoice = "auto" | "shown" | "hidden";

export const WIDE_REM = 75; // 1200px at normal size
export const MEDIUM_REM = 56; // 896px at normal size

export function widthFor(windowWidthRem: number): Width {
  if (windowWidthRem >= WIDE_REM) return "wide";
  if (windowWidthRem >= MEDIUM_REM) return "medium";
  return "narrow";
}

export type Panes = { sidebar: boolean; list: boolean; article: boolean };

/**
 * Wide: all three. Medium: two, the list and article, or the sidebar and list
 * when the sidebar is shown. Narrow (phones, Milestone 13): one at a time, and
 * the sidebar is the home screen; an opened article (`reading`) takes the
 * list's place. Settings fills the list and article areas.
 */
export function panesFor(width: Width, sidebar: SidebarChoice, reading = false, listHidden = false): Panes {
  const sidebarShown = sidebar === "auto" ? width !== "medium" : sidebar === "shown";
  switch (width) {
    case "wide":
      return { sidebar: sidebarShown, list: !listHidden, article: true };
    case "medium":
      // With the list hidden, the article takes its place (beside the sidebar, if it shows).
      if (listHidden) return { sidebar: sidebarShown, list: false, article: true };
      return { sidebar: sidebarShown, list: true, article: !sidebarShown };
    case "narrow":
      return { sidebar: sidebarShown, list: !sidebarShown && !reading, article: !sidebarShown && reading };
  }
}

/** The window's width step now, from the same rem breakpoints as `widthFor`. */
export function currentWidth(): Width {
  if (matchMedia(`(min-width: ${WIDE_REM}rem)`).matches) return "wide";
  if (matchMedia(`(min-width: ${MEDIUM_REM}rem)`).matches) return "medium";
  return widthFor(0);
}

/** Calls `changed` with the new width step whenever the window crosses a breakpoint; answers how to stop. */
export function watchWidth(changed: (next: Width) => void): () => void {
  const queries = [WIDE_REM, MEDIUM_REM].map((rem) => matchMedia(`(min-width: ${rem}rem)`));
  const crossed = () => changed(currentWidth());
  queries.forEach((query) => query.addEventListener("change", crossed));
  return () => queries.forEach((query) => query.removeEventListener("change", crossed));
}

const SIDEBAR_WIDTH_KEY = "nine-turtles.sidebar-width";
const LIST_WIDTH_KEY = "nine-turtles.list-width";
/** The sidebar's usual width, in pixels, until the reader drags it. */
const SIDEBAR_USUAL = 256;
/** The list is never narrower than this beside the article, so feed names and titles aren't squeezed (SPEC section 4). */
export const LIST_MIN = 280;
/** The widest the list can be dragged, and the room it always leaves the article. */
const LIST_MAX = 640;
const ARTICLE_MIN = 400;

function storedWidth(key: string): number | undefined {
  const value = Number(deviceText(key));
  return value > 0 ? value : undefined;
}

function storeWidth(key: string, value: number | undefined) {
  setDeviceText(key, value === undefined ? null : String(value));
}

/**
 * The signed-in screen's arrangement: the window's width step, which areas
 * show, the reader's sidebar and list toggles, and the widths they dragged
 * the sidebar and list to (kept on this device). It only decides; where the
 * keyboard goes when an area hides is Shell.svelte's.
 *
 * One is made for each signed-in screen (Shell.svelte).
 */
export class ScreenLayout {
  /** The window's width step (wide, medium or narrow). */
  width: Width = $state("wide");
  /** The reader's last use of the sidebar toggle; on a phone, whether the feeds (the home screen) show. */
  sidebarChoice: SidebarChoice = $state("auto");
  /** On a computer, the reader hid the article list (] or its button) to give the article its room. */
  listHidden = $state(false);
  /** Widths the reader dragged the sidebar and the list to, on this device; undefined is the usual width. */
  sidebarWidth: number | undefined = $state(storedWidth(SIDEBAR_WIDTH_KEY));
  listWidth: number | undefined = $state(storedWidth(LIST_WIDTH_KEY));
  /** The window's width in pixels, so the list never leaves the article less than 400px. */
  windowWidth: number = $state(0);

  #reading: () => boolean = () => false;

  /** Which areas show now. */
  readonly panes: Panes = $derived(panesFor(this.width, this.sidebarChoice, this.#reading(), this.listHidden));
  /** A phone-narrow window: one screen at a time, with a top bar and, while reading, a bottom toolbar. */
  readonly phone: boolean = $derived(this.width === "narrow");

  /**
   * `reading` says whether a phone shows an opened article in the list's
   * place; it must read Svelte state (`$state`), or `panes` won't follow it.
   * On a phone-narrow window the sidebar is the home screen, but an address
   * that names a place opens that place (`openingHome` false).
   */
  constructor(width: Width, windowWidth: number, reading: () => boolean, openingHome: boolean) {
    this.width = width;
    this.windowWidth = windowWidth;
    this.#reading = reading;
    if (width === "narrow" && !openingHome) this.sidebarChoice = "hidden";
  }

  /** The window crossed a breakpoint: the sidebar goes back to what suits the new width. */
  resized(next: Width) {
    this.width = next;
    this.sidebarChoice = "auto";
  }

  /** The sidebar's width in pixels: dragged, or usual. */
  get sidebarPx(): number {
    return this.sidebarWidth ?? SIDEBAR_USUAL;
  }

  /** The list's dragged width in pixels, never below `LIST_MIN`; undefined while it has its usual width. */
  get listPx(): number | undefined {
    return this.listWidth ? Math.max(LIST_MIN, this.listWidth) : undefined;
  }

  /** The widest the list can be dragged now, leaving the article at least 400px. */
  get listMax(): number {
    return Math.max(LIST_MIN, Math.min(LIST_MAX, this.windowWidth - (this.panes.sidebar ? this.sidebarPx : 0) - ARTICLE_MIN));
  }

  storeSidebarWidth() {
    storeWidth(SIDEBAR_WIDTH_KEY, this.sidebarWidth);
  }

  storeListWidth() {
    storeWidth(LIST_WIDTH_KEY, this.listWidth);
  }

  /** On a computer, hides the sidebar or shows it again; answers whether it hid. */
  toggleSidebar(): boolean {
    const hiding = this.panes.sidebar;
    this.sidebarChoice = hiding ? "hidden" : "shown";
    return hiding;
  }

  /** On a computer, hides the article list or shows it again; answers whether it hid. */
  toggleList(): boolean {
    const hiding = this.panes.list;
    this.listHidden = hiding;
    return hiding;
  }

  /** \: hides the sidebar and the list together, for just the article, or brings both back; answers whether they hid. */
  toggleBoth(): boolean {
    const hiding = this.panes.sidebar || this.panes.list;
    this.sidebarChoice = hiding ? "hidden" : "shown";
    this.listHidden = hiding;
    return hiding;
  }

  /** Choosing an article shows it, so on a medium window the sidebar makes way. */
  makeWayForArticle() {
    if (this.width === "medium" && this.panes.sidebar) this.sidebarChoice = "hidden";
  }

  /** On a phone, shows the feeds (the home screen) or whatever was chosen in their place. Elsewhere nothing changes. */
  showHome(home: boolean) {
    if (this.phone) this.sidebarChoice = home ? "shown" : "hidden";
  }

  /** What the reader hid, for the new version to open the same way (decision 0085). */
  carried(): Pick<Carried, "sidebar" | "listHidden"> {
    return { sidebar: this.sidebarChoice, listHidden: this.listHidden };
  }

  /** Puts back what the page before a version switch carried; a phone starts as it always does. */
  putBack(was: Pick<Carried, "sidebar" | "listHidden">) {
    if (this.phone) return;
    this.sidebarChoice = was.sidebar;
    this.listHidden = was.listHidden;
  }
}
