// Which of the three areas are on screen (SPEC section 4). The layout adapts
// to the window's width only; there are no layout modes to choose. Widths are
// in rem, so zooming in or a larger system text size counts as a narrower
// window and the layout steps down, rather than anything overlapping.

export type Width = "wide" | "medium" | "narrow";

/** The reader's last use of the sidebar toggle. "auto" until they use it. */
export type SidebarChoice = "auto" | "shown" | "hidden";

export const WIDE_REM = 75; // 1200px at normal size
export const MEDIUM_REM = 48; // 768px at normal size

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
export function panesFor(width: Width, sidebar: SidebarChoice, reading = false): Panes {
  const sidebarShown = sidebar === "auto" ? width !== "medium" : sidebar === "shown";
  switch (width) {
    case "wide":
      return { sidebar: sidebarShown, list: true, article: true };
    case "medium":
      return { sidebar: sidebarShown, list: true, article: !sidebarShown };
    case "narrow":
      return { sidebar: sidebarShown, list: !sidebarShown && !reading, article: !sidebarShown && reading };
  }
}
