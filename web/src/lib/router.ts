// nine turtles' places and their web addresses, so a reload keeps you where you
// were and the browser's Back button works. No library: the browser's own
// history does the work.

export const VIEWS = ["unread", "starred", "notes", "all"] as const;
export type View = (typeof VIEWS)[number];

export type Route =
  | { kind: "view"; view: View }
  | { kind: "feed"; id: number }
  | { kind: "folder"; id: number }
  | { kind: "about"; id: number }
  | { kind: "edit-feed"; id: number }
  | { kind: "edit-source"; id: number; source: number }
  | { kind: "edit-folder"; id: number }
  | { kind: "add-feed" }
  | { kind: "new-to-feeds" }
  | { kind: "settings"; page?: SettingsPage }
  | { kind: "feed-health" }
  | { kind: "your-feeds" }
  | { kind: "muted" }
  | { kind: "readers" };

/** The Help pages on the website (decision 0157), linked from Settings and the keys sheet. */
export const HELP_URL = "https://nineturtles.app/help/";
/** One Help page by its file name in website/src/help/, such as "every-keyboard-key". */
export const helpPage = (name: string) => `${HELP_URL}${name}/`;

/**
 * Settings' own pages (decision 0120): each opens in place of Settings from a row ending in ›, at
 * /settings/<its name>, with "‹ Settings" to go back. The values are their titles.
 */
export const SETTINGS_PAGES = {
  font: "Font and line width",
  sidebar: "Show in the sidebar",
  data: "Your data",
  "add-from-anywhere": "Add from anywhere",
  install: "Install the app",
  hiding: "Hiding",
  newsletters: "Newsletters",
  "other-apps": "Other apps",
  assistants: "Connected assistants",
  passkeys: "Passkeys",
  readers: "Readers",
  plan: "Your plan",
} as const;
export type SettingsPage = keyof typeof SETTINGS_PAGES;

function settingsPage(name: string): SettingsPage | undefined {
  return Object.hasOwn(SETTINGS_PAGES, name) ? (name as SettingsPage) : undefined;
}

export const VIEW_NAMES: Record<View, string> = { unread: "Unread", starred: "Starred", notes: "Notes", all: "All" };

/**
 * The lists a reader can hide from the sidebar (Settings › Show in the sidebar, decisions 0105 and 0174). Unread, folders
 * and feeds always show; Notes only once the reader has highlighted or written a note on something (SPEC section 42).
 */
export const HIDEABLE = ["starred", "notes", "all"] as const;
export type Hideable = (typeof HIDEABLE)[number];

/** The lists the sidebar shows above the folders, top to bottom. With Unread off, All always shows: it's the home. */
export function sidebarViews(unreadOff: boolean, hidden: readonly Hideable[], anyNotes: boolean): View[] {
  return VIEWS.filter(
    (view) => !(unreadOff && view === "unread") && !((hidden as readonly string[]).includes(view) && !(unreadOff && view === "all")) && !(view === "notes" && !anyNotes),
  );
}

/**
 * Whether the person or publication whose row opens at feed `id` is a publication (decision 0163):
 * their addresses start /publications/ rather than /people/. Shell answers it once the sidebar has
 * loaded; until then everyone is at /people/, and the old /feeds/ addresses still open.
 */
let publication: (id: number) => boolean = () => false;
export function placeAddressesBy(isPublication: (id: number) => boolean) {
  publication = isPublication;
}

/** "/people/12" or "/publications/7": where a person's or publication's places are. */
function whoPath(id: number): string {
  return `/${publication(id) ? "publications" : "people"}/${id}`;
}

/** The place an address points to. Anything unknown opens Unread. */
export function parse(path: string): Route {
  const name = path.replace(/^\/+|\/+$/g, "");
  if (name === "settings") return { kind: "settings" };
  if (name === "settings/feed-health") return { kind: "feed-health" };
  if (name === "settings/feeds") return { kind: "your-feeds" };
  // The old addresses (decision 0173) still open their pages.
  if (name === "settings/hidden" || name === "settings/muted") return { kind: "muted" };
  if (name === "settings/rules") return { kind: "settings", page: "hiding" };
  if (name === "settings/readers/all") return { kind: "readers" };
  const page = name.startsWith("settings/") ? settingsPage(name.slice("settings/".length)) : undefined;
  if (page) return { kind: "settings", page };
  if (name === "add" || name === "add-feed") return { kind: "add-feed" };
  if (name === "new-to-feeds") return { kind: "new-to-feeds" };
  // A person or publication (decision 0163): their list, page, Edit, and one source's settings. The old /feeds/ addresses still open.
  const who = name.match(/^(feeds|people|publications)\/([1-9][0-9]{0,15})(\/edit|\/about|\/sources\/([1-9][0-9]{0,15}))?$/);
  if (who) {
    const id = Number(who[2]);
    if (who[4]) return { kind: "edit-source", id, source: Number(who[4]) };
    return who[3] === "/edit" ? { kind: "edit-feed", id } : who[3] === "/about" ? { kind: "about", id } : { kind: "feed", id };
  }
  const folder = name.match(/^folders\/([1-9][0-9]{0,15})(\/edit)?$/);
  if (folder) return folder[2] ? { kind: "edit-folder", id: Number(folder[1]) } : { kind: "folder", id: Number(folder[1]) };
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
      return route.page ? `/settings/${route.page}` : "/settings";
    case "feed-health":
      return "/settings/feed-health";
    case "your-feeds":
      return "/settings/feeds";
    case "muted":
      return "/settings/hidden";
    case "readers":
      return "/settings/readers/all";
    case "add-feed":
      return "/add";
    case "new-to-feeds":
      return "/new-to-feeds";
    case "feed":
      return whoPath(route.id);
    case "about":
      return `${whoPath(route.id)}/about`;
    case "edit-feed":
      return `${whoPath(route.id)}/edit`;
    case "edit-source":
      return `${whoPath(route.id)}/sources/${route.source}`;
    case "folder":
      return `/folders/${route.id}`;
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
      return route.page ? SETTINGS_PAGES[route.page] : "Settings";
    case "feed-health":
      return "Feed health";
    case "your-feeds":
      return "Your feeds";
    case "muted":
      return "Hidden articles";
    case "readers":
      return "All readers";
    case "add-feed":
      return "Add a person or publication";
    case "new-to-feeds":
      return "New to feeds?";
    case "feed":
    case "about":
      return placeName || "Someone";
    case "folder":
      return placeName || "Folder";
    case "edit-feed":
      return `Edit ${placeName || "someone"}`;
    case "edit-source":
      return "Source settings";
    case "edit-folder":
      return "Edit folder";
    case "view":
      return VIEW_NAMES[route.view];
  }
}

/** The browser tab's title, which screen readers also announce. */
export function titleFor(route: Route, placeName?: string): string {
  return `${nameFor(route, placeName)} · nine turtles`;
}

/**
 * The page a Settings page goes back to (decision 0120): Settings itself for its own pages, Feed
 * health and Your feeds; Hiding for Hidden articles; Readers for All readers. Nothing elsewhere.
 */
export function parentOf(route: Route): Route | undefined {
  if (route.kind === "settings") return route.page ? { kind: "settings" } : undefined;
  if (route.kind === "feed-health" || route.kind === "your-feeds") return { kind: "settings" };
  if (route.kind === "muted") return { kind: "settings", page: "hiding" };
  if (route.kind === "readers") return { kind: "settings", page: "readers" };
  return undefined;
}

/** The row on its parent page that opens a place (its `data-settings-row`), so the keyboard goes back to it. */
export function rowFor(route: Route): string | undefined {
  if (route.kind === "settings") return route.page;
  if (route.kind === "feed-health") return "feed-health";
  if (route.kind === "your-feeds") return "feeds";
  if (route.kind === "muted") return "muted";
  if (route.kind === "readers") return "all-readers";
  return undefined;
}

/** Settings, or a page opened from it: the sidebar's Settings button shows where you are. */
export function inSettings(route: Route): boolean {
  return route.kind === "settings" || parentOf(route) !== undefined;
}
