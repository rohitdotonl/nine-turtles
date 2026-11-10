// The reader's library as the signed-in screen holds it: the feeds they
// follow and their folders, loaded from the server and kept in order (people
// A to Z, folders in the reader's own order), and the ways to change them
// (unsubscribe, delete a folder, arrange the sidebar), each answering with
// a "… · Undo" line.
//
// One is made for each signed-in screen (Shell.svelte), never shared, so
// nothing of one reader's is left for the next to see.

import { filedAfter, saveOrder } from "./arranging";
import { change, deleteFolder, editFeed, listFeeds, refused, resubscribe, saveOpenFolders, savedOpenFolders, undoRefused, type Notice, type Refusal } from "./feeds";
import { importMessage, importOpml, undoImport } from "./importing";
import { newestAnswer } from "./inorder";
import { folderToPerson, join, joinedNotice, personOf, putBack, rowFor, rowsOf, unsubscribeAll } from "./people";
import type { Feed, Folder, Library, Person, WhoKind } from "./shapes";
import { moveAll, movedMessage, restoreFolders } from "./tidy";

/** A removal was made, with its line and Undo; or a sentence saying why it wasn't. */
export type Removed = Notice | string;

export class LoadedLibrary {
  /** The feeds you follow, alphabetically; unknown until the server answers. */
  feeds: Feed[] | undefined = $state();
  /** Your folders, in your own order (decision 0207). */
  folders: Folder[] = $state([]);
  /** The folders open in the sidebar, as this device remembers them. */
  openFolders: number[] = $state(savedOpenFolders());
  /** Opens and closes folders, remembered on this device. */
  setOpen(ids: number[]) {
    this.openFolders = ids;
    saveOpenFolders(ids);
  }
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

  /** Pauses every source of a person or publication not paused yet (dropped on the sidebar's Pause, decision 0248), with Undo. */
  async pause(row: Feed): Promise<Removed> {
    const name = this.shownAs(row)?.title ?? row.title;
    const ids = (row.places ?? [row.id]).filter((id) => this.feeds?.find((feed) => feed.id === id)?.pausedAt == null);
    if (ids.length === 0) return `${name} is already paused.`;
    const done: number[] = [];
    let problem: Refusal | undefined;
    for (const id of ids) {
      problem = await editFeed(id, { paused: true });
      if (problem) break;
      done.push(id);
    }
    await this.loadFeeds();
    if (problem && done.length === 0) return refused(problem, "feed");
    return {
      // Some of their sources paused before one couldn't be: Undo still unpauses those.
      message: problem ? `Paused some of ${name}'s feeds, not all. ${refused(problem, "feed")}` : `Paused ${name}.`,
      undo: async () => {
        let back: Refusal | undefined;
        for (const id of done) back ??= await editFeed(id, { paused: false });
        await this.loadFeeds();
        return back ? undoRefused(back, "feed") : undefined;
      },
    };
  }

  /** `row` dropped onto `into` in the sidebar (decision 0250): one person, under `into`'s name, in both their folders; Undo puts each back. */
  async joinInto(row: Feed, into: Feed): Promise<Removed> {
    const { refusal, before } = await join([into.id, row.id]);
    if (refusal) return refusal;
    await this.loadFeeds();
    return joinedNotice(this.shownAs(into)?.title ?? into.title, before, () => this.loadFeeds());
  }

  /** Whether every source of theirs is paused already (dropped on Pause, nothing would change). */
  allPaused(row: Feed): boolean {
    return (row.places ?? [row.id]).every((id) => this.feeds?.find((feed) => feed.id === id)?.pausedAt != null);
  }

  /** A list of feeds dropped on nine turtles, imported: what it brought, with Undo taking exactly that away (decision 0238). */
  async importFile(file: File): Promise<Removed> {
    const result = await importOpml(file);
    if (typeof result === "string") return result;
    await this.loadFeeds();
    const message = importMessage(result).join(" ");
    if (!result.undoable) return message;
    return {
      message,
      undo: async () => {
        const late = await undoImport();
        await this.loadFeeds();
        return late ? "It's too late to undo that." : undefined;
      },
    };
  }

  /**
   * Just followed (decision 0230): "You're following Maya Chen.", then the
   * line about any ticked feeds that couldn't be followed. Undo unfollows
   * them (nothing read or starred yet, so nothing is lost) and `back` leaves
   * their list, which is no longer there.
   */
  followed(feed: Feed, back: (notice: Notice) => void, note?: string): Notice {
    const name = this.shownAs(feed)?.title ?? feed.title;
    return {
      message: [`You're following ${name}.`, note].filter(Boolean).join(" "),
      undo: async () => {
        const { refusal } = await unsubscribeAll(feed.id);
        if (refusal) return refusal;
        await this.loadFeeds();
        back({ message: `You're no longer following ${name}.` });
        return undefined;
      },
    };
  }

  /** Deletes a folder (never its feeds): "Deleted the folder … · Undo", which puts its feeds back. */
  async deleteFolder(folder: Folder): Promise<Removed> {
    const inside = (this.feeds ?? []).filter((feed) => feed.folders.includes(folder.id)).map((feed) => feed.id);
    const order = this.folders.map((each) => each.id);
    const refusal = await deleteFolder(folder.id);
    if (refusal) return refused(refusal, "folder");
    await this.loadFeeds();
    return {
      message: `Deleted the folder ${folder.name}.`,
      undo: async () => {
        const made = await this.#remake(folder, inside, order);
        if (typeof made === "string") return undoRefused(made, "folder");
        await this.loadFeeds();
        return undefined;
      },
    };
  }

  /**
   * Makes a deleted folder again, for Undo, with these places in it, back in its place in
   * `order`: answers its new number, or why it couldn't.
   */
  async #remake(folder: Folder, feeds: number[], order: number[]): Promise<number | Refusal> {
    const { refusal, answer } = await change("/api/folders", { name: folder.name, feeds });
    const made = (answer?.folder as Folder | undefined)?.id;
    if (refusal || made === undefined) return refusal ?? "trouble";
    // Back in its place (if that can't be saved, it's back at the bottom), and open if it was.
    await saveOrder(order.map((id) => (id === folder.id ? made : id)));
    if (this.openFolders.includes(folder.id)) this.setOpen([...this.openFolders, made]);
    return made;
  }

  /** Puts the folders in this order, at once on screen: "Moved the folder Friends. · Undo". */
  async orderFolders(next: number[], folder: Folder): Promise<Removed> {
    const before = this.folders.map((each) => each.id);
    const put = (ids: number[]) => {
      this.folders = ids.map((id) => this.folders.find((each) => each.id === id)).filter((each) => each !== undefined);
    };
    put(next);
    if (await saveOrder(next)) {
      put(before);
      return `The folder ${folder.name} couldn't be moved. Try again in a moment.`;
    }
    return {
      message: `Moved the folder ${folder.name}.`,
      undo: async () => {
        put(before);
        const problem = await saveOrder(before);
        if (problem) await this.loadFeeds();
        return problem ? undoRefused(problem, "folder") : undefined;
      },
    };
  }

  /** A person or publication's places, each with the folders it's in now, for Undo. */
  #placed(row: Feed): { id: number; folders: number[] }[] {
    return (row.places ?? [row.id]).map((id) => ({ id, folders: [...(this.feeds?.find((each) => each.id === id)?.folders ?? [])] }));
  }

  /**
   * Files someone by dragging (SPEC section 5): into `to`, leaving `from` unless `keep`, or out
   * of `from` when `to` is null. Undefined when nothing changes.
   */
  async file(row: Feed, from: Folder | null, to: Folder | null, keep: boolean, kind?: WhoKind): Promise<Removed | undefined> {
    const folders = filedAfter(row.folders, from?.id ?? null, to?.id ?? null, keep);
    if (!folders) return undefined;
    const before = this.#placed(row);
    const order = this.folders.map((each) => each.id);
    const was = row.kind ?? "person";
    const changing = kind !== undefined && kind !== was;
    if (await editFeed(row.id, changing ? { folders, kind } : { folders })) return `${row.title} couldn't be moved. Try again in a moment.`;
    let said = to ? `${keep ? "Added" : "Moved"} ${row.title} to ${to.name}.` : `Took ${row.title} out of ${from?.name}.`;
    if (changing) said += ` ${row.title} is now a ${kind}.`;
    return this.#filed(before, order, said, null, changing ? { id: row.id, kind: was } : null);
  }

  /** Moves someone to one folder, out of every other, as a handle's "Move to a folder" does (`null`: no folder). */
  async moveTo(row: Feed, folder: Folder | null, newFolder: string): Promise<Removed> {
    const before = this.#placed(row);
    const order = this.folders.map((each) => each.id);
    const answer = await moveAll(row.places ?? [row.id], folder?.id ?? null, newFolder);
    if (typeof answer === "string") return refused(answer, "folder");
    const name = newFolder || folder?.name || null;
    return this.#filed(before, order, movedMessage([row.title], name), answer.created ? answer.folder : null);
  }

  /**
   * After filing someone: a folder they left with nobody in it goes too, as unsubscribing from
   * its last person does (`order` puts it back in its place on Undo), and a folder made for the
   * move goes on Undo.
   */
  async #filed(
    before: { id: number; folders: number[] }[],
    order: number[],
    said: string,
    made: number | null = null,
    kindBack: { id: number; kind: WhoKind } | null = null,
  ): Promise<Notice> {
    await this.loadFeeds();
    const left = new Set(before.flatMap((place) => place.folders));
    const empty = this.folders.filter((folder) => left.has(folder.id) && !(this.feeds ?? []).some((feed) => feed.folders.includes(folder.id)));
    // Only a folder that really went is said to have gone (and made again on Undo).
    const emptied: Folder[] = [];
    for (const folder of empty) if (!(await deleteFolder(folder.id))) emptied.push(folder);
    if (emptied.length > 0) await this.loadFeeds();
    const gone = emptied.map((folder) => ` ${folder.name} went too, as it's empty.`).join("");
    return {
      message: said + gone,
      undo: async () => {
        let back = before;
        for (const folder of emptied) {
          const again = await this.#remake(folder, [], order);
          if (typeof again === "string") return undoRefused(again, "folder");
          back = back.map((place) => ({ ...place, folders: place.folders.map((id) => (id === folder.id ? again : id)) }));
          order = order.map((id) => (id === folder.id ? again : id));
        }
        const problem = (await restoreFolders(back)) ?? (kindBack ? await editFeed(kindBack.id, { kind: kindBack.kind }) : undefined);
        if (!problem && made !== null) await deleteFolder(made);
        await this.loadFeeds();
        return problem ? undoRefused(problem, "feed") : undefined;
      },
    };
  }

  /** Someone dragged between People and Publications: "Lena Fischer is now a publication. · Undo". */
  async makeKind(row: Feed, kind: WhoKind): Promise<Removed> {
    const was = row.kind ?? "person";
    if (await editFeed(row.id, { kind })) return `${row.title} couldn't be moved. Try again in a moment.`;
    await this.loadFeeds();
    return {
      message: `${row.title} is now a ${kind}.`,
      undo: async () => {
        const problem = await editFeed(row.id, { kind: was });
        await this.loadFeeds();
        return problem ? undoRefused(problem, "feed") : undefined;
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
    const order = this.folders.map((each) => each.id);
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
        const made = await this.#remake(folder, inside, order);
        await this.loadFeeds();
        return typeof made === "string" ? undoRefused(made, "folder") : undefined;
      },
    };
  }
}
