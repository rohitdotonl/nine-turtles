// The keys the reader chose for shortcuts (decision 0110), shared by every
// screen: the key reader, the cheat sheet, tooltips, menus and the welcome
// tip all read them from here, so a changed key shows everywhere at once.
// Saved for the reader's account (Settings on the server), with a copy on
// this device so they work from the first press and offline.

import { forgetKeys, lastKeys, saveKeys } from "./feeds";
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

/** Keys saved one after another, so the server always ends with the latest. */
let saving: Promise<unknown> = Promise.resolve();
/** The latest change, and the keys the server last confirmed. */
let changes = 0;
let unsaved = 0;
let confirmed: KeyMap = keys.chosen;

/**
 * Puts the reader's new keys in place at once, and saves them. Each save
 * sends the whole set, so a newer change carries an older one with it: an
 * older save that fails is left to the newer one. If the newest can't be
 * saved, the keys go back to the last ones the server has, and the caller
 * says so; screen and server never disagree.
 */
export async function chooseKeys(next: KeyMap): Promise<void> {
  if (unsaved === 0) confirmed = keys.chosen;
  const mine = ++changes;
  unsaved++;
  keys.chosen = next;
  const sent = saving.then(() => saveKeys(next));
  saving = sent.catch(() => undefined);
  try {
    await sent;
    confirmed = next;
  } catch (problem) {
    if (mine !== changes) return;
    keys.chosen = confirmed;
    throw problem;
  } finally {
    unsaved--;
  }
}

/** Signed out: this device's copy goes, and the keys are nine turtles' own until the next reader's arrive. */
export function forgetChosenKeys(): void {
  forgetKeys();
  keys.chosen = {};
  confirmed = {};
}
