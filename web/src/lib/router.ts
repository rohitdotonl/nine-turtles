// slowfeed's places and their web addresses, so a reload keeps you where you
// were and the browser's Back button works. No library: the browser's own
// history does the work.

export const VIEWS = ["unread", "starred", "all"] as const;
export type View = (typeof VIEWS)[number];

export type Route =
  | { kind: "view"; view: View }
  | { kind: "feed"; id: number }
  | { kind: "folder"; id: number }
  | { kind: "edit-feed"; id: number }
  | { kind: "edit-folder"; id: number }
  | { kind: "add-feed" }
  | { kind: "settings" };

export const VIEW_NAMES: Record<View, string> = { unread: "Unread", starred: "Starred", all: "All" };

/** The place an address points to. Anything unknown opens Unread. */
export function parse(path: string): Route {
  const name = path.replace(/^\/+|\/+$/g, "");
  if (name === "settings") return { kind: "settings" };
  if (name === "add-feed") return { kind: "add-feed" };
  const place = name.match(/^(feeds|folders)\/([1-9][0-9]{0,15})(\/edit)?$/);
  if (place) {
    const id = Number(place[2]);
    if (place[1] === "feeds") return place[3] ? { kind: "edit-feed", id } : { kind: "feed", id };
    return place[3] ? { kind: "edit-folder", id } : { kind: "folder", id };
  }
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
    case "folder":
      return `/folders/${route.id}`;
    case "edit-feed":
      return `/feeds/${route.id}/edit`;
    case "edit-folder":
      return `/folders/${route.id}/edit`;
    case "view":
      return `/${route.view}`;
  }
}

/** A place's name, as its heading shows it. A feed's or folder's name comes from it. */
export function nameFor(route: Route, placeName?: string): string {
  switch (route.kind) {
    case "settings":
      return "Settings";
    case "add-feed":
      return "Add a feed";
    case "feed":
      return placeName || "Feed";
    case "folder":
      return placeName || "Folder";
    case "edit-feed":
      return "Edit feed";
    case "edit-folder":
      return "Edit folder";
    case "view":
      return VIEW_NAMES[route.view];
  }
}

/** The browser tab's title, which screen readers also announce. */
export function titleFor(route: Route, placeName?: string): string {
  return `${nameFor(route, placeName)} · slowfeed`;
}
