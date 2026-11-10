// Mark all as read's Undo outlives the list it was done in (SPEC section 8,
// decision 0238): a slip is often noticed one step later, in another list.
// Each list (`ItemList.svelte`) is made afresh when you go to another, so the
// last Mark all as read waits here, with the articles it marked, until the
// reader does something else that can be undone (or undoes it). The list
// arriving next shows it in its note, naming where it happened, or, if the
// note was closed, keeps it on `u` only.
import type { Article } from "./shapes";

export type MarkedAll = {
  /** "Marked 3 articles as read in Reading Room." */
  message: string;
  /** The articles it marked, which Undo marks unread again. */
  articles: Article[];
  /** The note was put away: `u` still undoes, but nothing shows. */
  closed: boolean;
};

let last: MarkedAll | undefined;

/** The last Mark all as read, while it's still the last undoable action. */
export function lastMarkAll(): MarkedAll | undefined {
  return last;
}

/** A new undoable action happened (`undefined` for any but Mark all as read), or the last one was undone. */
export function rememberMarkAll(next: MarkedAll | undefined) {
  last = next;
}
