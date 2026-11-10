// What the reader typed and hasn't saved yet, kept on this device so that
// nothing they wrote is thrown away by a slip (DESIGN.md → "Forgiving",
// decision 0235): a half-written note, an Edit or a sheet left by a stray
// click, Escape or Back. Each draft has a name ("note:article:12",
// "edit:feed:3") and is kept for each reader, until it's saved or the
// reader throws it away themselves (Discard, Cancel). Nothing is ever
// dropped on a timer.

import { deviceJson, deviceStorage, setDeviceText } from "./device";
import { isRecord } from "./http";
import { currentTabReader } from "./updates.svelte";

function key(): string {
  return `nine-turtles.drafts.${currentTabReader() ?? "me"}`;
}

function all(): Record<string, unknown> {
  const saved = deviceJson(key());
  return isRecord(saved) ? saved : {};
}

/** Forgets every reader's drafts on this device: signed out, or another reader signed in, nothing of theirs is left behind (SPEC section 32). */
export function forgetDrafts(): void {
  try {
    const storage = deviceStorage();
    if (!storage) return;
    const names = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((name): name is string => name?.startsWith("nine-turtles.drafts.") === true);
    for (const name of names) storage.removeItem(name);
  } catch {
    // Nothing was kept on this device to begin with.
  }
}

/** The draft kept under `name`, if any. */
export function keptDraft(name: string): unknown {
  return all()[name];
}

/** Keeps `value` as the draft under `name`; undefined forgets it. */
export function keepDraft(name: string, value: unknown): void {
  const drafts = all();
  if (value === undefined) {
    if (!(name in drafts)) return;
    delete drafts[name];
  } else drafts[name] = value;
  setDeviceText(key(), Object.keys(drafts).length > 0 ? JSON.stringify(drafts) : null);
}

/** Keeps `now` under `name` while it differs from what was there to start with (`start`); once they're the same again, forgets it. */
export function keepWhileChanged<T>(name: string, now: T, start: T): void {
  keepDraft(name, JSON.stringify(now) === JSON.stringify(start) ? undefined : now);
}

/** Moves a draft to a new name (a highlight made offline, given its number by the server). */
export function renameDraft(from: string, to: string): void {
  const kept = keptDraft(from);
  if (kept === undefined) return;
  keepDraft(to, kept);
  keepDraft(from, undefined);
}

/** The kept draft under `name` when it's words (a note), else undefined. */
export function keptWords(name: string): string | undefined {
  const kept = keptDraft(name);
  return typeof kept === "string" ? kept : undefined;
}

/** A note's words, worth keeping: not empty, and not only the time a video was at when it was started ("12:34 "). */
export function worthKeeping(words: string, start: string): boolean {
  const clean = words.trim();
  return clean !== start.trim() && clean !== "" && !/^\d+(:\d\d)+$/.test(clean);
}
