// The words in nine turtles' addresses (decision 0281): the sidebar's names for people, publications
// and folders, and an open article's title and writer. router.ts builds and reads the addresses.

import { rowFor } from "./people";
import { addressFor, nameAddressesBy, withArticle, type Route } from "./router";
import { untitledOpening, type Article, type Feed, type Folder } from "./shapes";

/**
 * Gives addresses the sidebar's names, read as they're needed, so a link drawn before the sidebar
 * has loaded is drawn again with them, as any screen redraws with what it shows.
 */
export function nameAddressesFrom(library: { rows: Feed[] | undefined; folders: Folder[] }) {
  nameAddressesBy({
    who: (id) => rowFor(id, library.rows ?? [])?.title,
    folder: (id) => library.folders.find((folder) => folder.id === id)?.name,
  });
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
