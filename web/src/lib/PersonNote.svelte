<!--
  The reader's private note on a person (SPEC section 42), on their page:
  "Your note" and what it says, with Edit note; or, with none yet, Add a
  note…. It's written in a box in place, with Save and Not now. Only the
  reader sees it; search's sidebar filter finds the person by it, and Your
  data exports it. It's the same on each of the person's places.
-->
<script lang="ts">
  import Waiting from "./Waiting.svelte";
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import NoteText from "./NoteText.svelte";
  import { sendChange } from "./http";
  import type { LoadedLibrary } from "./library.svelte";
  import { LONGEST_NOTE } from "./notes.svelte";

  let { place, note, name, library }: { place: number; note: string | null; name: string; library: LoadedLibrary } = $props();

  let writing = $state(false);
  let busy = $state(false);
  let draft = $state("");
  let message = $state("");
  let box: HTMLTextAreaElement | undefined = $state();
  let opener: HTMLButtonElement | undefined = $state();

  $effect(() => {
    void place;
    writing = false;
    message = "";
  });

  async function write() {
    draft = note ?? "";
    writing = true;
    await tick();
    box?.focus();
  }

  async function done() {
    writing = false;
    message = "";
    await tick();
    opener?.focus();
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    busy = true;
    const { refusal } = await sendChange(`/api/feeds/${place}/note`, { note: draft }, ["too-long"]);
    if (!refusal) await library.loadFeeds();
    busy = false;
    if (!refusal) return done();
    message =
      refusal === "gone" ? "You don't follow them any more, so there's nowhere to keep it." : refusal === "too-long" ? "That note is too long. Make it shorter." : "The note couldn't be saved. Try again in a moment.";
  }
</script>

<div class="flex flex-col gap-2" lang="en">
  {#if writing}
    <form class="note-form flex flex-col gap-3" onsubmit={save}>
      <label class="text-base font-semibold text-ink" for="person-note">A note on {name}</label>
      <textarea dir="auto" id="person-note" bind:this={box} bind:value={draft} maxlength={LONGEST_NOTE} rows="4" aria-describedby="person-note-message" class="field note-box"></textarea>
      <p class="text-small text-ink-2">Only you see it. It's kept for all their places, and Your data exports it.</p>
      <p id="person-note-message" role="status" class={["flex items-start gap-1.5 text-small text-danger", !message && "sr-only"]}>
        {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
      </p>
      <div class="flex flex-wrap gap-2">
        <button type="submit" class="btn-primary" aria-disabled={busy}><Waiting {busy} word="Save" doing="Saving…" /></button>
        <button type="button" class="btn-quiet" onclick={done}>Not now</button>
      </div>
    </form>
  {:else if note}
    <p class="label">Your note</p>
    <div class="text-base"><NoteText {note} /></div>
    <button type="button" class="btn-quiet -ml-3 self-start" bind:this={opener} onclick={write}>Edit note</button>
  {:else}
    <button type="button" class="btn-quiet -ml-3 self-start" bind:this={opener} onclick={write}>Add a note…</button>
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
  .note-form {
    padding: 1rem 1.125rem;
    border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
    border-radius: 0.75rem;
  }
  .note-box {
    min-height: 6rem;
    resize: vertical;
    line-height: 1.5;
  }
</style>
