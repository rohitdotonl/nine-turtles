<!--
  Your feeds (SPEC section 15), opened from Settings › Feeds: every feed, A
  to Z, with when it last posted and its folders, for tidying many at once.
  "Show" narrows it to the quiet ones, those with nothing posted for 6 months
  or a year. Edit, as in Apple Books, puts a tick box on each row; with some
  chosen, the bar at the foot moves them to one folder or unsubscribes from
  them all, in one go, with one Undo until your next action. Out of Edit, a
  row opens that feed's list.
-->
<script lang="ts">
  import { onMount, tick } from "svelte";
  import { edge } from "./edge";
  import Icon from "./Icon.svelte";
  import PageHead from "./PageHead.svelte";
  import Sheet from "./Sheet.svelte";
  import type { Folder } from "./shapes";
  import { deleteFolder, refused } from "./feeds";
  import {
    folderNames,
    lastPostedWords,
    listTended,
    moveAll,
    movedMessage,
    resubscribeAll,
    restoreFolders,
    shown,
    unsubscribeAll,
    unsubscribedMessage,
    type Showing,
    type Tended,
  } from "./tidy";

  let {
    heading = $bindable(),
    onClose,
    onOpenFeed,
    onFeedsChanged,
    besideToggle = false,
  }: {
    heading?: HTMLHeadingElement;
    onClose: () => void;
    /** A feed's row was chosen, out of Edit: its list opens. */
    onOpenFeed: (event: MouseEvent, id: number) => void;
    /** Feeds were moved, unsubscribed from or brought back: the sidebar reloads. */
    onFeedsChanged: () => void;
    besideToggle?: boolean;
  } = $props();

  const SHOWING: { value: Showing; label: string }[] = [
    { value: "all", label: "All feeds" },
    { value: "6", label: "Quiet for 6 months" },
    { value: "12", label: "Quiet for a year" },
  ];

  let feeds: Tended[] | undefined = $state();
  let folders: Folder[] = $state([]);
  let failed = $state(false);
  let showing: Showing = $state("all");
  let editing = $state(false);
  let chosen: number[] = $state([]);
  let busy = $state(false);
  /** What the last action said, and its Undo until the next action. */
  let message = $state("");
  let undo: (() => Promise<void>) | undefined = $state();
  let moving = $state(false);
  /** In the Move sheet: "none" for no folder, "new" for a new one, or a folder's number. */
  let destination = $state("none");
  let newFolder = $state("");
  /** Why the Move sheet couldn't move them, in its own words. */
  let moveProblem = $state("");
  let moveHeading: HTMLHeadingElement | undefined = $state();
  let editButton: HTMLButtonElement | undefined = $state();
  let undoButton: HTMLButtonElement | undefined = $state();

  const now = Date.now() / 1000;
  let listed = $derived(shown(feeds ?? [], showing, now));
  let allChosen = $derived(listed.length > 0 && listed.every((feed) => chosen.includes(feed.id)));

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

  /** The chosen feeds that are still listed (a filter may have hidden some). */
  function picked(): Tended[] {
    return listed.filter((feed) => chosen.includes(feed.id));
  }

  /** An action finished: its words and Undo show, Edit ends, and the keyboard goes to Undo. */
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
    destination = "none";
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
  <PageHead title="Your feeds" id="your-feeds-heading" bind:heading {onClose} closeLabel="Close your feeds" {besideToggle} column="max-w-[35rem]" />
  <div use:edge class="scroller relative flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-5 md:px-10">
    <div class="mx-auto flex w-full max-w-[35rem] flex-1 flex-col gap-5">
      {#if failed}
        <p role="status" class="text-ink-2">Your feeds couldn't be loaded. Try again in a moment.</p>
      {:else if feeds}
        <fieldset class="flex flex-col gap-1.5">
          <legend class="mb-1.5 text-small text-ink-2">Show</legend>
          <div class="choices self-start" style="--phone-columns: 3">
            {#each SHOWING as choice (choice.value)}
              <label class="choice">
                <input type="radio" name="showing" value={choice.value} bind:group={showing} onchange={() => ((chosen = []), endUndo())} />
                {choice.label}
              </label>
            {/each}
          </div>
        </fieldset>

        <!-- What the last action did, with its Undo, until the next one. -->
        <div class={["flex flex-wrap items-center gap-x-3 gap-y-1", !message && "sr-only"]}>
          <p role="status" class="text-ink">{message}</p>
          {#if undo}
            <button type="button" bind:this={undoButton} class="btn btn-small" aria-disabled={busy} onclick={takeBack}>Undo</button>
          {/if}
        </div>

        <section aria-labelledby="your-feeds-list">
          <div class="mb-1.5 flex min-h-11 items-center justify-between gap-3">
            <h3 id="your-feeds-list" class="inset-head mb-0">
              {#if showing === "all"}{feeds.length === 1 ? "1 feed" : `${feeds.length} feeds`}{:else}{listed.length === 1
                  ? "1 quiet feed"
                  : `${listed.length} quiet feeds`}{/if}
            </h3>
            <div class="flex items-center gap-2">
              {#if editing && listed.length > 0}
                <button type="button" class="btn btn-small" onclick={chooseAll}>{allChosen ? "Choose none" : "Choose all"}</button>
              {/if}
              {#if listed.length > 0}
                <button type="button" bind:this={editButton} class="btn btn-small" onclick={toggleEditing}
                  >{editing ? "Done" : "Edit"}</button
                >
              {/if}
            </div>
          </div>
          {#if listed.length === 0}
            <p class="text-ink-2">
              {#if showing === "all"}You don't follow any feeds yet.{:else}Every feed has posted within {showing === "6" ? "the last 6 months" : "the last year"}.{/if}
            </p>
          {:else}
            <ul class="inset-group">
              {#each listed as feed (feed.id)}
                {@const names = folderNames(feed, folders)}
                <li class="contents">
                  {#if editing}
                    <label class="inset-row check-row tended">
                      <input type="checkbox" value={feed.id} bind:group={chosen} />
                      <span class="flex min-w-0 flex-col py-1.5">
                        <span class="break-words">{feed.title}</span>
                        <span class="text-meta text-muted">{lastPostedWords(feed)}{#if names.length > 0}{" · "}{names.join(", ")}{/if}</span>
                      </span>
                      <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size={14} /></span>
                    </label>
                  {:else}
                    <a href={`/feeds/${feed.id}`} onclick={(event) => onOpenFeed(event, feed.id)} class="inset-row inset-action tended">
                      <span class="flex min-w-0 flex-col py-1.5">
                        <span class="break-words">{feed.title}</span>
                        <span class="text-meta text-muted">{lastPostedWords(feed)}{#if names.length > 0}{" · "}{names.join(", ")}{/if}</span>
                      </span>
                      <span class="row-glyph"><Icon name="chevron-right" size={18} /></span>
                    </a>
                  {/if}
                </li>
              {/each}
            </ul>
            <p class="inset-foot">
              {#if showing === "all"}Edit lets you choose several feeds, then move them to a folder or unsubscribe from them in one go.{:else}Feeds
                with nothing new for a long time. Some blogs pause and come back; others have stopped for good.{/if}
            </p>
          {/if}
        </section>
      {/if}

      <!-- With Edit on: what's chosen, and what can be done with it, in one bar that stays at the foot. -->
      {#if editing}
        <div class="tidy-bar">
          <p class="text-small text-ink-2" aria-live="polite">{chosen.length === 0 ? "Choose feeds" : `${chosen.length} chosen`}</p>
          <button
            type="button"
            class="btn-danger text-small"
            title="Stops following these feeds and removes their articles; starred ones stay. You can undo it straight afterwards."
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
    <Sheet title={chosen.length === 1 ? "Move 1 feed" : `Move ${chosen.length} feeds`} bind:heading={moveHeading} onClose={closeMove}>
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
          <span class="field-help mt-0">Each feed leaves the folders it was in.</span>
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
  /* A feed's row is two lines: its name, then when it last posted and its folders. */
  .tended {
    min-height: 3.5rem;
  }
  /*
    Edit's bar stays at the foot of the page while the list scrolls under it,
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
