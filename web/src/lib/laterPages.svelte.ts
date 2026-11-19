// Pages most openings never show (Settings and its pages, Everyone you follow,
// Muted, Readers, a folder's edit sheet, the keys sheet), in files of their
// own (decision 0314): the first screen doesn't wait for them. They're fetched
// once it's up, or at once when the address opens one, and each shows as soon
// as it's here; until then its place says so (PageWait.svelte). The service
// worker keeps them for opening offline.

import { tick } from "svelte";
import { later } from "./later";

export class LaterPages {
  Settings: typeof import("./Settings.svelte").default | undefined = $state.raw();
  YourFeeds: typeof import("./YourFeeds.svelte").default | undefined = $state.raw();
  Muted: typeof import("./Muted.svelte").default | undefined = $state.raw();
  ReadersPage: typeof import("./ReadersPage.svelte").default | undefined = $state.raw();
  EditFolder: typeof import("./EditFolder.svelte").default | undefined = $state.raw();
  CheatSheet: typeof import("./CheatSheet.svelte").default | undefined = $state.raw();
  /** They couldn't be fetched: their place says so, and loads the app again (PageWait.svelte). */
  failed = $state(false);

  /**
   * Fetches them after the first screen, or at once if `now` (the address opens one of them);
   * then `arrived`'s place takes the keyboard, unless the reader has moved it.
   */
  constructor(now: boolean, arrived: () => HTMLElement | undefined) {
    later(async () => {
      [this.Settings, this.YourFeeds, this.Muted, this.ReadersPage, this.EditFolder, this.CheatSheet] = await Promise.all([
        import("./Settings.svelte").then((file) => file.default),
        import("./YourFeeds.svelte").then((file) => file.default),
        import("./Muted.svelte").then((file) => file.default),
        import("./ReadersPage.svelte").then((file) => file.default),
        import("./EditFolder.svelte").then((file) => file.default),
        import("./CheatSheet.svelte").then((file) => file.default),
      ]).catch(() => {
        // Not asked for again: the browser would give the same failure (PageWait.svelte).
        this.failed = true;
        return [];
      });
      if (this.failed) return;
      await tick();
      if (document.activeElement === document.body || document.activeElement === null) arrived()?.focus();
    }, now);
  }
}
