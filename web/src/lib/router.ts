// nine turtles' places and their web addresses, so a reload keeps you where you
// were and the browser's Back button works. No library: the browser's own
// history does the work.

export const VIEWS = ["unread", "starred", "all", "recent"] as const;
export type View = (typeof VIEWS)[number];

export type Route =
  | { kind: "view"; view: View }
  | { kind: "feed"; id: number }
  | { kind: "folder"; id: number }
  | { kind: "edit-feed"; id: number }
  | { kind: "edit-folder"; id: number }
  | { kind: "search"; id: number }
  | { kind: "edit-search"; id: number }
  | { kind: "save-search" }
  | { kind: "add-feed" }
  | { kind: "new-to-feeds" }
  | { kind: "settings" }
  | { kind: "feed-health" }
  | { kind: "your-feeds" }
  | { kind: "muted" }
  | { kind: "readers" };

export const VIEW_NAMES: Record<View, string> = { unread: "Unread", starred: "Starred", all: "All", recent: "Recently read" };

/** The lists a reader can hide from the sidebar (Settings › Show in the sidebar, decision 0105). Unread, folders and feeds always show. */
export const HIDEABLE = ["starred", "all", "recent", "searches"] as const;
export type Hideable = (typeof HIDEABLE)[number];

/** The place an address points to. Anything unknown opens Unread. */
export function parse(path: string): Route {
  const name = path.replace(/^\/+|\/+$/g, "");
  if (name === "settings") return { kind: "settings" };
  if (name === "settings/feed-health") return { kind: "feed-health" };
  if (name === "settings/feeds") return { kind: "your-feeds" };
  if (name === "settings/muted") return { kind: "muted" };
  if (name === "settings/readers") return { kind: "readers" };
  if (name === "add-feed") return { kind: "add-feed" };
  if (name === "new-to-feeds") return { kind: "new-to-feeds" };
  if (name === "searches/new") return { kind: "save-search" };
  const saved = name.match(/^searches\/([1-9][0-9]{0,15})(\/edit)?$/);
  if (saved) return saved[2] ? { kind: "edit-search", id: Number(saved[1]) } : { kind: "search", id: Number(saved[1]) };
  const place = name.match(/^(feeds|folders)\/([1-9][0-9]{0,15})(\/edit)?$/);
  if (place) {
    const id = Number(place[2]);
    if (place[1] === "feeds") return place[3] ? { kind: "edit-feed", id } : { kind: "feed", id };
    return place[3] ? { kind: "edit-folder", id } : { kind: "folder", id };
  }
  if ((VIEWS as readonly string[]).includes(name)) return { kind: "view", view: name as View };
  return { kind: "view", view: "unread" };
}

/** Whether an address is one of nine turtles' places. Any other opens the "Wrong turn?" page (SPEC section 4). */
export function knownPath(path: string): boolean {
  const name = path.replace(/^\/+|\/+$/g, "");
  if (name === "" || name === "unread") return true;
  const place = parse(path);
  return !(place.kind === "view" && place.view === "unread");
}

export function pathFor(route: Route): string {
  switch (route.kind) {
    case "settings":
      return "/settings";
    case "feed-health":
      return "/settings/feed-health";
    case "your-feeds":
      return "/settings/feeds";
    case "muted":
      return "/settings/muted";
    case "readers":
      return "/settings/readers";
    case "add-feed":
      return "/add-feed";
    case "new-to-feeds":
      return "/new-to-feeds";
    case "feed":
      return `/feeds/${route.id}`;
    case "folder":
      return `/folders/${route.id}`;
    case "edit-feed":
      return `/feeds/${route.id}/edit`;
    case "edit-folder":
      return `/folders/${route.id}/edit`;
    case "search":
      return `/searches/${route.id}`;
    case "edit-search":
      return `/searches/${route.id}/edit`;
    case "save-search":
      return "/searches/new";
    case "view":
      return `/${route.view}`;
  }
}

/** A place's name, as its heading shows it. A feed's, folder's or saved search's name comes from it. */
export function nameFor(route: Route, placeName?: string): string {
  switch (route.kind) {
    case "settings":
      return "Settings";
    case "feed-health":
      return "Feed health";
    case "your-feeds":
      return "Your feeds";
    case "muted":
      return "Muted articles";
    case "readers":
      return "Readers";
    case "add-feed":
      return "Add a feed";
    case "new-to-feeds":
      return "New to feeds?";
    case "feed":
      return placeName || "Feed";
    case "folder":
      return placeName || "Folder";
    case "edit-feed":
      return "Edit feed";
    case "edit-folder":
      return "Edit folder";
    case "search":
      return placeName || "Saved search";
    case "edit-search":
      return "Edit saved search";
    case "save-search":
      return "Save search";
    case "view":
      return VIEW_NAMES[route.view];
  }
}

/** The browser tab's title, which screen readers also announce. */
export function titleFor(route: Route, placeName?: string): string {
  return `${nameFor(route, placeName)} · nine turtles`;
}
