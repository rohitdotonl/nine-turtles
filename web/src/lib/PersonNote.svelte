<!--
  The reader's private note on a person (SPEC section 42), on their page:
  "Your note" and what it says, with Edit note; or, with none yet, Add a
  note…. It's written in a box in place (NoteBox), with Save and Not now. Only the
  reader sees it; search's sidebar filter finds the person by it, and Your
  data exports it. It's the same on each of the person's places. Words not
  saved yet are kept on this device, and the box opens with them when the
  reader comes back (decision 0235).
-->
<script lang="ts">
  import { tick } from "svelte";
  import NoteBox from "./NoteBox.svelte";
  import NoteText from "./NoteText.svelte";
  import { keepDraft, keptWords, worthKeeping } from "./drafts";
  import { sendChange } from "./http";
  import type { LoadedLibrary } from "./library.svelte";
  import { NOTE_NOT_SAVED } from "./notes.svelte";

  let { place, note, name, library }: { place: number; note: string | null; name: string; library: LoadedLibrary } = $props();

  let writing = $state(false);
  let draft = $state("");
  let kept: "left" | "here" | undefined = $state();
  /** "Note discarded · Undo", until the box opens again. */
  let discarded: string | undefined = $state();
  let box: NoteBox | undefined = $state();
  let opener: HTMLButtonElement | undefined = $state();
  let undoButton: HTMLButtonElement | undefined = $state();
  let draftName = $derived(`note:person:${place}`);

  // Each person's page starts with their kept note open, if words were left unsaved.
  $effect(() => {
    const words = keptWords(draftName);
    writing = words !== undefined;
    draft = words ?? "";
    kept = words === undefined ? undefined : "left";
    discarded = undefined;
  });

  // The note is kept as it's typed, while it differs from what's saved.
  $effect(() => {
    if (writing) keepDraft(draftName, worthKeeping(draft, note ?? "") ? draft : undefined);
  });

  async function write() {
    const words = keptWords(draftName);
    draft = words ?? note ?? "";
    kept = words === undefined ? undefined : "here";
    discarded = undefined;
    writing = true;
    await box?.focus();
  }

  async function done() {
    writing = false;
    await tick();
    opener?.focus();
  }

  async function save(words: string): Promise<string | undefined> {
    const { refusal } = await sendChange(`/api/feeds/${place}/note`, { note: words }, ["too-long"]);
    if (refusal) return refusal === "gone" ? "You don't follow them any more, so there's nowhere to keep it." : refusal === "too-long" ? "That note is too long. Make it shorter." : NOTE_NOT_SAVED;
    keepDraft(draftName, undefined);
    await library.loadFeeds();
    await done();
    return undefined;
  }

  async function discard() {
    discarded = draft;
    keepDraft(draftName, undefined);
    writing = false;
    await tick();
    undoButton?.focus();
  }

  async function undo() {
    const words = discarded;
    discarded = undefined;
    if (words === undefined) return;
    keepDraft(draftName, words);
    draft = words;
    kept = "here";
    writing = true;
    await box?.focus();
  }
</script>

<div class="flex flex-col gap-2" lang="en">
  {#if writing}
    <NoteBox bind:this={box} id="person-note" on="page" label="A note on {name}" help="Only you see it. It's kept for all their places, and Your data exports it." bind:words={draft} {kept} onSave={save} onNotNow={done} onDiscard={discard} />
  {:else}
    {#if note}
      <p class="label">Your note</p>
      <div class="text-base"><NoteText {note} /></div>
      <button type="button" class="btn-quiet -ml-3 self-start" bind:this={opener} onclick={write}>Edit note</button>
    {:else}
      <button type="button" class="btn-quiet -ml-3 self-start" bind:this={opener} onclick={write}>Add a note…</button>
    {/if}
    <!-- Discard's Undo, in place, until the box opens again. -->
    <div class="flex flex-wrap items-center gap-x-3 text-small">
      <p role="status" class={discarded === undefined ? "sr-only" : undefined}>{discarded === undefined ? "" : "Note discarded."}</p>
      {#if discarded !== undefined}<button type="button" class="btn-quiet -ml-3" bind:this={undoButton} onclick={undo}>Undo</button>{/if}
    </div>
  {/if}
</div>

<style>
  .label {
    color: var(--muted);
    font-size: var(--text-meta);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
</style>
