// Arranging the sidebar (SPEC section 5, decision 0207): the reader's own
// order of their folders, and filing a person in a folder by dragging or by
// a handle's menu. Only the sums live here, so they're tested on their own;
// the saving is in library.svelte.ts, the dragging in sidebarDrag.ts.

import { change, type Refusal } from "./feeds";

/** Where a folder's handle menu can send it. */
export type Step = "top" | "up" | "down" | "bottom";

/** The menu's words for each step. */
export const STEP_WORDS: Record<Step, string> = {
  top: "Move to the top",
  up: "Move up",
  down: "Move down",
  bottom: "Move to the bottom",
};

/** The steps that move the folder at all: the top folder has no Move up. */
export function stepsFor(order: number[], id: number): Step[] {
  const at = order.indexOf(id);
  if (at < 0) return [];
  const steps: Step[] = [];
  if (at > 0) steps.push("top", "up");
  if (at < order.length - 1) steps.push("down", "bottom");
  return steps;
}

/** The order after one step. */
export function stepped(order: number[], id: number, step: Step): number[] {
  const at = order.indexOf(id);
  if (at < 0) return order;
  const target = { top: 0, up: at - 1, down: at + 1, bottom: order.length - 1 }[step];
  return moved(order, id, Math.max(0, Math.min(order.length - 1, target)));
}

/** The order with `id` at place `index` (counted after taking it out). */
export function moved(order: number[], id: number, index: number): number[] {
  const rest = order.filter((each) => each !== id);
  rest.splice(index, 0, id);
  return rest;
}

/** The order with `id` dropped just before `before`, or at the end when `before` is null. */
export function droppedBefore(order: number[], id: number, before: number | null): number[] {
  if (before === id) return order;
  const rest = order.filter((each) => each !== id);
  const at = before === null ? rest.length : rest.indexOf(before);
  return moved(order, id, at < 0 ? rest.length : at);
}

/** Where a folder is, counted from 1, for screen readers: "2 of 5". */
export function placeWords(order: number[], id: number): string {
  return `${order.indexOf(id) + 1} of ${order.length}`;
}

/**
 * Someone's folders after a drop: into `to` (leaving `from`, unless `keep`),
 * or out of `from` when `to` is null. Answers undefined when nothing changes.
 */
export function filedAfter(current: number[], from: number | null, to: number | null, keep: boolean): number[] | undefined {
  if (to !== null && current.includes(to)) return undefined;
  if (to === null && (from === null || !current.includes(from))) return undefined;
  const left = from !== null && !keep ? current.filter((each) => each !== from) : current;
  return to === null ? left : [...left, to];
}

/** Saves the reader's order of their folders, top to bottom. */
export async function saveOrder(ids: number[]): Promise<Refusal | undefined> {
  return (await change("/api/folders/order", { folders: ids })).refusal;
}
