// The article list's More (…) menu (SPEC section 6): which rows it has, and
// what each row does. The screen (`Shell.svelte`) hands over a snapshot of
// the list as it is when the menu is drawn (`MenuScene`) and the things it can
// do (`MenuHands`), so every rule about which rows show is here, in one
// place, and can be tested without drawing anything. `MoreMenu.svelte` draws
// the groups this answers.
import type { Action } from "./keyboard";
import type { MenuGroup } from "./MoreMenu.svelte";
import type { Order } from "./reading";
import type { Route } from "./router";

/** The list as it is when its More menu is drawn. */
export type MenuScene = {
  /** Unread off: there's no Unread view and nothing to mark as read by hand. */
  unreadOff: boolean;
  /** A search's results are showing. */
  searching: boolean;
  /** The sort order, once known. */
  sort?: Order;
  /** The feed or folder whose list this is. */
  feed?: number;
  /** The person's or publication's name, for "Info about Alpha". */
  feedName?: string;
  folder?: number;
};

/** What the screen does when a row is chosen. */
export type MenuHands = {
  /** The key that does the same, to show at the end of a row (none on a phone). */
  shortcut(kind: Action["kind"]): string | undefined;
  markAllRead(): void;
  refresh(): void;
  /** Saves the sort order (shared across the reader's devices; only here, decision 0241); rejects when it couldn't. */
  changeSort(next: Order): Promise<void>;
  /** A line in the list, for when something didn't work. */
  say(message: string): void;
  go(place: Route): void;
};

/**
 * The menu's rows: Mark all as read (the one way to set down a backlog,
 * decision 0171) and Refresh (Refresh steps aside while searching: results have nothing new to fetch), the sort
 * order, then About in a person's or publication's own list, or Edit folder
 * in a folder's. Choosing Edit puts the keyboard on More first, so closing the sheet gives
 * it back there.
 */
export function listMenu(scene: MenuScene, hands: MenuHands): MenuGroup[] {
  const key = hands.shortcut;
  const refresh = { label: "Refresh", shortcut: key("refresh"), onSelect: () => hands.refresh() };
  const groups: MenuGroup[] = [
    {
      items: [
        ...(scene.unreadOff ? [] : [{ label: "Mark all as read", shortcut: key("mark-all-read"), onSelect: () => hands.markAllRead() }]),
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
  if (scene.searching) return groups;
  const { feed, folder } = scene;
  // The way to their page (and from it, Edit), the same words for a person and a publication (decision 0163).
  if (feed !== undefined) groups.push({ items: [{ label: `Info about ${scene.feedName ?? "them"}`, shortcut: key("about"), onSelect: () => hands.go({ kind: "about", id: feed }) }] });
  else if (folder !== undefined) groups.push({ items: [{ label: "Edit folder…", shortcut: key("edit"), onSelect: () => hands.go({ kind: "edit-folder", id: folder }) }] });
  return groups;
}

/**
 * The sort order, chosen from the menu: the one place for it (decision 0241), shared across the reader's devices.
 * It compares with the order the menu was drawn with; the screen draws the
 * menu again whenever the setting changes, so that is the order showing now.
 */
async function sortFromMenu(next: Order, scene: MenuScene, hands: MenuHands) {
  if (next === scene.sort) return;
  try {
    await hands.changeSort(next);
  } catch {
    hands.say("The sort order couldn't be saved. Try again in a moment.");
  }
}
