// The reading settings as the signed-in screen holds them (SPEC section 18):
// the reading mode, the sort order, unread counts, when unread lets go and
// the lists the sidebar hides. Each shows this device's last copy until the
// server answers, and each change shows at once and saves in the order made,
// so an earlier save that fails never rolls the screen back past a later one.
// The settings page itself is Settings.svelte; reading.ts talks to the server.
//
// One is made for each signed-in screen (Shell.svelte), never shared, so
// nothing of one reader's is left for the next to see.

import { lastCounts, lastHidden, lastMode, loadSettings, saveCounts, saveHidden, saveLetGo, saveMode, saveSort, type Counts, type LetGo, type Order, type ReadingMode } from "./reading";
import { savedInOrder } from "./inorder";
import { keys, keysChosenSoFar } from "./keys.svelte";
import type { Hideable } from "./router";

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

  /** How many changes the reader has made to each setting on this screen: one changed before the server's first answer keeps the reader's choice. */
  #changed = { mode: 0, sort: 0, counts: 0, letGo: 0, hidden: 0 };

  #modeSaves = savedInOrder(saveMode, (next: ReadingMode) => (this.mode = next));
  #sortSaves = savedInOrder<Order | undefined>(
    (next) => saveSort(next as Order),
    (next) => (this.sort = next),
  );
  #countsSaves = savedInOrder(saveCounts, (next: Counts) => (this.counts = next));
  #letGoSaves = savedInOrder<LetGo | undefined>(
    (next) => saveLetGo(next as LetGo),
    (next) => (this.letGo = next),
  );
  #hiddenSaves = savedInOrder(saveHidden, (next: Hideable[]) => (this.hidden = next));

  /**
   * Asks the server for the reader's settings (and their keys) and shows them,
   * except any the reader changed while the answer was on its way: their
   * change is newer, so it stays.
   */
  async load(): Promise<void> {
    const before = { ...this.#changed };
    const keysBefore = keysChosenSoFar();
    const answer = await loadSettings();
    if (this.#changed.mode === before.mode) this.mode = answer.mode;
    if (this.#changed.sort === before.sort) this.sort = answer.sort;
    if (this.#changed.counts === before.counts) this.counts = answer.counts;
    if (this.#changed.letGo === before.letGo) this.letGo = answer.letGo;
    if (this.#changed.hidden === before.hidden) this.hidden = answer.hidden;
    if (keysChosenSoFar() === keysBefore) keys.chosen = answer.keys;
  }

  // Each change shows at once; its promise rejects with "not saved" when the
  // newest change couldn't be saved, and the screen is back as the server has it.

  changeMode(next: ReadingMode): Promise<void> {
    this.#changed.mode++;
    return notSaved(this.#modeSaves(next, this.mode));
  }

  changeSort(next: Order): Promise<void> {
    this.#changed.sort++;
    return notSaved(this.#sortSaves(next, this.sort));
  }

  changeCounts(next: Counts): Promise<void> {
    this.#changed.counts++;
    return notSaved(this.#countsSaves(next, this.counts));
  }

  changeLetGo(next: LetGo): Promise<void> {
    this.#changed.letGo++;
    return notSaved(this.#letGoSaves(next, this.letGo));
  }

  changeHidden(next: Hideable[]): Promise<void> {
    this.#changed.hidden++;
    return notSaved(this.#hiddenSaves(next, this.hidden));
  }
}

function notSaved(saving: Promise<void>): Promise<void> {
  return saving.catch(() => {
    throw new Error("not saved");
  });
}
