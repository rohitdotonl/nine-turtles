// Stepping through articles and feeds with the keyboard (SPEC section 19): j
// and k go to the next or previous article, n and Shift+N to the next or
// previous unread one (decision 0103), Home and End to the first or last
// loaded (decision 0110), and Shift+J and Shift+K to the feed after or before
// the place you're in. The screen (`Shell.svelte`) hands over its list and
// what's on screen, and these say where a move goes and where the keyboard's
// place follows, so the rules are in one place and can be tested without
// drawing anything. Which key does which is `keyboard.ts`; when each applies
// is `shortcuts.ts`.
import { feedNextTo, savedOpenFolders } from "./feeds";
import type { Panes } from "./layout.svelte";
import type { Route } from "./router";
import type { Feed, Folder } from "./shapes";

/** Which article to go to, named by the list's own way there: the next or previous, the next or previous unread, or the first or last loaded. */
export type ArticleMove = keyof MovingList;

/** What's on screen at the moment of the move: the list and reading area, an article open on a phone (`reading`), and whether the keyboard's place is in the reading area. */
export type MoveScene = Pick<Panes, "list" | "article"> & { reading: boolean; inArticle: boolean };

/** The article list as a move sees it (`ItemList.svelte`); each move answers whether it went anywhere. */
export interface MovingList {
  move(step: 1 | -1): boolean;
  moveUnread(step: 1 | -1): boolean;
  moveToEnd(step: 1 | -1): boolean;
}

/**
 * Goes to another article in the list, and answers where the keyboard's
 * place follows: to the new article if you were reading, otherwise to its
 * row in the list. With the list hidden there's no row to go to, so the
 * article keeps the keyboard. At either end of the list nothing moves, and
 * the answer is nothing.
 */
export function moveArticle(list: MovingList | undefined, to: ArticleMove, step: 1 | -1, scene: MoveScene): "article" | "row" | undefined {
  // Only with the list, the reading area or an article showing (Enter, `open` in `Shell.svelte`, asks the same).
  if (!list || (!scene.list && !scene.article && !scene.reading)) return undefined;
  const wasReading = scene.reading || scene.inArticle || !scene.list;
  if (!list[to](step)) return undefined;
  return wasReading ? "article" : "row";
}

/**
 * Shift+J and Shift+K: the feed after or before the place you're in, in the
 * sidebar's order (`feedNextTo`, decision 0110). On a phone every folder
 * counts as open, as there's no sidebar to fold them; on a computer, the
 * folders open in the sidebar (`openInSidebar`) or, while it isn't drawn,
 * those this device remembers as open.
 */
export function nextFeed(library: { feeds: Feed[] | undefined; folders: Folder[] }, phone: boolean, openInSidebar: number[] | undefined, here: Route, step: 1 | -1): Route | undefined {
  const { feeds, folders } = library;
  if (!feeds) return undefined;
  const open = phone ? folders.map((folder) => folder.id) : (openInSidebar ?? savedOpenFolders());
  const id = feedNextTo({ feeds, folders }, open, here, step);
  return id === undefined ? undefined : { kind: "feed", id };
}
