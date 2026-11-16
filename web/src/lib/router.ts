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

/** The names of the places in the sidebar, for their addresses: a person's or publication's by the number of their row, a folder's by its own. */
export type Names = { who: (id: number) => string | undefined; folder: (id: number) => string | undefined };
/** Shell gives the names once the sidebar has loaded; until then addresses carry only their numbers. */
let names: Names = { who: () => undefined, folder: () => undefined };
export function nameAddressesBy(known: Names) {
  names = known;
}

/** One part of an address that names something by its number, after any words: "jim-nielsen-54", "54". */
const NUMBERED = "(?:[a-z0-9-]*-)?([1-9][0-9]{0,15})";
/** The number a part of an address ends with, if it's one that names something. */
function numberIn(part: string | undefined): number | undefined {
  const found = part?.match(new RegExp(`^${NUMBERED}$`));
  return found ? Number(found[1]) : undefined;
}

/**
 * Words for an address (decision 0281): lowercase letters and numbers joined by hyphens,
 * accents dropped ("Café Noël" → "cafe-noel"), cut at a whole word within `most` letters.
 * Other scripts are left out, so a title in Hindi or Japanese adds no words: its number does the work.
 */
export function addressWords(text: string, most: number): string {
  const plain = text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/ß/g, "ss").replace(/æ/g, "ae").replace(/œ/g, "oe").replace(/ø/g, "o").replace(/ł/g, "l").replace(/đ/g, "d").replace(/þ/g, "th")
    .replace(/['’]/g, "");
  let words = "";
  for (const word of plain.split(/[^a-z0-9]+/)) {
    if (!word) continue;
    if (words.length + word.length + 1 > most) break;
    words = words ? `${words}-${word}` : word;
  }
  return words;
}

/** Words with a number after them: "jim-nielsen-54", or "54" when there are none. */
const numbered = (words: string, id: number) => (words ? `${words}-${id}` : `${id}`);

/**
 * The address the browser shows for a place (decision 0281): `pathFor`'s, with the name of the
 * person, publication or folder before its number ("/jim-nielsen-54", "/folders/friends-4").
 * Only the number is read back, so a renamed person's address still opens them.
 */
export function addressFor(route: Route): string {
  const path = pathFor(route);
  const id = "id" in route ? route.id : undefined;
  const name = route.kind === "feed" || route.kind === "about" ? names.who(route.id) : route.kind === "folder" || route.kind === "edit-folder" ? names.folder(route.id) : undefined;
  return id === undefined ? path : path.replace(`/${id}`, `/${numbered(addressWords(name ?? "", 40), id)}`);
}

/** An address without the words before its numbers, as `pathFor` gives a place: "/jim-nielsen-54" → "/54". */
export function withoutWords(path: string): string {
  return path
    .split("/")
    .map((part) => numberIn(part)?.toString() ?? part)
    .join("/");
}

/** What an open article's address says: its number and title, and its writer where the list isn't theirs. */
export type Addressed = { id: number; title: string; by?: string };

/**
 * An open article's address, under its list's (decisions 0233, 0281): "/jim-nielsen-54/making-a-website-in-2026-5905",
 * "/unread/takuya-matsuyama/i-moved-39-repos-6373". With no article, the list's own.
 */
export function withArticle(list: string, article: Addressed | undefined): string {
  if (!article) return list;
  const by = addressWords(article.by ?? "", 30);
  return `${list}${by ? `/${by}` : ""}/${numbered(addressWords(article.title, 50), article.id)}`;
}

/**
 * The list's address and the article an address names, if any: "/jim-nielsen-54/a-title-29" → "/jim-nielsen-54", 29;
 * "/unread/mira-chen/a-title-29" → "/unread", 29. A list is one part of the address, a folder's two; the writer's part
 * comes only under a list that isn't theirs.
 */
export function articleIn(path: string): { list: string; article?: number } {
  const parts = path.split("/").filter(Boolean);
  const folder = parts[0] === "folders";
  const rest = parts.slice(folder ? 2 : 1);
  const byWriter = rest.length === 2 && /^[a-z0-9-]+$/.test(rest[0]!) && (folder || (VIEWS as readonly string[]).includes(parts[0]!));
  const article = rest.length === 1 || byWriter ? numberIn(rest.at(-1)) : undefined;
  return article ? { list: `/${parts.slice(0, folder ? 2 : 1).join("/")}`, article } : { list: path };
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
  // A person or publication (decisions 0163, 0281): their list ("/jim-nielsen-54"), their page and their settings (decision 0267).
  const who = name.match(new RegExp(`^${NUMBERED}(/about|/settings)?$`));
  if (who) {
    const id = Number(who[1]);
    if (who[2] === "/settings") return { kind: "about", id, settings: true };
    return who[2] ? { kind: "about", id } : { kind: "feed", id };
  }
  const folder = name.match(new RegExp(`^folders/${NUMBERED}(/edit)?$`));
  if (folder) return folder[2] ? { kind: "edit-folder", id: Number(folder[1]) } : { kind: "folder", id: Number(folder[1]) };
  if ((VIEWS as readonly string[]).includes(name)) return { kind: "view", view: name as View };
  return { kind: "view", view: "unread" };
}

/** Whether an address is one of nine turtles' places. Any other opens the "Wrong turn?" page (SPEC section 4). */
export function knownPath(path: string): boolean {
  const { list, article } = articleIn(path);
  // An article opens only under a list of articles (decision 0233).
  if (article) return knownPath(list) && isList(parse(list));
  const name = list.replace(/^\/+|\/+$/g, "");
  if (name === "" || name === "unread") return true;
  const place = parse(path);
  return !(place.kind === "view" && place.view === "unread");
}

/** A place's identity: its address by numbers alone ("/54", "/folders/4"), for comparing places. `addressFor` adds the names. */
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
      return `/${route.id}`;
    case "about":
      return `/${route.id}/${route.settings ? "settings" : "about"}`;
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
 * article's title while one is open (decision 0231), else the place's name;
 * on someone's settings, whose they are ("Settings for Mira Chen"), as that
 * page's heading says only "Settings".
 */
export function titleFor(route: Route, placeName?: string, articleTitle?: string): string {
  const whose = route.kind === "about" && route.settings ? "Settings for " : "";
  return `${articleTitle || whose + nameFor(route, placeName)} · nine turtles`;
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
