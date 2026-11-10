<!--
  Everyone you follow (SPEC section 15, decision 0186), opened from
  Settings. Who isn't working comes first (NotWorking.svelte). Then
  everyone, A to Z, People and Publications apart as in the sidebar, each
  row saying the title of their newest piece and when it came, or "Quiet
  since …" after six months, and their folders. A row opens their page.
  Choose…, as Edit in Apple Books, puts a tick box on each row; with some
  chosen, the bar at the foot moves them to one folder or unsubscribes from
  them all, in one go, with one Undo until your next action. Last,
  Recently unsubscribed: who was left in the last 30 days, each with Bring
  back (RecentlyUnsubscribed.svelte, decision 0240).
-->
<script lang="ts">
  import Dated from "./Dated.svelte";
  import type { LoadedLibrary } from "./library.svelte";
  import { onMount, tick } from "svelte";
  import { edge } from "./edge";
  import Icon from "./Icon.svelte";
  import NotWorking from "./NotWorking.svelte";
  import RecentlyUnsubscribed from "./RecentlyUnsubscribed.svelte";
  import type { Kept } from "./recentlyUnsubscribed";
  import { shortName } from "./assistants";
  import PageHead from "./PageHead.svelte";
  import MoveSheet from "./MoveSheet.svelte";
  import type { Folder } from "./shapes";
  import { deleteFolder, explain, refused, undoRefused } from "./feeds";
  import { UNDONE } from "./messages";
  import NoteLine from "./NoteLine.svelte";
  import LoadFailed from "./LoadFailed.svelte";
  import { pathFor } from "./router";
  import {
    folderNames,
    listTended,
    bringBackAll,
    moveAll,
    movedMessage,
    placeIds,
    resubscribeAll,
    restoreFolders,
    rowLine,
    unsubscribeAll,
    unsubscribedMessage,
    type Tended,
  } from "./tidy";

  let {
    heading = $bindable(),
    onClose,
    onOpenPerson,
    onFeedsChanged,
    besideToggle = false,
    library,
  }: {
    heading?: HTMLHeadingElement;
    onClose: () => void;
    /** A row was chosen, out of Choose: their page opens. */
    onOpenPerson: (event: MouseEvent, id: number) => void;
    /** Feeds were moved, unsubscribed from or brought back: the sidebar reloads. */
    onFeedsChanged: () => void;
    besideToggle?: boolean;
    /** Who's who, for Write to on a person's Not working card (decision 0212). */
    library: LoadedLibrary;
  } = $props();

  let feeds: Tended[] | undefined = $state();
  let folders: Folder[] = $state([]);
  let kept: Kept[] = $state([]);
  let failed = $state(false);
  let editing = $state(false);
  let chosen: number[] = $state([]);
  let busy = $state(false);
  /** What the last action said, and its Undo until the next action. */
  let message = $state("");
  let undo: (() => Promise<void>) | undefined = $state();
  /** The message says something failed: oxblood, with the alert icon. */
  let refusal = $state(false);
  let moving = $state(false);
  let editButton: HTMLButtonElement | undefined = $state();
  let undoButton: HTMLButtonElement | undefined = $state();
  let notWorking: NotWorking | undefined = $state();

  let listed = $derived(feeds ?? []);
  /** People, then Publications, as the sidebar lists them; a group with nobody in it isn't shown. */
  let groups = $derived(
    [
      { id: "people", name: count(listed.filter((feed) => feed.kind === "person").length, "person", "people"), kind: "person" },
      { id: "publications", name: count(listed.filter((feed) => feed.kind === "publication").length, "publication", "publications"), kind: "publication" },
    ]
      .map((group) => ({ ...group, rows: listed.filter((feed) => feed.kind === group.kind) }))
      .filter((group) => group.rows.length > 0),
  );
  let allChosen = $derived(listed.length > 0 && listed.every((feed) => chosen.includes(feed.id)));

  function count(how: number, one: string, many: string): string {
    return `${how} ${how === 1 ? one : many}`;
  }

  /** Someone at the top was unsubscribed from, brought back or moved: the list below follows. */
  function healthChanged() {
    onFeedsChanged();
    load();
  }

  async function load() {
    try {
      ({ feeds, folders, kept } = await listTended());
      failed = false;
    } catch {
      failed = true;
    }
  }

  onMount(() => {
    load();
  });

  /** Undo lasts until your next action here. */
  function endUndo() {
    [message, undo, refusal] = ["", undefined, false];
  }

  /** × on the line: it goes, and the keyboard's place goes to Choose…. */
  async function closeNote() {
    endUndo();
    await tick();
    editButton?.focus();
  }

  function toggleEditing() {
    editing = !editing;
    chosen = [];
    endUndo();
  }

  function chooseAll() {
    chosen = allChosen ? [] : listed.map((feed) => feed.id);
    endUndo();
  }

  /** The chosen ones. */
  function picked(): Tended[] {
    return listed.filter((feed) => chosen.includes(feed.id));
  }

  /** An action finished: its words and Undo show, Choose ends, and the keyboard goes to Undo. */
  async function done(words: string, reverse: () => Promise<void>) {
    [message, undo, refusal] = [words, reverse, false];
    editing = false;
    chosen = [];
    onFeedsChanged();
    notWorking?.reload();
    await load();
    await tick();
    undoButton?.focus();
  }

  async function leave() {
    const going = picked();
    if (going.length === 0 || busy) return;
    busy = true;
    const why = await unsubscribeAll(placeIds(going));
    busy = false;
    if (why) {
      [message, undo, refusal] = [refused(why, "feed"), undefined, true];
      return;
    }
    await done(unsubscribedMessage(going.map((feed) => feed.title)), async () => {
      const refusal = await resubscribeAll(placeIds(going));
      if (refusal) throw refusal;
    });
  }

  /** Bring back, under Recently unsubscribed: they're followed again, with Undo until the next action. */
  async function bringBack(row: Kept) {
    if (busy) return;
    busy = true;
    const index = kept.indexOf(row);
    const name = shortName(row.title || "Untitled");
    const why = await bringBackAll(row.ids);
    busy = false;
    if (why) {
      const words =
        why === "too-late" ? `${name} can't be brought back: they're already gone.` : why === "too-many" ? explain("too-many") : refused(why, "feed");
      [message, undo, refusal] = [words, undefined, true];
      await load();
      // The row may have gone: the keyboard's place moves to the one now there, or the line.
      await tick();
      const left = [...document.querySelectorAll<HTMLButtonElement>("[data-kept]")];
      (left[Math.min(index, left.length - 1)] ?? editButton)?.focus();
      return;
    }
    await done(`${name} is back.`, async () => {
      const refusal = await unsubscribeAll(row.ids);
      if (refusal) throw refusal;
    });
  }

  function openMove() {
    if (picked().length === 0) return;
    moving = true;
  }

  async function closeMove() {
    moving = false;
    await tick();
    document.querySelector<HTMLElement>("[data-focus='move']")?.focus();
  }

  /** Move to…'s sheet moves them: to a folder, no folder, or a new one. Answers a problem to say, if any. */
  async function move(folder: Folder | null, naming: string): Promise<string | undefined> {
    const going = picked();
    const before = going.flatMap((feed) => feed.places.map((place) => ({ id: place.id, folders: [...place.folders] })));
    busy = true;
    const answer = await moveAll(placeIds(going), folder?.id ?? null, naming);
    busy = false;
    if (typeof answer === "string") return refused(answer, "folder");
    moving = false;
    await done(movedMessage(going.map((feed) => feed.title), answer.folder === null ? null : naming || (folder?.name ?? null)), async () => {
      const refusal = await restoreFolders(before);
      if (refusal) throw refusal;
      if (answer.created && answer.folder !== null) await deleteFolder(answer.folder);
    });
    return undefined;
  }

  async function takeBack() {
    if (!undo || busy) return;
    busy = true;
    try {
      await undo();
      [message, undo] = [UNDONE, undefined];
    } catch (why) {
      [message, undo, refusal] = [undoRefused(why === "too-late" ? "too-late" : "trouble", "feed"), undefined, true];
    }
    busy = false;
    onFeedsChanged();
    notWorking?.reload();
    await load();
    await tick();
    editButton?.focus();
  }

</script>

<section aria-labelledby="your-feeds-heading" class="flex flex-1 flex-col bg-paper">
  <PageHead title="Everyone you follow" id="your-feeds-heading" bind:heading onBack={onClose} backTo="Settings" {besideToggle} column="max-w-[35rem]" />
  <div use:edge class="scroller relative flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-5 md:px-10">
    <div class="mx-auto flex w-full max-w-[35rem] flex-1 flex-col gap-5">
      <NotWorking bind:this={notWorking} onFeedsChanged={healthChanged} {library} />
      {#if failed}
        <LoadFailed words="Everyone you follow couldn't be loaded." heading="your-feeds-heading" onRetry={() => ((failed = false), load())} />
      {:else if feeds}
        <!-- What the last action did, with its Undo, until the next one. -->
        <NoteLine announce {message} {refusal} {busy} bind:undoButton onUndo={undo ? takeBack : undefined} onClose={closeNote} />

        {#if listed.length === 0}
          <p class="text-ink-2">You don't follow anyone yet.</p>
        {/if}
        {#each groups as group, index (group.id)}
          <section aria-labelledby={`following-${group.id}`}>
            <div class="mb-2 flex min-h-11 items-center justify-between gap-3">
              <h3 id={`following-${group.id}`} class="inset-head mb-0">{group.name}</h3>
              {#if index === 0}
                <div class="flex items-center gap-2">
                  {#if editing}
                    <button type="button" class="btn btn-small" onclick={chooseAll}>{allChosen ? "Choose none" : "Choose all"}</button>
                  {/if}
                  <button type="button" bind:this={editButton} class="btn btn-small" onclick={toggleEditing}>{editing ? "Done" : "Choose…"}</button>
                </div>
              {/if}
            </div>
            <ul class="inset-group">
              {#each group.rows as feed (feed.id)}
                {@const line = rowLine(feed, folderNames(feed, folders))}
                <li class="contents">
                  {#if editing}
                    <label class="inset-row check-row tended">
                      <input type="checkbox" value={feed.id} bind:group={chosen} />
                      <span class="flex min-w-0 flex-1 flex-col py-2">
                        <span class="break-words">{feed.title}</span>
                        <span class="text-meta text-muted break-words"><Dated text={line} /></span>
                      </span>
                      <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size="tick" /></span>
                    </label>
                  {:else}
                    <a href={pathFor({ kind: "about", id: feed.id })} onclick={(event) => onOpenPerson(event, feed.id)} class="inset-row inset-action tended">
                      <span class="flex min-w-0 flex-1 flex-col py-2">
                        <span class="break-words">{feed.title}</span>
                        <span class="text-meta text-muted break-words"><Dated text={line} /></span>
                      </span>
                      <span class="row-glyph"><Icon name="chevron-right" /></span>
                    </a>
                  {/if}
                </li>
              {/each}
            </ul>
          </section>
        {/each}
        <RecentlyUnsubscribed {kept} {busy} onBringBack={bringBack} />
      {/if}

      <!-- With Choose on: what's chosen, and what can be done with it, in one bar that stays at the foot. -->
      {#if editing}
        <div class="tidy-bar">
          <!-- Unsubscribe at the far left, apart from Move to… at the right, so a slip can't land on it (decision 0217). -->
          <button
            type="button"
            class="btn-danger text-meta"
            title="Stops following them and removes their articles; starred ones stay. You can undo it straight afterwards."
            aria-describedby="your-feeds-unsubscribe-help"
            aria-disabled={chosen.length === 0 || busy}
            onclick={leave}>Unsubscribe</button
          >
          <p class="text-meta text-ink-2" aria-live="polite">{chosen.length === 0 ? "Choose who" : `${chosen.length} chosen`}</p>
          <button type="button" class="btn-primary" data-focus="move" aria-disabled={chosen.length === 0 || busy} onclick={openMove}>Move to…</button>
          <span id="your-feeds-unsubscribe-help" class="sr-only">Removes their articles; starred ones stay. You can undo it straight afterwards.</span>
        </div>
      {:else}
        <div class="pb-16"></div>
      {/if}
    </div>
  </div>
</section>

{#if moving}
  <MoveSheet {folders} help="Each one leaves the folders they were in." onMove={move} onClose={closeMove} />
{/if}

<style>
  /* A row is two lines: their name, then their newest title, when it came, and their folders. */
  .tended {
    min-height: 3.5rem;
  }
  /*
    Choose's bar stays at the foot of the page while the list scrolls under it,
    solid in the page's color with a hairline above, so a row cut there reads
    as scrolling (DESIGN.md → Visual language → Rules).
  */
  .tidy-bar {
    position: sticky;
    bottom: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin-top: auto;
    padding-block: 0.75rem calc(0.75rem + env(safe-area-inset-bottom));
    border-top: 1px solid var(--line);
    background-color: var(--paper);
  }
  /* Unsubscribe alone at the left; the count sits beside Move to… at the right. */
  .tidy-bar > .btn-danger {
    margin-right: auto;
  }
</style>
