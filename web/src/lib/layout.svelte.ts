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
 * One thing at a time (decision 0275). On a computer (wide and medium
 * windows): the list alone beside the sidebar, as the reader has it, then
 * what opened (`reading`: an article, or a person's page) alone in the whole
 * window. On a phone-narrow window (Milestone 13): one area at a time, and
 * the sidebar is the home screen; an opened article takes the list's place.
 * Settings fills the list's area.
 */
export function panesFor(width: Width, sidebar: SidebarChoice, reading = false): Panes {
  const sidebarShown = sidebar !== "hidden";
  if (width === "narrow") return { sidebar: sidebarShown, list: !sidebarShown && !reading, article: !sidebarShown && reading };
  return reading ? { sidebar: false, list: false, article: true } : { sidebar: sidebarShown, list: true, article: false };
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
/** The sidebar's usual width, in pixels, until the reader drags it. */
const SIDEBAR_USUAL = 256;

/**
 * The signed-in screen's arrangement: the window's width step, which areas
 * show, the reader's sidebar toggle, and the width they dragged the sidebar
 * to (kept on this device). It only decides; where the keyboard goes when an
 * area hides is Shell.svelte's.
 *
 * One is made for each signed-in screen (Shell.svelte).
 */
export class ScreenLayout {
  /** The window's width step (wide, medium or narrow). */
  width: Width = $state("wide");
  /** The reader's last use of the sidebar toggle; on a phone, whether the feeds (the home screen) show. */
  sidebarChoice: SidebarChoice = $state("auto");
  /** The width the reader dragged the sidebar to, on this device; undefined is the usual width. */
  sidebarWidth: number | undefined = $state(storedWidth());

  #reading: () => boolean = () => false;
  #aside: () => boolean = () => false;

  /** Which areas show now: on a computer a person's page, or their settings, fills the window as an article does. */
  readonly panes: Panes = $derived(panesFor(this.width, this.sidebarChoice, this.#reading() || (this.width !== "narrow" && this.#aside())));
  /** A phone-narrow window: one screen at a time, with a top bar and, while reading, a bottom toolbar. */
  readonly phone: boolean = $derived(this.width === "narrow");

  /**
   * `reading` says whether an opened article shows, alone; `aside` whether a
   * person's page or their settings show. Both must read Svelte state
   * (`$state`), or `panes` won't follow them. On a phone-narrow window the
   * sidebar is the home screen, but an address that names a place opens that
   * place (`openingHome` false).
   */
  constructor(width: Width, reading: () => boolean, openingHome: boolean, aside?: () => boolean) {
    this.width = width;
    this.#reading = reading;
    if (aside) this.#aside = aside;
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

  storeSidebarWidth() {
    setDeviceText(SIDEBAR_WIDTH_KEY, this.sidebarWidth === undefined ? null : String(this.sidebarWidth));
  }

  /** On a computer, hides the sidebar or shows it again; answers whether it hid. */
  toggleSidebar(): boolean {
    const hiding = this.panes.sidebar;
    this.sidebarChoice = hiding ? "hidden" : "shown";
    return hiding;
  }

  /** The reader has gone somewhere since the screen opened (every move passes through `showHome`). */
  moved = false;

  /** On a phone, shows the feeds (the home screen) or whatever was chosen in their place. Elsewhere nothing changes. */
  showHome(home: boolean) {
    this.moved = true;
    if (this.phone) this.sidebarChoice = home ? "shown" : "hidden";
  }

  /** Whether the reader hid the sidebar, for the new version to open the same way (decision 0085). */
  carried(): Pick<Carried, "sidebar"> {
    return { sidebar: this.sidebarChoice };
  }

  /** Puts back what the page before a version switch carried; a phone starts as it always does. */
  putBack(was: Pick<Carried, "sidebar">) {
    if (!this.phone) this.sidebarChoice = was.sidebar;
  }
}

function storedWidth(): number | undefined {
  const value = Number(deviceText(SIDEBAR_WIDTH_KEY));
  return value > 0 ? value : undefined;
}
