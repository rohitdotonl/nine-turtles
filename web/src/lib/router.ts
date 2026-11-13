// nine turtles' places and their web addresses, so a reload keeps you where you
// were and the browser's Back button works. No library: the browser's own
// history does the work.

export const VIEWS = ["unread", "starred", "notes", "all"] as const;
export type View = (typeof VIEWS)[number];

export type Route =
  | { kind: "view"; view: View }
  | { kind: "feed"; id: number }
  | { kind: "folder"; id: number }
  /** Their page; `settings`: their settings, a page of its own one press from it (the `e` key and the old Edit addresses too; decision 0267). */
  | { kind: "about"; id: number; settings?: boolean }
  | { kind: "edit-folder"; id: number }
  | { kind: "add-feed" }
  | { kind: "new-to-feeds" }
  | { kind: "settings"; page?: SettingsPage }
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
  data: "Your data",
  install: "Install the app on any device",
  hiding: "Hiding",
  newsletters: "Newsletters",
  assistants: "Connected assistants",
  passkeys: "Passkeys",
  readers: "Readers",
  plan: "Your plan",
} as const;
export type SettingsPage = keyof typeof SETTINGS_PAGES;

function settingsPage(name: string): SettingsPage | undefined {
  // Add from anywhere joined Install the app on any device; its old address still lands there.
  if (name === "add-from-anywhere") return "install";
  return Object.hasOwn(SETTINGS_PAGES, name) ? (name as SettingsPage) : undefined;
}

export const VIEW_NAMES: Record<View, string> = { unread: "Unread", starred: "Starred", notes: "Notes", all: "All articles" };

/**
 * The lists the sidebar shows above the folders, top to bottom: every one, the same for everyone (decision 0187),
 * except Unread while it's off. Notes shows from the first day, so its empty list can say how to fill it (decision 0222).
 */
export function sidebarViews(unreadOff: boolean): View[] {
  return VIEWS.filter((view) => !(unreadOff && view === "unread"));
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

/**
 * An open article's address, under its list's (decision 0233): "/people/5/articles/29",
 * "/unread/articles/29". With no article, the list's own.
 */
export function withArticle(path: string, article: number | undefined): string {
  return article ? `${path}/articles/${article}` : path;
}

/** The list's address and the article an address names, if any: "/people/5/articles/29" → "/people/5", 29. */
export function articleIn(path: string): { list: string; article?: number } {
  const found = path.match(/^(.*)\/articles\/([1-9][0-9]{0,15})\/?$/);
  return found ? { list: found[1] || "/", article: Number(found[2]) } : { list: path };
}

/** A place that shows a list of articles: a view, a feed or a folder. */
export function isList(place: Route): boolean {
  return place.kind === "view" || place.kind === "feed" || place.kind === "folder";
}

/** The place an address points to (an article in it aside). Anything unknown opens Unread. */
export function parse(path: string): Route {
  const name = articleIn(path).list.replace(/^\/+|\/+$/g, "");
  if (name === "settings") return { kind: "settings" };
  // Everyone you follow has a row of its own in the sidebar (decision 0266); its old address under Settings still opens it,
  // and so does the old Feed health page's, which is part of it (decision 0186).
  if (name === "following" || name === "settings/feeds" || name === "settings/feed-health") return { kind: "your-feeds" };
  // The old addresses (decision 0173) still open their pages.
  if (name === "settings/hidden" || name === "settings/muted") return { kind: "muted" };
  if (name === "settings/rules") return { kind: "settings", page: "hiding" };
  if (name === "settings/readers/all") return { kind: "readers" };
  // Pages that went (decision 0187): Font is on Settings itself, and the sidebar shows every list.
  if (name === "settings/font" || name === "settings/sidebar") return { kind: "settings" };
  const page = name.startsWith("settings/") ? settingsPage(name.slice("settings/".length)) : undefined;
  if (page) return { kind: "settings", page };
  if (name === "add" || name === "add-feed") return { kind: "add-feed" };
  if (name === "new-to-feeds") return { kind: "new-to-feeds" };
  // A person or publication (decision 0163): their list, their page and their settings (decision 0267). The old /feeds/
  // addresses still open, and so do the old Edit and source-settings addresses, which open their settings (no Edit mode).
  const who = name.match(/^(feeds|people|publications)\/([1-9][0-9]{0,15})(\/edit|\/about|\/settings|\/sources\/([1-9][0-9]{0,15}))?$/);
  if (who) {
    const id = Number(who[2]);
    if (who[4] || who[3] === "/edit" || who[3] === "/settings") return { kind: "about", id, settings: true };
    return who[3] === "/about" ? { kind: "about", id } : { kind: "feed", id };
  }
  const folder = name.match(/^folders\/([1-9][0-9]{0,15})(\/edit)?$/);
  if (folder) return folder[2] ? { kind: "edit-folder", id: Number(folder[1]) } : { kind: "folder", id: Number(folder[1]) };
  if ((VIEWS as readonly string[]).includes(name)) return { kind: "view", view: name as View };
  return { kind: "view", view: "unread" };
}

/** Whether an address is one of nine turtles' places. Any other opens the "Wrong turn?" page (SPEC section 4). */
export function knownPath(path: string): boolean {
  const { list, article } = articleIn(path);
  const name = list.replace(/^\/+|\/+$/g, "");
  // An article opens only under a list of articles (decision 0233).
  if (article && (name === "" || !isList(parse(list)))) return false;
  if (name === "" || name === "unread") return true;
  const place = parse(path);
  return !(place.kind === "view" && place.view === "unread");
}

export function pathFor(route: Route): string {
  switch (route.kind) {
    case "settings":
      return route.page ? `/settings/${route.page}` : "/settings";
    case "your-feeds":
      return "/following";
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
      return `${whoPath(route.id)}/${route.settings ? "settings" : "about"}`;
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
    case "your-feeds":
      return "Everyone you follow";
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
    case "edit-folder":
      return "Edit folder";
    case "view":
      return VIEW_NAMES[route.view];
  }
}

/**
 * The browser tab's title, which screen readers also announce: the open
 * article's title while one is open (decision 0231), else the place's name.
 */
export function titleFor(route: Route, placeName?: string, articleTitle?: string): string {
  return `${articleTitle || nameFor(route, placeName)} · nine turtles`;
}

/**
 * The page a Settings page goes back to (decision 0120): Settings itself for its own pages;
 * Hiding for Hidden articles; Readers for All readers; their page for a person's or publication's
 * settings (decision 0267). Nothing elsewhere: Everyone you follow is a place of its own, a row
 * in the sidebar (decision 0266).
 */
export function parentOf(route: Route): Route | undefined {
  if (route.kind === "settings") return route.page ? { kind: "settings" } : undefined;
  if (route.kind === "about") return route.settings ? { kind: "about", id: route.id } : undefined;
  if (route.kind === "muted") return { kind: "settings", page: "hiding" };
  if (route.kind === "readers") return { kind: "settings", page: "readers" };
  return undefined;
}

/** The row on its parent page that opens a place (its `data-settings-row`), so the keyboard goes back to it. */
export function rowFor(route: Route): string | undefined {
  if (route.kind === "settings") return route.page;
  if (route.kind === "about") return route.settings ? "their-settings" : undefined;
  if (route.kind === "muted") return "muted";
  if (route.kind === "readers") return "all-readers";
  return undefined;
}

/** Settings, or a page opened from it: the sidebar's Settings button shows where you are. A person's own settings aren't: their row does. */
export function inSettings(route: Route): boolean {
  return route.kind === "settings" || route.kind === "muted" || route.kind === "readers";
}
