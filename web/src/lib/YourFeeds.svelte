<!--
  Everyone you follow (SPEC section 15, decision 0186), opened from
  Settings. Who isn't working comes first (NotWorking.svelte). Then
  everyone, A to Z, People and Publications apart as in the sidebar, each
  row saying the title of their newest piece and when it came, or "Quiet
  since …" after six months, and their folders. A row opens their page.
  Choose…, as Edit in Apple Books, puts a tick box on each row; with some
  chosen, the bar at the foot moves them to one folder or unsubscribes from
  them all, in one go, with one Undo until your next action.
-->
<script lang="ts">
  import { onMount, tick } from "svelte";
  import { edge } from "./edge";
  import Icon from "./Icon.svelte";
  import NotWorking from "./NotWorking.svelte";
  import PageHead from "./PageHead.svelte";
  import Sheet from "./Sheet.svelte";
  import type { Folder } from "./shapes";
  import { deleteFolder, refused } from "./feeds";
  import { pathFor } from "./router";
  import {
    folderNames,
    listTended,
    moveAll,
    movedMessage,
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
  }: {
    heading?: HTMLHeadingElement;
    onClose: () => void;
    /** A row was chosen, out of Choose: their page opens. */
    onOpenPerson: (event: MouseEvent, id: number) => void;
    /** Feeds were moved, unsubscribed from or brought back: the sidebar reloads. */
    onFeedsChanged: () => void;
    besideToggle?: boolean;
  } = $props();

  let feeds: Tended[] | undefined = $state();
  let folders: Folder[] = $state([]);
  let failed = $state(false);
  let editing = $state(false);
  let chosen: number[] = $state([]);
  let busy = $state(false);
  /** What the last action said, and its Undo until the next action. */
  let message = $state("");
  let undo: (() => Promise<void>) | undefined = $state();
  let moving = $state(false);
  /** Where Move to… sends them: "none" (no folder), a folder's number, "new", or "" until one is chosen, so Move never strips folders by default. */
  let destination = $state("");
  let newFolder = $state("");
  /** Why the Move sheet couldn't move them, in its own words. */
  let moveProblem = $state("");
  let moveHeading: HTMLHeadingElement | undefined = $state();
  let editButton: HTMLButtonElement | undefined = $state();
  let undoButton: HTMLButtonElement | undefined = $state();

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
      ({ feeds, folders } = await listTended());
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
    [message, undo] = ["", undefined];
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
    message = words;
    undo = reverse;
    editing = false;
    chosen = [];
    onFeedsChanged();
    await load();
    await tick();
    undoButton?.focus();
  }

  async function leave() {
    const going = picked();
    if (going.length === 0 || busy) return;
    busy = true;
    const refusal = await unsubscribeAll(going.map((feed) => feed.id));
    busy = false;
    if (refusal) {
      [message, undo] = [refused(refusal, "feed"), undefined];
      return;
    }
    await done(unsubscribedMessage(going.map((feed) => feed.title)), async () => {
      const refusal = await resubscribeAll(going.map((feed) => feed.id));
      if (refusal) throw refusal;
    });
  }

  function openMove() {
    if (picked().length === 0) return;
    destination = "";
    newFolder = "";
    moveProblem = "";
    moving = true;
  }

  async function closeMove() {
    moving = false;
    await tick();
    document.querySelector<HTMLElement>("[data-focus='move']")?.focus();
  }

  async function move(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    if (!destination) {
      moveProblem = "Choose where they go first.";
      return;
    }
    const going = picked();
    const before = going.map((feed) => ({ id: feed.id, folders: [...feed.folders] }));
    const folder = destination === "none" || destination === "new" ? null : Number(destination);
    const naming = destination === "new" ? newFolder.trim() : "";
    if (destination === "new" && !naming) {
      moveProblem = "Give the new folder a name.";
      return;
    }
    busy = true;
    const answer = await moveAll(
      going.map((feed) => feed.id),
      folder,
      naming,
    );
    busy = false;
    if (typeof answer === "string") {
      moveProblem = refused(answer, "folder");
      return;
    }
    moving = false;
    const name = naming || (folders.find((each) => each.id === answer.folder)?.name ?? null);
    await done(movedMessage(going.map((feed) => feed.title), answer.folder === null ? null : name), async () => {
      const refusal = await restoreFolders(before);
      if (refusal) throw refusal;
      if (answer.created && answer.folder !== null) await deleteFolder(answer.folder);
    });
  }

  async function takeBack() {
    if (!undo || busy) return;
    busy = true;
    try {
      await undo();
      [message, undo] = ["", undefined];
    } catch (refusal) {
      [message, undo] = [refused(refusal === "too-late" ? "too-late" : "trouble", "feed"), undefined];
    }
    busy = false;
    onFeedsChanged();
    await load();
    await tick();
    editButton?.focus();
  }

  /** Escape inside the Move sheet closes only the sheet. */
  function keepEscape(event: KeyboardEvent) {
    event.stopPropagation();
  }
</script>

<section aria-labelledby="your-feeds-heading" class="flex flex-1 flex-col bg-paper">
  <PageHead title="Everyone you follow" id="your-feeds-heading" bind:heading {onClose} closeLabel="Close everyone you follow" {besideToggle} column="max-w-[35rem]" />
  <div use:edge class="scroller relative flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-5 md:px-10">
    <div class="mx-auto flex w-full max-w-[35rem] flex-1 flex-col gap-5">
      <NotWorking onFeedsChanged={healthChanged} />
      {#if failed}
        <p role="status" class="text-ink-2">Everyone you follow couldn't be loaded. Try again in a moment.</p>
      {:else if feeds}
        <!-- What the last action did, with its Undo, until the next one. -->
        <div class={["flex flex-wrap items-center gap-x-3 gap-y-1", !message && "sr-only"]}>
          <p role="status" class="text-ink">{message}</p>
          {#if undo}
            <button type="button" bind:this={undoButton} class="btn btn-small" aria-disabled={busy} onclick={takeBack}>Undo</button>
          {/if}
        </div>

        {#if listed.length === 0}
          <p class="text-ink-2">You don't follow anyone yet.</p>
        {/if}
        {#each groups as group, index (group.id)}
          <section aria-labelledby={`following-${group.id}`}>
            <div class="mb-1.5 flex min-h-11 items-center justify-between gap-3">
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
                      <span class="flex min-w-0 flex-1 flex-col py-1.5">
                        <span class="break-words">{feed.title}</span>
                        <span class="text-meta text-muted break-words">{line}</span>
                      </span>
                      <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size={14} /></span>
                    </label>
                  {:else}
                    <a href={pathFor({ kind: "about", id: feed.id })} onclick={(event) => onOpenPerson(event, feed.id)} class="inset-row inset-action tended">
                      <span class="flex min-w-0 flex-1 flex-col py-1.5">
                        <span class="break-words">{feed.title}</span>
                        <span class="text-meta text-muted break-words">{line}</span>
                      </span>
                      <span class="row-glyph"><Icon name="chevron-right" size={18} /></span>
                    </a>
                  {/if}
                </li>
              {/each}
            </ul>
            {#if index === groups.length - 1}
              <p class="inset-foot">
                Each one opens their page, to write back, keep a note about them, or edit how you follow them. Choose lets you move
                several to a folder, or unsubscribe from them, in one go.
              </p>
            {/if}
          </section>
        {/each}
      {/if}

      <!-- With Choose on: what's chosen, and what can be done with it, in one bar that stays at the foot. -->
      {#if editing}
        <div class="tidy-bar">
          <p class="text-small text-ink-2" aria-live="polite">{chosen.length === 0 ? "Choose who" : `${chosen.length} chosen`}</p>
          <button
            type="button"
            class="btn-danger text-small"
            title="Stops following them and removes their articles; starred ones stay. You can undo it straight afterwards."
            aria-describedby="your-feeds-unsubscribe-help"
            aria-disabled={chosen.length === 0 || busy}
            onclick={leave}>Unsubscribe</button
          >
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
  <div role="presentation" onkeydown={keepEscape}>
    <Sheet title="Move to a folder" bind:heading={moveHeading} onClose={closeMove}>
      <form onsubmit={move} class="flex flex-col gap-5">
        <fieldset class="flex min-w-0 flex-col gap-1.5">
          <legend class="mb-1.5 text-small text-ink-2">To</legend>
          <!-- A choice of one: a round mark at each row's end, as a Mac draws a radio button. -->
          <div class="inset-group">
            <label class="inset-row check-row">
              <input type="radio" name="destination" value="none" bind:group={destination} />
              <span class="min-w-0 break-words">No folder</span>
              <span aria-hidden="true" class="radio-mark shrink-0"></span>
            </label>
            {#each folders as folder (folder.id)}
              <label class="inset-row check-row">
                <input type="radio" name="destination" value={String(folder.id)} bind:group={destination} />
                <span class="min-w-0 break-words">{folder.name}</span>
                <span aria-hidden="true" class="radio-mark shrink-0"></span>
              </label>
            {/each}
            <label class="inset-row check-row">
              <input type="radio" name="destination" value="new" bind:group={destination} />
              <span class="min-w-0 break-words">New folder</span>
              <span aria-hidden="true" class="radio-mark shrink-0"></span>
            </label>
            {#if destination === "new"}
              <label class="inset-row">
                <span class="sr-only">New folder's name</span>
                <!-- svelte-ignore a11y_autofocus -->
                <input bind:value={newFolder} type="text" autocomplete="off" placeholder="Name" class="inset-input" autofocus />
              </label>
            {/if}
          </div>
          <span class="field-help mt-0">Each one leaves the folders they were in.</span>
        </fieldset>
        <!-- A problem, in red words with an icon, only once there is one: the sheet grows by its line. -->
        <p role="status" class={["flex items-start gap-1.5 text-small text-danger", !moveProblem && "sr-only"]}>
          {#if moveProblem}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{moveProblem}{/if}
        </p>
        <div class="sheet-actions">
          <button type="button" onclick={closeMove} class="btn">Cancel</button>
          <button type="submit" aria-disabled={busy} class="btn-primary">Move</button>
        </div>
      </form>
    </Sheet>
  </div>
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
    border-top: 1px solid color-mix(in srgb, var(--ink) 9%, transparent);
    background-color: var(--paper);
  }
  .tidy-bar > p {
    margin-right: auto;
  }
  .tidy-bar > .btn-danger {
    margin-left: 0;
  }
</style>
