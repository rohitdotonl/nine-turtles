// slowfeed's places and their web addresses, so a reload keeps you where you
// were and the browser's Back button works. No library: the browser's own
// history does the work.

export const VIEWS = ["unread", "starred", "all"] as const;
export type View = (typeof VIEWS)[number];

export type Route =
  | { kind: "view"; view: View }
  | { kind: "feed"; id: number }
  | { kind: "add-feed" }
  | { kind: "settings" };

export const VIEW_NAMES: Record<View, string> = { unread: "Unread", starred: "Starred", all: "All" };

/** The place an address points to. Anything unknown opens Unread. */
export function parse(path: string): Route {
  const name = path.replace(/^\/+|\/+$/g, "");
  if (name === "settings") return { kind: "settings" };
  if (name === "add-feed") return { kind: "add-feed" };
  const feed = name.match(/^feeds\/([1-9][0-9]{0,15})$/);
  if (feed) return { kind: "feed", id: Number(feed[1]) };
  if ((VIEWS as readonly string[]).includes(name)) return { kind: "view", view: name as View };
  return { kind: "view", view: "unread" };
}

export function pathFor(route: Route): string {
  switch (route.kind) {
    case "settings":
      return "/settings";
    case "add-feed":
      return "/add-feed";
    case "feed":
      return `/feeds/${route.id}`;
    case "view":
      return `/${route.view}`;
  }
}

/** A place's name, as its heading shows it. A feed's name comes from the feed. */
export function nameFor(route: Route, feedTitle?: string): string {
  switch (route.kind) {
    case "settings":
      return "Settings";
    case "add-feed":
      return "Add a feed";
    case "feed":
      return feedTitle || "Feed";
    case "view":
      return VIEW_NAMES[route.view];
  }
}

/** The browser tab's title, which screen readers also announce. */
export function titleFor(route: Route, feedTitle?: string): string {
  return `${nameFor(route, feedTitle)} · slowfeed`;
}
