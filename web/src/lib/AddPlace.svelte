<!--
  "+ Add a source" (SPEC section 36, decision 0163): one more source for this
  person, by choosing someone the reader already follows, or by pasting the
  address of their blog, channel or newsletter (followed then and there, as
  Add would). An address offering several shows them first, to choose one.
  When the two are in different folders it asks which folders they should
  be in, every one ticked to start with. Either way the sources become one
  person, with Undo on the line that follows. It opens in place, under its
  button, and never inside a form of its own, so it can sit in Edit's. For
  someone with one source it opens from a quiet line near Edit's foot
  instead (`invite`): one link that says what it adds, "+ Add their
  newsletter, videos or podcast" (decision 0241).
-->
<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import { addFeed, explain, plainSourceName, undoRefused, unsubscribe, type Choice, type Notice } from "./feeds";
  import type { LoadedLibrary } from "./library.svelte";
  import { join, joinedNotice, placesOf } from "./people";
  import type { Feed } from "./shapes";

  let {
    feed,
    name,
    library,
    invite = false,
    onJoined,
  }: {
    feed: Feed;
    name: string;
    library: LoadedLibrary;
    /** Someone with one source: a line saying why, and a link rather than a button. */
    invite?: boolean;
    /** Joined: the line with Undo, and the place the person's row now opens. */
    onJoined: (done: Notice, lead: number) => void;
  } = $props();

  let open = $state(false);
  let chosen = $state("");
  let address = $state("");
  let busy = $state(false);
  let message = $state("");
  let group: HTMLDivElement | undefined = $state();
  let opener: HTMLButtonElement | undefined = $state();
  /** The feeds an address offered, to choose one before following it. */
  let choices: Choice[] = $state([]);
  let picked = $state("");
  /** Someone in other folders than theirs: which folders the two should be in, all ticked to start. */
  let asking: { other: number; followed: boolean; folders: number[] } | undefined = $state();
  let keep: number[] = $state([]);

  /** Everyone else the reader follows, A to Z, as the sidebar lists them. */
  let others = $derived((library.rows ?? []).filter((row) => row.id !== feed.id && !(row.places ?? []).includes(feed.id)));

  /** The folders every source of `id`'s person is in. */
  function foldersOf(id: number): number[] {
    const place = library.feeds?.find((each) => each.id === id);
    return place ? [...new Set(placesOf(place, library.feeds ?? []).flatMap((each) => each.folders))].sort((a, b) => a - b) : [];
  }

  /** Joins `other` to this person, first asking about folders when both are in folders and they differ. */
  async function joinWith(other: number, followed = false) {
    const mine = foldersOf(feed.id);
    const theirs = foldersOf(other);
    if (mine.length > 0 && theirs.length > 0 && mine.join() !== theirs.join()) {
      asking = { other, followed, folders: [...new Set([...mine, ...theirs])] };
      keep = [...asking.folders];
      await tick();
      group?.querySelector<HTMLElement>("input")?.focus();
      return;
    }
    await joinNow(other, followed);
  }

  /** Joins `other` to this person, into `folders` when the reader chose them; `followed` when it was followed just now, so Undo unfollows it too. */
  async function joinNow(other: number, followed: boolean, folders?: number[]) {
    const { refusal, before } = await join([feed.id, other], undefined, folders);
    if (refusal) {
      message = refusal;
      return;
    }
    await library.loadFeeds();
    open = false;
    const done = joinedNotice(name, before, () => library.loadFeeds());
    const undo = done.undo!;
    onJoined(
      followed
        ? {
            ...done,
            undo: async () => {
              const problem = await undo();
              if (problem) return problem;
              const refusal = await unsubscribe(other);
              await library.loadFeeds();
              return refusal ? undoRefused(refusal, "feed") : undefined;
            },
          }
        : done,
      library.rowOf(feed.id),
    );
  }

  async function show() {
    open = true;
    await tick();
    // The first field there is: the list of people, or the address when the reader follows no one else.
    group?.querySelector<HTMLElement>("select, input")?.focus();
  }

  async function hide() {
    open = false;
    choices = [];
    asking = undefined;
    await tick();
    opener?.focus();
  }

  async function addChosen() {
    if (busy) return;
    message = "";
    if (!chosen) {
      message = "Choose who it is first.";
      return;
    }
    busy = true;
    await joinWith(Number(chosen));
    busy = false;
  }

  async function addAddress() {
    if (busy) return;
    message = "";
    if (!address.trim()) {
      message = "Paste the address of their blog, channel or newsletter first.";
      return;
    }
    busy = true;
    const added = await addFeed(choices.length > 0 ? picked : address);
    if (added.kind === "choose" && added.choices.length > 0) {
      // A site that offers several: they show first, the first chosen, as in Add.
      choices = added.choices;
      picked = added.choices[0]!.url;
      busy = false;
      await tick();
      group?.querySelector<HTMLInputElement>('input[name="add-place-choice"]:checked')?.focus();
      return;
    }
    choices = [];
    if (added.kind === "added") await joinWith(added.feed.id, true);
    else if (added.kind === "already") await joinWith(added.feedId);
    else if (added.kind === "problem") message = explain(added.reason);
    else message = "nine turtles couldn't tell which to follow there. Try the address of the blog or channel itself.";
    busy = false;
  }

  async function joinChosenFolders() {
    if (busy || !asking) return;
    busy = true;
    message = "";
    await joinNow(asking.other, asking.followed, keep);
    asking = undefined;
    busy = false;
  }
</script>

{#if !open && invite}
  <button type="button" class="text-link self-start" bind:this={opener} onclick={show}>+ Add their newsletter, videos or podcast</button>
{:else if !open}
  <button
    type="button"
    class="btn self-start"
    bind:this={opener}
    onclick={show}><Icon name="plus" />Add a source</button
  >
{:else}
  <div bind:this={group} class="add-place flex flex-col gap-4" role="group" aria-labelledby="add-place-title">
    <p id="add-place-title" class="text-base font-semibold text-ink">{asking ? `Which folders should ${name} be in?` : `Add a source for ${name}`}</p>
    {#if asking}
      <!-- Every folder either was in, ticked to start: untick any they shouldn't be in. -->
      <div class="inset-group">
        {#each asking.folders as id (id)}
          <label class="inset-row check-row">
            <input type="checkbox" value={id} bind:group={keep} />
            <span class="min-w-0 break-words">{library.folders.find((folder) => folder.id === id)?.name ?? "A folder"}</span>
            <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size="tick" /></span>
          </label>
        {/each}
      </div>
      <button type="button" class="btn self-start" aria-disabled={busy} onclick={joinChosenFolders}>Join</button>
    {:else if choices.length > 0}
      <!-- The feeds the address offered: a choice of one, the first chosen, as Add shows them. -->
      <div role="radiogroup" aria-label="Which one to follow" class="inset-group">
        {#each choices as choice (choice.url)}
          <label class="inset-row check-row flex-nowrap">
            <input type="radio" name="add-place-choice" value={choice.url} bind:group={picked} />
            <span class="flex min-w-0 flex-col py-1">
              <span class="break-words">{choice.title}</span>
              <span class="truncate text-meta text-muted" title={choice.url}>{choice.url}</span>
            </span>
            <span aria-hidden="true" class="radio-mark shrink-0"></span>
          </label>
        {/each}
      </div>
      <button type="button" class="btn self-start" aria-disabled={busy} onclick={addAddress}>Follow and join</button>
    {:else if others.length > 0}
      <div class="flex flex-col gap-1.5">
        <label for="add-place-who" class="text-meta text-ink-2">Someone you already follow</label>
        <div class="flex flex-wrap gap-2">
          <select id="add-place-who" bind:value={chosen} class="field min-w-0 flex-1">
            <option value="">Choose…</option>
            {#each others as other (other.id)}
              <option value={String(other.id)}>{plainSourceName(other.title)}</option>
            {/each}
          </select>
          <button type="button" class="btn" aria-disabled={busy} onclick={addChosen}>Join</button>
        </div>
      </div>
    {/if}
    {#if !asking && choices.length === 0}
    <div class="flex flex-col gap-1.5">
      <label for="add-place-address" class="text-meta text-ink-2">{others.length > 0 ? "Or the address of their blog, channel or newsletter" : "The address of their blog, channel or newsletter"}</label>
      <div class="flex flex-wrap gap-2">
        <input
          id="add-place-address"
          bind:value={address}
          type="url"
          inputmode="url"
          autocomplete="off"
          placeholder="youtube.com/@name"
          class="field min-w-0 flex-1"
          onkeydown={(event) => {
            if (event.key !== "Enter") return;
            // Never the form around it (Edit's Done): this adds the source.
            event.preventDefault();
            void addAddress();
          }}
        />
        <button type="button" class="btn" aria-disabled={busy} onclick={addAddress}>Follow and join</button>
      </div>
    </div>
    {/if}
    <p role="status" class={["flex items-start gap-1.5 text-meta", message ? "text-danger" : busy ? "text-muted" : "sr-only"]}>
      {#if message}<span class="mt-px shrink-0"><Icon name="alert" /></span>{message}{:else if busy}Working…{/if}
    </p>
    <button type="button" class="btn-quiet self-start" onclick={hide}>Not now</button>
  </div>
{/if}

<style>
  .add-place {
    padding: 1rem 1.125rem;
    border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
    border-radius: var(--radius-hold);
  }
</style>
