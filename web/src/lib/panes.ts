// Moving between the wide window's panes by the arrow keys (SPEC section 19,
// the owner's core path, point 17): ← and → go from the sidebar to the list
// to the article, and ↑ and ↓ go along the sidebar's rows. The list's own
// ↑ and ↓ are the list's (`ItemList.svelte`), and in the article they scroll
// it, as the browser does. This file only finds where the keyboard's place
// goes; `keyboard.ts` decides when an arrow is nine turtles' to act on.

const SIDEBAR = 'nav[aria-label="Sidebar"]';

/** The panes in view, left to right: the sidebar, the list, the article or their page. */
function panesShown(): HTMLElement[] {
  const found = [
    document.querySelector<HTMLElement>(SIDEBAR),
    document.querySelector<HTMLElement>("#list-pane"),
    document.querySelector<HTMLElement>('section[aria-label="Article"], .who-page'),
  ];
  return found.filter((pane): pane is HTMLElement => pane !== null && !pane.closest("[hidden]") && pane.getClientRects().length > 0);
}

/** Where the keyboard's place lands in a pane: where you are in it, else its first row or its heading. */
function landingIn(pane: HTMLElement): HTMLElement | null {
  if (pane.matches(SIDEBAR)) return pane.querySelector<HTMLElement>("a[aria-current]") ?? pane.querySelector<HTMLElement>("a[href]");
  if (pane.id === "list-pane") return pane.querySelector<HTMLElement>("li button[tabindex='0']") ?? pane.querySelector<HTMLElement>("h2[tabindex='-1']");
  return pane.querySelector<HTMLElement>("h2[tabindex='-1']") ?? pane.querySelector<HTMLElement>("h2");
}

/** ← and →: the pane before or after the one the keyboard is in. Outside every pane, → starts at the list. */
export function movePane(step: 1 | -1): void {
  const panes = panesShown();
  const at = document.activeElement;
  const here = panes.findIndex((pane) => pane.contains(at));
  const next = here === -1 ? panes.findIndex((pane) => pane.id === "list-pane") : here + step;
  const pane = panes[next];
  if (!pane) return;
  const landing = landingIn(pane);
  if (!landing) return;
  if (!landing.hasAttribute("tabindex") && !landing.matches("a[href], button")) landing.setAttribute("tabindex", "-1");
  landing.focus({ preventScroll: !pane.matches(SIDEBAR) && pane.id !== "list-pane" });
}

/** ↑ and ↓ in the sidebar: the row above or below, in the order it shows them. */
export function moveRow(step: 1 | -1): void {
  const sidebar = document.querySelector<HTMLElement>(SIDEBAR);
  if (!sidebar) return;
  const rows = [...sidebar.querySelectorAll<HTMLElement>("a[href]")].filter((row) => row.getClientRects().length > 0);
  const at = document.activeElement;
  // On a folder's open/close button, or another of the sidebar's buttons, the row it belongs to counts.
  const before = at ? rows.filter((row) => row === at || row.compareDocumentPosition(at) & Node.DOCUMENT_POSITION_FOLLOWING) : [];
  const here = before.length === 0 ? -1 : rows.indexOf(before.at(-1)!);
  const onRow = here !== -1 && rows[here] === at;
  rows[here === -1 ? 0 : onRow || step === 1 ? here + step : here]?.focus();
}

/** Whether the keyboard's place is in the sidebar, where ↑ and ↓ go along its rows. */
export function inSidebar(target: EventTarget | null): boolean {
  return typeof HTMLElement !== "undefined" && target instanceof HTMLElement && target.closest(SIDEBAR) !== null;
}
