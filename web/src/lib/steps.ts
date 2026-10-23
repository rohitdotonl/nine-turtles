// On a phone the app is one column you move through: Feeds → Items → Article
// (SPEC section 20). Each move is a step in the browser's own history, so the
// system back gesture and back button go back one step, the same as the
// labeled back arrow. A step remembers which screen it shows and which screen
// came just before it, so the back arrow knows whether going back is a step
// back in history or, after arriving straight from a link or a reload, a move
// in place.

/** The feeds list (home on a phone), a list of articles, an open article, or a page such as Settings. */
export type Screen = "home" | "list" | "article" | "page";

export type Step = { screen: Screen; back?: Screen };

const SCREENS: readonly string[] = ["home", "list", "article", "page"];

/** The step a history entry holds, if slowfeed made it. */
export function stepOf(state: unknown): Step | undefined {
  if (typeof state !== "object" || state === null) return undefined;
  const { screen, back } = state as Record<string, unknown>;
  if (typeof screen !== "string" || !SCREENS.includes(screen)) return undefined;
  return { screen: screen as Screen, back: typeof back === "string" && SCREENS.includes(back) ? (back as Screen) : undefined };
}

/**
 * The step the app opens on. A reload keeps the screen it was on, except an
 * open article: what was selected isn't remembered, so it opens its list.
 * The front page on a phone opens the feeds list.
 */
export function startingStep(state: unknown, narrow: boolean, path: string, list: boolean): Step {
  const before = stepOf(state);
  if (before?.screen === "home" || (!before && narrow && (path === "/" || path === ""))) return { screen: "home" };
  if (before?.screen === "article") return { screen: "list", back: undefined };
  return { screen: list ? "list" : "page", back: before?.back };
}
