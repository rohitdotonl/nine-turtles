// A row's menu in the article list (SPEC section 6, decision 0214): what the
// reader does most to one article, without opening it. Right-click on a
// computer, a long press on a touch screen, or the Menu key (Shift+F10) with
// the keyboard on the row. The same actions have their keys and places
// elsewhere, so no key is printed here.

import type { MenuGroup, MenuItem } from "./MoreMenu.svelte";
import { plainSourceName } from "./feeds";
import type { Route } from "./router";
import { whoIcon, type Article, type Feed } from "./shapes";
import { writesBack } from "./writeBack";

/** What the list itself does to the article: saving it, and read or unread. */
export type RowHands = {
  star(article: Article): void;
  read(article: Article, read: boolean): void;
};

/** The groups a row's menu wraps its own in: `before` its links, `after` the writer's items. */
export type RowAround = { before?: MenuGroup[]; after?: MenuGroup[] };

/**
 * Each with its icon, as every menu has (decision 0311): the groups `before`, then Save or Remove from Saved and Mark as read
 * or unread (none with Unread off: nothing shows it), then the groups `after`, leaving out any with nothing in them. The links
 * come first and the writer last, so what a row's menu shares with an article's More (Copy link, marking, Info about) comes in
 * the same order in both (decision 0316).
 */
export function rowMenu(article: Article, unreadOff: boolean, hands: RowHands, { before = [], after = [] }: RowAround = {}): MenuGroup[] {
  const own: MenuItem[] = [{ label: article.starred ? "Remove from Saved" : "Save", icon: "bookmark", onSelect: () => hands.star(article) }];
  if (!unreadOff) own.push({ label: article.read ? "Mark as unread" : "Mark as read", icon: article.read ? "dot" : "check", onSelect: () => hands.read(article, !article.read) });
  const some = (groups: MenuGroup[]) => groups.filter((group) => group.items.length > 0);
  return [...some(before), { items: own }, ...some(after)];
}

/** What a swipe left on a row can do: its word and icon, shown in the room it opens, and what letting go does. */
export type RowSwipe = { word: string; icon: "check" | "dot" | "bookmark"; run(): void };

/** A row's swipe left on a touch screen (SPEC section 20, decision 0274), nearest first: a little way marks it read or unread (not with Unread off), all the way saves it or takes it out of Saved, as its menu does. */
export function rowSwipes(article: Article, unreadOff: boolean, hands: RowHands): [RowSwipe, ...RowSwipe[]] {
  const save: RowSwipe = { word: article.starred ? "Unsave" : "Save", icon: "bookmark", run: () => hands.star(article) };
  if (unreadOff) return [save];
  return [{ word: article.read ? "Unread" : "Read", icon: article.read ? "dot" : "check", run: () => hands.read(article, !article.read) }, save];
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
    ...(writesBack(feed) ? [{ label: "Write back", icon: "send" as const, onSelect: () => hands.writeBack(article) }] : []),
    { label: `Info about ${name}`, icon: whoIcon(feed.kind), onSelect: () => hands.go({ kind: "about", id: library.rowOf(feed.id) }) },
  ];
}
