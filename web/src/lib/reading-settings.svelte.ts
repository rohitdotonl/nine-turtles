// The reading settings as the signed-in screen holds them (SPEC section 18):
// whether Unread is on, the sort order and the lists the sidebar hides. Each shows this device's last copy until the
// server answers, and each change shows at once and saves in the order made,
// so an earlier save that fails never rolls the screen back past a later one.
// The settings page itself is Settings.svelte; reading.ts talks to the server.
//
// One is made for each signed-in screen (Shell.svelte), never shared, so
// nothing of one reader's is left for the next to see.

import { lastHidden, lastUnread, loadSettings, saveHidden, saveKeysSeen, saveSort, saveUnread, type Order, type Reading } from "./reading";
import { savedInOrder } from "./inorder";
import type { Hideable } from "./router";

const SETTINGS = ["unread", "sort", "hidden"] as const;
type Setting = (typeof SETTINGS)[number];

export class ReadingSettings {
  /** Whether Unread is on (SPEC section 10), shared across the reader's devices; this device's last word until the server answers. */
  unread: boolean = $state(lastUnread());
  /** The reader's sort order, shared across their devices; unknown until the server answers. */
  sort: Order | undefined = $state();
  /** The lists the sidebar leaves out (Settings › Show in the sidebar, decision 0105); they still open by address and keys. */
  hidden: Hideable[] = $state(lastHidden());
  /** The reader had keys of their own, now back to nine turtles' (step 5 of the owner's review), and hasn't been told. */
  keysReset = $state(false);

  // The server's first answer, and what the reader did while it was on its
  // way. Settings › Reading waits for that answer (its choices are disabled
  // until the sort order is known), so this is a safety net: a setting changed
  // before it arrives keeps the reader's choice, unless that change couldn't be
  // saved and nothing else was, when the server's answer is shown after all.
  #answer: Reading | undefined;
  #changed = new Set<Setting>();
  #saved = new Set<Setting>();

  #unreadSaves = savedInOrder(this.#saving("unread", saveUnread), (next: boolean) => (this.unread = next));
  #sortSaves = savedInOrder<Order | undefined>(
    this.#saving("sort", (next) => saveSort(next as Order)),
    (next) => (this.sort = next),
  );
  #hiddenSaves = savedInOrder(this.#saving("hidden", saveHidden), (next: Hideable[]) => (this.hidden = next));

  /**
   * Asks the server for the reader's settings and shows them,
   * except any the reader changed while the answer was on its way: their
   * change is newer, so it stays.
   */
  async load(): Promise<void> {
    this.#changed.clear();
    this.#saved.clear();
    const answer = await loadSettings();
    this.#answer = answer;
    for (const setting of SETTINGS) if (!this.#changed.has(setting)) this.#show(setting, answer);
    this.keysReset = answer.keysReset;
  }

  /** The `?` list has told the reader their own keys are gone: not again, on any device. */
  keysSeen(): void {
    if (!this.keysReset) return;
    this.keysReset = false;
    void saveKeysSeen().catch(() => undefined);
  }

  // Each change shows at once; its promise rejects with "not saved" when the
  // newest change couldn't be saved, and the screen is back as the server has it.

  changeUnread(next: boolean): Promise<void> {
    return this.#change("unread", this.#unreadSaves(next, this.unread));
  }

  changeSort(next: Order): Promise<void> {
    return this.#change("sort", this.#sortSaves(next, this.sort));
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
    if (setting === "unread") this.unread = answer.unread;
    else if (setting === "sort") this.sort = answer.sort;
    else this.hidden = answer.hidden;
  }
}
