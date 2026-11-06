// The reader's library as the signed-in screen holds it: the feeds they
// follow and their folders, loaded from the server and kept in order (A to
// Z), and the ways to remove one (unsubscribe, delete a folder), each
// answering with the list's "… · Undo" line.
//
// One is made for each signed-in screen (Shell.svelte), never shared, so
// nothing of one reader's is left for the next to see.

import { createFolder, deleteFolder, listFeeds, refused, resubscribe, undoRefused, type Notice } from "./feeds";
import { newestAnswer } from "./inorder";
import { folderToPerson, personOf, putBack, rowFor, rowsOf, unsubscribeAll } from "./people";
import type { Feed, Folder, Library, Person } from "./shapes";

/** A removal was made, with its line and Undo; or a sentence saying why it wasn't. */
export type Removed = Notice | string;

export class LoadedLibrary {
  /** The feeds you follow, alphabetically; unknown until the server answers. */
  feeds: Feed[] | undefined = $state();
  /** Your folders, alphabetically. */
  folders: Folder[] = $state([]);
  /** The people you joined places into (SPEC section 36). */
  people: Person[] = $state([]);
  /** The sidebar's rows, A to Z: one per person, a person's places as one (`people.ts` → `rowsOf`). */
  rows: Feed[] | undefined = $derived(this.feeds && rowsOf(this.feeds, this.people));
  /** The feeds couldn't be loaded. */
  feedsFailed = $state(false);
  /** People and folders together, as search names them: a person by their row. */
  get names(): Library {
    return { feeds: this.rows ?? [], folders: this.folders };
  }

  /** The place a person's row opens, for any of their places: the place itself, for one on its own. */
  rowOf(id: number): number {
    return rowFor(id, this.rows ?? [])?.id ?? id;
  }

  /** The place numbered `id` as the screen names it: under its person's name, if it has one. */
  shownAs(feed: Feed | undefined): Feed | undefined {
    const person = feed && personOf(feed, this.people);
    return feed && person ? { ...feed, title: person.name } : feed;
  }

  /** Counts changed on this screen since the page loaded; see `loadFeeds`. */
  #countChanges = 0;
  // A list asked for again before it arrives answers with the newest ask, so a
  // slow answer from before an unsubscribe can't put the feed back.
  #newestFeeds = newestAnswer(listFeeds);

  /** Loads the feeds and folders; `then` runs in the same step as they arrive, so nothing shows in between. */
  async loadFeeds(then?: () => void) {
    try {
      // If a mark (or an undo) changes a count while the feeds are on their
      // way, the answer may predate it: ask again, so it isn't overwritten.
      for (let tries = 0; tries < 3; tries++) {
        const before = this.#countChanges;
        const loaded = await this.#newestFeeds();
        if (this.#countChanges === before || tries === 2) {
          this.feeds = loaded.feeds;
          this.folders = loaded.folders;
          this.people = loaded.people ?? [];
          then?.();
          break;
        }
      }
      this.feedsFailed = false;
    } catch {
      this.feedsFailed = true;
    }
  }

  /** Loads the feeds again as the reader arrives on them (a phone's feeds screen): a failure keeps the dots as they were and says nothing. */
  async catchUp() {
    const failed = this.feedsFailed;
    await this.loadFeeds();
    this.feedsFailed &&= failed;
  }

  /** A mark on this screen changed a feed's unread count. */
  unreadChanged(feedId: number, change: number) {
    this.#countChanges++;
    const feed = this.feeds?.find((each) => each.id === feedId);
    if (feed) feed.unread = Math.max(0, feed.unread + change);
  }

  /** Unsubscribes from a person or publication: every source of theirs at once, with Undo bringing them all back. */
  async unsubscribe(feed: Feed, removeKept = false): Promise<Removed> {
    const name = this.shownAs(feed)?.title ?? feed.title;
    const { refusal, left } = await unsubscribeAll(feed.id, removeKept);
    if (refusal) return refusal;
    await this.loadFeeds();
    return {
      message: `Unsubscribed from ${name}.`,
      undo: async () => {
        let problem;
        for (const id of left) {
          problem = await resubscribe(id);
          if (problem) break;
        }
        // Whatever came back shows, even when one couldn't.
        await this.loadFeeds();
        return problem ? undoRefused(problem, "feed") : undefined;
      },
    };
  }

  /** Deletes a folder (never its feeds): "Deleted the folder … · Undo", which puts its feeds back. */
  async deleteFolder(folder: Folder): Promise<Removed> {
    const inside = (this.feeds ?? []).filter((feed) => feed.folders.includes(folder.id)).map((feed) => feed.id);
    const refusal = await deleteFolder(folder.id);
    if (refusal) return refused(refusal, "folder");
    await this.loadFeeds();
    return {
      message: `Deleted the folder ${folder.name}.`,
      undo: async () => {
        const problem = await createFolder(folder.name, inside);
        if (problem) return undoRefused(problem, "folder");
        await this.loadFeeds();
        return undefined;
      },
    };
  }

  /**
   * "This is one person" on a folder (SPEC section 36): its places become one person named as the
   * folder was, and the folder goes. "… is one person now · Undo" puts the places back on their
   * own and makes the folder again. Answers the place the person's row opens.
   */
  async folderToPerson(folder: Folder): Promise<(Notice & { lead: number }) | string> {
    const inside = (this.feeds ?? []).filter((feed) => feed.folders.includes(folder.id)).map((feed) => feed.id);
    const { refusal, before } = await folderToPerson(folder.id);
    // Either way the sidebar catches up: a rename saved in the same press stays saved.
    await this.loadFeeds();
    if (refusal) return refusal;
    const lead = this.rowOf(inside[0] ?? 0);
    return {
      lead,
      message: `${folder.name} is one person now.`,
      undo: async () => {
        const back = await putBack(before);
        if (back) return back;
        const refusal = await createFolder(folder.name, inside);
        await this.loadFeeds();
        return refusal ? undoRefused(refusal, "folder") : undefined;
      },
    };
  }
}
