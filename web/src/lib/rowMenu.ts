// A row's menu in the article list (SPEC section 6, decision 0214): what the
// reader does most to one article, without opening it. Right-click on a
// computer, a long press on a touch screen, or the Menu key (Shift+F10) with
// the keyboard on the row. The same actions have their keys and places
// elsewhere, so no key is printed here.

import type { MenuGroup, MenuItem } from "./MoreMenu.svelte";
import { plainSourceName } from "./feeds";
import type { Route } from "./router";
import type { Article, Feed } from "./shapes";
import { writesBack } from "./writeBack";

/** What the list itself does to the article: its star, and read or unread. */
export type RowHands = {
  star(article: Article): void;
  read(article: Article, read: boolean): void;
};

/** Star or Unstar, then Mark as read or unread (none with Unread off: nothing shows it), then `others`. */
export function rowMenu(article: Article, unreadOff: boolean, hands: RowHands, others: MenuItem[] = []): MenuGroup[] {
  const own: MenuItem[] = [{ label: article.starred ? "Unstar" : "Star", onSelect: () => hands.star(article) }];
  if (!unreadOff) own.push({ label: article.read ? "Mark as unread" : "Mark as read", onSelect: () => hands.read(article, !article.read) });
  return others.length ? [{ items: own }, { items: others }] : [{ items: own }];
}

/** What the reader knows of whoever wrote it (`LoadedLibrary`). */
type Library = { feeds?: Feed[]; shownAs(feed: Feed | undefined): Feed | undefined; rowOf(id: number): number };

/**
 * Write back (a person only, decision 0192) and "Info about Tomas Berg":
 * none for an article whose writer isn't followed any more.
 */
export function writerItems(article: Article, library: Library, hands: { writeBack(article: Article): void; go(place: Route): void }): MenuItem[] {
  const feed = library.feeds?.find((each) => each.id === article.feedId);
  if (!feed) return [];
  const name = plainSourceName(library.shownAs(feed)?.title ?? article.feedTitle);
  return [
    ...(writesBack(feed) ? [{ label: "Write back", onSelect: () => hands.writeBack(article) }] : []),
    { label: `Info about ${name}`, onSelect: () => hands.go({ kind: "about", id: library.rowOf(feed.id) }) },
  ];
}
