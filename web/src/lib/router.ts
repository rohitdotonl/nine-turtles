// slowfeed's places and their web addresses, so a reload keeps you where you
// were and the browser's Back button works. No library: the browser's own
// history does the work.

export const VIEWS = ["unread", "starred", "all"] as const;
export type View = (typeof VIEWS)[number];

export type Route = { kind: "view"; view: View } | { kind: "settings" };

export const VIEW_NAMES: Record<View, string> = { unread: "Unread", starred: "Starred", all: "All" };

/** The place an address points to. Anything unknown opens Unread. */
export function parse(path: string): Route {
  const name = path.replace(/^\/+|\/+$/g, "");
  if (name === "settings") return { kind: "settings" };
  if ((VIEWS as readonly string[]).includes(name)) return { kind: "view", view: name as View };
  return { kind: "view", view: "unread" };
}

export function pathFor(route: Route): string {
  return route.kind === "settings" ? "/settings" : `/${route.view}`;
}

/** The browser tab's title, which screen readers also announce. */
export function titleFor(route: Route): string {
  return `${route.kind === "settings" ? "Settings" : VIEW_NAMES[route.view]} · slowfeed`;
}
