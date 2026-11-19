<!--
  Everyone you follow (SPEC section 15, decision 0186), opened from its
  row in the sidebar, under All articles (decision 0266): a place of its
  own, so on a computer it has no way back to draw (its row shows where
  you are) and on a phone "‹ Home". Who isn't working comes first (NotWorking.svelte), then
  "One person?" for two follows that share a website (OnePerson.svelte, decision 0309), then who
  could be either, to settle with a tick (SettleList.svelte, decision 0264).
  Then everyone, A to Z, People and Publications apart as in the sidebar, each
  row saying the title of their newest piece and when it came, or "Quiet
  since …" after six months, and their folders. A row opens their page.
  Choose…, as Edit in Apple Books, puts a tick box on each row; with some
  chosen, the bar at the foot moves them to one folder or unsubscribes from
  them all, in one go, with one Undo until your next action. Last,
  Recently unsubscribed: who was left in the last 30 days, each with Bring
  back (RecentlyUnsubscribed.svelte, decision 0240).
-->
<script lang="ts">
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
  import { deleteFolder, explain, firstShowing, refused, undoRefused, type Notice } from "./feeds";
  import { UNDONE } from "./messages";
  import NoteLine from "./NoteLine.svelte";
  import SettleList from "./SettleList.svelte";
  import OnePerson from "./OnePerson.svelte";
  import { listAlike, type Alike } from "./onePerson";
  import { putBack, type Before } from "./people";
  import { settle, type Why } from "./sorting";
  import LoadFailed from "./LoadFailed.svelte";
  import { away, connection, whenBack } from "./connection.svelte";
  import { addressFor } from "./router";
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
    settledMessage,
    unsubscribeAll,
    unsubscribedMessage,
    type Tended,
  } from "./tidy";

  let {
    heading = $bindable(),
    onBack,
    onOpenPerson,
    onFeedsChanged,
    notice,
    returnTo,
  }: {
    heading?: HTMLHeadingElement;
    /** On a phone: back to Home. A computer shows the sidebar, where its row says where you are. */
    onBack?: () => void;
    /** A row was chosen, out of Choose (or one at the top, that isn't working): their page opens. */
    onOpenPerson: (event: MouseEvent, id: number) => void;
    /** Feeds were moved, unsubscribed from or brought back: the sidebar reloads. */
    onFeedsChanged: () => void;
    /** Just done on someone's page opened from here (Unsubscribe, decision 0284): its words show on the line, with Undo. */
    notice?: Notice;
    /** Back from the page of this row's person (decision 0284): the keyboard goes back to their row. */
    returnTo?: number;
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
  /** Undo; a sentence back says why it couldn't be done. */
  let undo: (() => Promise<string | void>) | undefined = $state();
  /** The message says something failed: oxblood, with the alert icon. */
  let refusal = $state(false);
  let moving = $state(false);
  let editButton: HTMLButtonElement | undefined = $state();
  let undoButton: HTMLButtonElement | undefined = $state();
  let notWorking: NotWorking | undefined = $state();
  /** Follows that share one website, still to ask about: one at a time, at the top (decision 0309). */
  let alike: Alike[] = $state([]);

  let listed = $derived(feeds ?? []);
  /** Ticked as a person in the list to settle: they stay in it, ticked, until the page is left. */
  let settledHere: number[] = $state([]);
  /** Why each one ticked here was open, so unticking opens it again even after the rows reload. */
  const openBecause = new Map<number, Why>();
  /** Who could be either, and who was ticked here; hidden while Choose is on (one kind of tick at a time). */
  let settling = $derived(editing ? [] : listed.filter((feed) => feed.open || settledHere.includes(feed.id)));
  /** Who's in each group: who could be either only in the list to settle, except while choosing. */
  let grouped = $derived(editing ? listed : listed.filter((feed) => !feed.open));
  /** People, then Publications, as the sidebar lists them, each saying how it sorts; a group with nobody in it isn't shown. */
  let groups = $derived(
    [
      { id: "people", one: "person", many: "people", kind: "person", how: "Filed here when one name signs everything they write, or the site is their own." },
      { id: "publications", one: "publication", many: "publications", kind: "publication", how: "Filed here when several names sign it, or it writes under its site's own name." },
    ]
      .map((group) => ({ ...group, rows: grouped.filter((feed) => feed.kind === group.kind) }))
      .map((group) => ({ ...group, name: count(group.rows.length, group.one, group.many) }))
      .filter((group) => group.rows.length > 0),
  );
  let allChosen = $derived(listed.length > 0 && listed.every((feed) => chosen.includes(feed.id)));

  function count(how: number, one: string, many: string): string {
    return `${how} ${how === 1 ? one : many}`;
  }

  // Couldn't load for want of a connection: loaded again by itself once it's back (decision 0312).
  $effect(() => whenBack(() => void (failed && load())));

  async function load() {
    try {
      [{ feeds, folders, kept }, alike] = await Promise.all([listTended(), listAlike()]);
      failed = false;
    } catch {
      failed = true;
    }
  }

  // Arriving with what was just done on their page: its words (once the line is there to say them) and the keyboard on Undo.
  // Back from their page: the keyboard on their row, the first that opens it (who isn't working comes first).
  onMount(async () => {
    await Promise.all([load(), notWorking?.listed()]);
    await tick();
    if (notice && firstShowing(notice)) {
      [message, undo] = [notice.message, notice.undo];
      await tick();
      undoButton?.focus();
    } else if (returnTo !== undefined) {
      const row = document.querySelector<HTMLElement>(`[aria-labelledby="your-feeds-heading"] a[href="${addressFor({ kind: "about", id: returnTo })}"]`);
      (row ?? heading)?.focus();
    }
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

  /** A tick in the list to settle counts at once: a person; unticked, open again as it was. */
  async function tick1(row: Tended, person: boolean): Promise<boolean> {
    if (busy) return false;
    endUndo();
    busy = true;
    if (row.open && row.why) openBecause.set(row.id, row.why);
    const was = openBecause.get(row.id) ?? "unsure-no-names";
    const why = await settle([person ? { feed: row.id, kind: "person" } : { feed: row.id, kind: "publication", why: was }]);
    busy = false;
    if (why) {
      [message, undo, refusal] = [refused(why, "feed"), undefined, true];
      return false;
    }
    [row.kind, row.open] = person ? ["person", false] : ["publication", true];
    if (!settledHere.includes(row.id)) settledHere = [...settledHere, row.id];
    onFeedsChanged();
    return true;
  }

  /** "The rest are publications": every one still open is settled, with Undo opening them again. */
  async function settleRest() {
    const rest = listed.filter((feed) => feed.open);
    if (rest.length === 0 || busy) return;
    busy = true;
    const why = await settle(rest.map((feed) => ({ feed: feed.id, kind: "publication" })));
    busy = false;
    if (why) {
      [message, undo, refusal] = [refused(why, "feed"), undefined, true];
      return;
    }
    settledHere = [];
    await done(settledMessage(rest.map((feed) => feed.title)), async () => {
      const refusal = await settle(rest.map((feed) => ({ feed: feed.id, kind: "publication", why: feed.why ?? undefined })));
      if (refusal) throw refusal;
    });
  }

  /** "One person?" answered Join them: one person now, under the first one's name, with Undo. */
  async function joined(pair: Alike, before: Before[]) {
    await done(`${pair.names[0]} is one person now.`, async () => {
      if (await putBack(before)) throw "trouble";
    });
  }

  /** Keep apart: never asked about again; the next pair, if any, is asked, and the keyboard goes to the title. */
  async function keptApart(pair: Alike) {
    alike = alike.filter((each) => each !== pair);
    await tick();
    heading?.focus();
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
      const problem = await undo();
      [message, undo, refusal] = problem ? [problem, undefined, true] : [UNDONE, undefined, false];
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

<section aria-labelledby="your-feeds-heading" class="lines-up flex flex-1 flex-col bg-paper">
  <PageHead title="Everyone you follow" id="your-feeds-heading" bind:heading {onBack} backTo="Home" column="max-w-[35rem]" />
  <div use:edge class="scroller relative flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-5 md:px-10">
    <div class="mx-auto flex w-full max-w-[35rem] flex-1 flex-col gap-5">
      <!-- What the last action did, with its Undo, until the next one: first, above who isn't working, so it's seen. -->
      <NoteLine announce {message} {refusal} {busy} bind:undoButton onUndo={undo ? takeBack : undefined} onClose={closeNote} />
      <NotWorking bind:this={notWorking} onOpen={onOpenPerson} />
      {#if failed && connection.offline}
        <!-- Without nine turtles, calmly, as every other screen says it (decision 0312): no error, and no Try again that can't work. -->
        <p role="status" class="text-ink-2">{away().why} Everyone you follow shows {away().back}.</p>
      {:else if failed}
        <LoadFailed words="Everyone you follow couldn't be loaded." heading="your-feeds-heading" onRetry={() => ((failed = false), load())} />
      {:else if feeds}
        {#if listed.length === 0}
          <p class="text-ink-2">You don't follow anyone yet.</p>
        {/if}
        {#if alike[0] && !editing}
          {@const pair = alike[0]}
          {#key pair}<OnePerson {pair} onJoined={(before) => void joined(pair, before)} onKeptApart={() => void keptApart(pair)} />{/key}
        {/if}
        {#if settling.length > 0}
          <SettleList rows={settling} {busy} onTick={tick1} onRest={settleRest} />
        {/if}
        {#each groups as group, index (group.id)}
          <section aria-labelledby={`following-${group.id}`} aria-describedby={`following-${group.id}-how`}>
            <div class="flex min-h-11 items-center justify-between gap-3">
              <h3 id={`following-${group.id}`} class="label inset-head mb-0">{group.name}</h3>
              {#if index === 0}
                <div class="flex items-center gap-2">
                  {#if editing}
                    <button type="button" class="btn btn-small" onclick={chooseAll}>{allChosen ? "Choose none" : "Choose all"}</button>
                  {/if}
                  <button type="button" bind:this={editButton} class="btn btn-small" onclick={toggleEditing}>{editing ? "Done" : "Choose…"}</button>
                </div>
              {/if}
            </div>
            <p id={`following-${group.id}-how`} class="inset-foot mt-0 mb-2">{group.how}</p>
            <ul class="inset-group">
              {#each group.rows as feed (feed.id)}
                {@const line = rowLine(feed, folderNames(feed, folders))}
                <li class="contents">
                  {#if editing}
                    <label class="inset-row check-row tended">
                      <input type="checkbox" value={feed.id} bind:group={chosen} />
                      <span class="flex min-w-0 flex-1 flex-col py-2">
                        <span class="wrap-anywhere">{feed.title}</span>
                        <span class="text-meta text-muted wrap-anywhere">{line}</span>
                      </span>
                      <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size="tick" /></span>
                    </label>
                  {:else}
                    <a href={addressFor({ kind: "about", id: feed.id })} onclick={(event) => onOpenPerson(event, feed.id)} class="inset-row inset-action tended">
                      <span class="flex min-w-0 flex-1 flex-col py-2">
                        <span class="wrap-anywhere">{feed.title}</span>
                        <span class="text-meta text-muted wrap-anywhere">{line}</span>
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
            class={["btn-danger text-meta", chosen.length === 0 && "unavailable"]}
            title="Stops following them and removes their articles; saved, highlighted and noted ones can stay. You can undo it."
            aria-describedby="your-feeds-unsubscribe-help"
            aria-disabled={chosen.length === 0 || busy}
            onclick={leave}>Unsubscribe</button
          >
          <p class="text-meta text-ink-2" aria-live="polite">{chosen.length === 0 ? "Choose who" : `${chosen.length} chosen`}</p>
          <button type="button" class={["btn-primary", chosen.length === 0 && "unavailable"]} data-focus="move" aria-disabled={chosen.length === 0 || busy} onclick={openMove}>Move to…</button>
          <span id="your-feeds-unsubscribe-help" class="sr-only">Removes their articles; saved, highlighted and noted ones can stay. You can undo it.</span>
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
