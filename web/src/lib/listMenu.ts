// The article list's More (…) menu (SPEC section 6): which rows it has, and
// what each row does. The screen (`Shell.svelte`) hands over a snapshot of
// the list as it is when the menu is drawn (`MenuScene`) and the things it can
// do (`MenuHands`), so every rule about which rows show is here, in one
// place, and can be tested without drawing anything. `MoreMenu.svelte` draws
// the groups this answers.
import type { Collection } from "./collections";
import type { Action } from "./keyboard";
import type { MenuGroup } from "./MoreMenu.svelte";
import type { Order } from "./reading";
import type { Route } from "./router";

/** The list as it is when its More menu is drawn. */
export type MenuScene = {
  /** River mode: there's no Unread view and nothing to mark as read by hand. */
  river: boolean;
  /** A search's results are showing. */
  searching: boolean;
  /** The list is Recently read or Up Next (each in its own order). */
  ownOrder: boolean;
  /** The list is Unread itself. */
  unread: boolean;
  /** An article is chosen in the list. */
  selected: boolean;
  /** The sort order, once known. */
  sort?: Order;
  /** The saved search, collection, feed or folder whose list this is. */
  savedSearch?: number;
  collection?: Collection;
  feed?: number;
  folder?: number;
};

/** What the screen does when a row is chosen. */
export type MenuHands = {
  /** The key that does the same, to show at the end of a row (none on a phone). */
  shortcut(kind: Action["kind"]): string | undefined;
  markAllRead(): void;
  markPast(side: "above" | "below"): void;
  catchUp(): void;
  refresh(): void;
  /** Saves the sort order (Settings › Reading's setting); rejects when it couldn't. */
  changeSort(next: Order): Promise<void>;
  /** A line in the list, for when something didn't work. */
  say(message: string): void;
  /** Keeps the search showing now, for "Save search" or "Edit saved search" to start from. */
  holdSearch(): void;
  go(place: Route): void;
  renameCollection(collection: Collection): void;
  deleteCollection(collection: Collection): void;
};

/**
 * The menu's rows: Mark all as read, with an article chosen Mark all above or
 * below as read (decision 0103), in Unread Catch me up, and Refresh (Refresh
 * steps aside while searching: results have nothing new to fetch), the sort
 * order, then Save search or Edit saved search, a collection's Rename and
 * Delete, or Edit feed or Edit folder in a feed's or folder's own list.
 * Choosing Edit puts the keyboard on More first, so closing the sheet gives
 * it back there.
 */
export function listMenu(scene: MenuScene, hands: MenuHands): MenuGroup[] {
  const key = hands.shortcut;
  const refresh = { label: "Refresh", shortcut: key("refresh"), onSelect: () => hands.refresh() };
  // Recently read is in the order opened, and what's in it was read already: only Refresh applies.
  // So is Up Next, in the reader's own order (decision 0113).
  if (!scene.searching && scene.ownOrder) return [{ items: [refresh] }];
  // Shift+O marks what's older: below the chosen article when newest first, above it when oldest first (decision 0103).
  // In search results, ordered by how well they match, older goes by date, so neither row shows the key.
  const olderIs = scene.searching ? undefined : scene.sort === "oldest" ? "above" : "below";
  const groups: MenuGroup[] = [
    {
      items: [
        ...(scene.river ? [] : [{ label: "Mark all as read", shortcut: key("mark-all-read"), onSelect: () => hands.markAllRead() }]),
        // Everything on one side of the chosen article, loaded yet or not (decision 0103).
        ...(scene.river || !scene.selected
          ? []
          : (["above", "below"] as const).map((side) => ({
              label: `Mark all ${side} as read`,
              shortcut: olderIs === side ? key("mark-older-read") : undefined,
              onSelect: () => hands.markPast(side),
            }))),
        // Everything in Unread from before today, listed or not (decision 0097): only in Unread itself.
        ...(!scene.river && !scene.searching && scene.unread ? [{ label: "Catch me up", onSelect: () => hands.catchUp() }] : []),
        ...(scene.searching ? [] : [refresh]),
      ],
    },
    {
      label: "Sort order",
      icon: "sort",
      items: [
        { label: "Newest first", checked: scene.sort === "newest", onSelect: () => void sortFromMenu("newest", scene, hands) },
        { label: "Oldest first", checked: scene.sort === "oldest", onSelect: () => void sortFromMenu("oldest", scene, hands) },
      ],
    },
  ];
  // On a saved search, even with everything taken out of its field, it can still be edited or deleted.
  const search = scene.savedSearch;
  if (scene.searching || search !== undefined) {
    // A search can be saved, to come back to from the sidebar; a saved one renamed, changed or deleted.
    groups.push({
      items: [
        search !== undefined
          ? { label: "Edit saved search…", onSelect: () => openSaving({ kind: "edit-search", id: search }, hands) }
          : { label: "Save search…", onSelect: () => openSaving({ kind: "save-search" }, hands) },
      ],
    });
    return groups;
  }
  // A collection's own list: renaming it, and deleting it (never its articles), with Undo (decision 0108).
  const collection = scene.collection;
  if (collection) {
    groups.push({
      items: [
        { label: "Rename…", onSelect: () => hands.renameCollection(collection) },
        { label: "Delete", onSelect: () => hands.deleteCollection(collection) },
      ],
    });
    return groups;
  }
  const { feed, folder } = scene;
  if (feed !== undefined) groups.push({ items: [{ label: "Edit feed…", shortcut: key("edit-place"), onSelect: () => hands.go({ kind: "edit-feed", id: feed }) }] });
  else if (folder !== undefined) groups.push({ items: [{ label: "Edit folder…", shortcut: key("edit-place"), onSelect: () => hands.go({ kind: "edit-folder", id: folder }) }] });
  return groups;
}

/** Opens "Save search" or "Edit saved search" with the search showing now. */
function openSaving(next: Route, hands: MenuHands) {
  hands.holdSearch();
  hands.go(next);
}

/** The sort order, chosen from the menu: the same setting as in Settings › Reading. */
async function sortFromMenu(next: Order, scene: MenuScene, hands: MenuHands) {
  if (next === scene.sort) return;
  try {
    await hands.changeSort(next);
  } catch {
    hands.say("The sort order couldn't be saved. Try again in a moment.");
  }
}
