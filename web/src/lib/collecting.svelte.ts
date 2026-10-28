// The two collection sheets as the signed-in screen holds them (SPEC section
// 34, decision 0108): "Add to collection" for one article, and a collection's
// "Rename…". At most one is open; when it closes, the keyboard goes back to
// what opened it. The sheets themselves are AddToCollection.svelte and
// RenameCollection.svelte; collections.ts talks to the server.
//
// One is made for each signed-in screen (Shell.svelte), never shared. Shell
// keeps what the list says: it shows `closedCollecting`'s line with Undo.

import { putBack, takenOff, type Collection, type CollectionChange } from "./collections";
import { Opener } from "./navigation";
import type { Article } from "./shapes";

/** A line for the list after "Add to collection" closed, and what its Undo does. */
export type TakenOffLine = { message: string; undo: () => Promise<string | undefined> };

export class CollectionSheets {
  /** The article whose "Add to collection" sheet is open. */
  collecting: Article | undefined = $state();
  /** The collection being renamed. */
  renaming: Collection | undefined = $state();
  /** What had the keyboard when one of the two sheets opened, to give it back. */
  #opener = new Opener();

  /** "Add to collection…" or l: `from` has the keyboard now. */
  collect(article: Article, from: Element | null) {
    this.#opener.remember(from);
    this.collecting = article;
  }

  /** A collection's "Rename…": `from` has the keyboard now. */
  rename(collection: Collection, from: Element | null) {
    this.#opener.remember(from);
    this.renaming = collection;
  }

  /** Either sheet closed: the keyboard goes back to what opened it. */
  closed() {
    this.collecting = undefined;
    this.renaming = undefined;
    this.#opener.giveBack();
  }

  /**
   * "Add to collection" closed. A Save that took the article off any
   * collection answers a line saying so, with Undo, as other removals do,
   * since an article kept only by a collection could otherwise be lost to
   * the yearly clean-up. Inside a collection the article's row stays until
   * the list is next loaded: nothing moves unless you move it.
   */
  closedCollecting(change: CollectionChange | undefined, collections: Collection[]): TakenOffLine | undefined {
    const off = change ? takenOff(change, collections) : undefined;
    this.closed();
    if (!change || !off) return undefined;
    return { message: off.message, undo: () => putBack(change.article, off.ids) };
  }
}
