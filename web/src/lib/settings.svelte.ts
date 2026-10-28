// The reading settings as the signed-in screen holds them (SPEC section 18):
// the reading mode, the sort order, unread counts, when unread lets go and
// the lists the sidebar hides. Each shows this device's last copy until the
// server answers, and each change shows at once and saves in the order made,
// so an earlier save that fails never rolls the screen back past a later one.
// The settings page itself is Settings.svelte; reading.ts talks to the server.
//
// One is made for each signed-in screen (Shell.svelte), never shared, so
// nothing of one reader's is left for the next to see.

import { lastCounts, lastHidden, lastMode, loadSettings, saveCounts, saveHidden, saveLetGo, saveMode, saveSort, type Counts, type LetGo, type Order, type Reading, type ReadingMode } from "./reading";
import { savedInOrder } from "./inorder";
import { keysAsked } from "./keys.svelte";
import type { Hideable } from "./router";

const SETTINGS = ["mode", "sort", "counts", "letGo", "hidden"] as const;
type Setting = (typeof SETTINGS)[number];

export class ReadingSettings {
  /** Inbox or river, shared across the reader's devices; this device's last word until the server answers. */
  mode: ReadingMode = $state(lastMode());
  /** The reader's sort order, shared across their devices; unknown until the server answers. */
  sort: Order | undefined = $state();
  /** Whether the sidebar shows unread counts (Settings › Reading, decision 0097). */
  counts: Counts = $state(lastCounts());
  /** When unread lets go (decision 0097); unknown until the server answers, so its choices wait rather than show Never. */
  letGo: LetGo | undefined = $state();
  /** The lists the sidebar leaves out (Settings › Show in the sidebar, decision 0105); they still open by address and keys. */
  hidden: Hideable[] = $state(lastHidden());

  // The server's first answer, and what the reader did while it was on its
  // way. Settings › Reading waits for that answer (its choices are disabled
  // until the sort order is known), so this is a safety net: a setting changed
  // before it arrives keeps the reader's choice, unless that change couldn't be
  // saved and nothing else was, when the server's answer is shown after all.
  #answer: Reading | undefined;
  #changed = new Set<Setting>();
  #saved = new Set<Setting>();

  #modeSaves = savedInOrder(this.#saving("mode", saveMode), (next: ReadingMode) => (this.mode = next));
  #sortSaves = savedInOrder<Order | undefined>(
    this.#saving("sort", (next) => saveSort(next as Order)),
    (next) => (this.sort = next),
  );
  #countsSaves = savedInOrder(this.#saving("counts", saveCounts), (next: Counts) => (this.counts = next));
  #letGoSaves = savedInOrder<LetGo | undefined>(
    this.#saving("letGo", (next) => saveLetGo(next as LetGo)),
    (next) => (this.letGo = next),
  );
  #hiddenSaves = savedInOrder(this.#saving("hidden", saveHidden), (next: Hideable[]) => (this.hidden = next));

  /**
   * Asks the server for the reader's settings (and their keys) and shows them,
   * except any the reader changed while the answer was on its way: their
   * change is newer, so it stays.
   */
  async load(): Promise<void> {
    this.#changed.clear();
    this.#saved.clear();
    const keysArrived = keysAsked();
    const answer = await loadSettings();
    this.#answer = answer;
    for (const setting of SETTINGS) if (!this.#changed.has(setting)) this.#show(setting, answer);
    keysArrived(answer.keys);
  }

  // Each change shows at once; its promise rejects with "not saved" when the
  // newest change couldn't be saved, and the screen is back as the server has it.

  changeMode(next: ReadingMode): Promise<void> {
    return this.#change("mode", this.#modeSaves(next, this.mode));
  }

  changeSort(next: Order): Promise<void> {
    return this.#change("sort", this.#sortSaves(next, this.sort));
  }

  changeCounts(next: Counts): Promise<void> {
    return this.#change("counts", this.#countsSaves(next, this.counts));
  }

  changeLetGo(next: LetGo): Promise<void> {
    return this.#change("letGo", this.#letGoSaves(next, this.letGo));
  }

  changeHidden(next: Hideable[]): Promise<void> {
    return this.#change("hidden", this.#hiddenSaves(next, this.hidden));
  }

  /** A save that notes when the server has kept one of the reader's changes. */
  #saving<T>(setting: Setting, save: (value: T) => Promise<void>): (value: T) => Promise<void> {
    return async (value) => {
      await save(value);
      this.#saved.add(setting);
    };
  }

  #change(setting: Setting, saving: Promise<void>): Promise<void> {
    this.#changed.add(setting);
    return saving.catch(() => {
      // Rolled back to what was on screen before. If none of the reader's
      // changes reached the server, its answer (when it has come) is what it has.
      if (!this.#saved.has(setting)) {
        this.#changed.delete(setting);
        if (this.#answer) this.#show(setting, this.#answer);
      }
      throw new Error("not saved");
    });
  }

  #show(setting: Setting, answer: Reading) {
    if (setting === "mode") this.mode = answer.mode;
    else if (setting === "sort") this.sort = answer.sort;
    else if (setting === "counts") this.counts = answer.counts;
    else if (setting === "letGo") this.letGo = answer.letGo;
    else this.hidden = answer.hidden;
  }
}
