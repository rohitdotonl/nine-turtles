// The keys the reader chose for shortcuts (decision 0110), shared by every
// screen: the key reader, the cheat sheet, tooltips, menus and the welcome
// tip all read them from here, so a changed key shows everywhere at once.
// Saved for the reader's account (Settings on the server), with a copy on
// this device so they work from the first press and offline.

import { lastKeys, saveKeys } from "./feeds";
import { keyFor, keyOf, withKey, type Action, type KeyMap } from "./keyboard";

export const keys = $state<{ chosen: KeyMap }>({ chosen: lastKeys() });

/** The key for an action now, if it has one: for menus. */
export function currentKey(kind: Action["kind"]): string | undefined {
  return keyFor(kind, keys.chosen);
}

/** The key for one binding now ("text-smaller"), if it has one. */
export function currentKeyOf(id: string): string | undefined {
  return keyOf(id, keys.chosen);
}

/** A button's tooltip with its key now: "Star (S)", or "Star" once it has none. */
export function tip(label: string, id: string): string {
  return withKey(label, keyOf(id, keys.chosen));
}

/**
 * Puts the reader's new keys in place at once, and saves them. If they
 * can't be saved, the keys go back to what they were, and the caller says so.
 */
export async function chooseKeys(next: KeyMap): Promise<void> {
  const before = keys.chosen;
  keys.chosen = next;
  try {
    await saveKeys(next);
  } catch (problem) {
    keys.chosen = before;
    throw problem;
  }
}
