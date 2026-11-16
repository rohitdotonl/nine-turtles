// The words in nine turtles' addresses (decision 0281): the sidebar's names for people, publications
// and folders, and an open article's title and writer. router.ts builds and reads the addresses.

import { rowFor } from "./people";
import { addressFor, nameAddressesBy, withArticle, type Route } from "./router";
import { untitledOpening, type Article, type Feed, type Folder } from "./shapes";

/** Gives addresses the sidebar's names, once it has loaded. Whether it has. */
export function namePlaces(rows: Feed[] | undefined, folders: Folder[]): boolean {
  nameAddressesBy({
    who: (id) => rowFor(id, rows ?? [])?.title,
    folder: (id) => folders.find((folder) => folder.id === id)?.name,
  });
  return rows !== undefined;
}

/**
 * An open article's address under `list`: its title (an untitled post's opening words), after its
 * writer's name unless the list is theirs.
 */
export function articleAddress(article: Article, list: Route, rows: Feed[] | undefined): string {
  const row = rowFor(article.feedId, rows ?? []);
  const theirs = list.kind === "feed" && list.id === (row?.id ?? article.feedId);
  const title = article.title.trim() || (untitledOpening(article) ?? "");
  return withArticle(addressFor(list), { id: article.id, title, by: theirs ? undefined : (row?.title ?? article.feedTitle) });
}
