<!--
  Unsubscribing from a place where the reader kept something (SPEC section
  42): it asks, in place of Unsubscribe in their settings, whether what they kept stays.
  "Keep them" leaves their saved and marked articles, and their note on
  the person, where they are (Saved, Notes, search). The safe answers sit
  together (Keep them, Cancel); under a hairline, apart, the oxblood button
  names exactly what it removes ("Remove the 2 saved articles too",
  decision 0239). Either can be undone straight afterwards, as any
  unsubscribe can. Asked only when there's something kept.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { keptWords, removeWords, type Kept } from "./keeping";

  let { name, kept, busy, onChoose, onCancel }: { name: string; kept: Kept; busy: boolean; onChoose: (removeKept: boolean) => void; onCancel: () => void } = $props();

  let first: HTMLButtonElement | undefined = $state();
  onMount(() => first?.focus());
</script>

<div role="group" aria-labelledby="keep-question" aria-describedby="keep-what" class="tone-box keep gap-3" lang="en">
  <p id="keep-question" class="text-base font-semibold text-ink">Keep what you saved from {name}?</p>
  <p id="keep-what" class="text-meta text-ink-2">{keptWords(kept)}</p>
  <!-- Cancel, then the main action at the right end, as in a sheet. -->
  <div class="sheet-actions">
    <button type="button" class="btn" onclick={onCancel}>Cancel</button>
    <button type="button" bind:this={first} class="btn-primary" aria-disabled={busy} onclick={() => onChoose(false)}>Keep them</button>
  </div>
  <!-- Apart, under a hairline: the one answer that removes something, saying exactly what. -->
  <div class="remove flex flex-col items-start gap-2">
    <p id="remove-what" class="text-meta text-ink-2">Or, if you don't want them any more:</p>
    <button type="button" class="btn-danger" aria-describedby="remove-what" aria-disabled={busy} onclick={() => onChoose(true)}>{removeWords(kept)}</button>
  </div>
</div>

<style>
  .keep {
    padding-bottom: 1rem;
  }
  .remove {
    padding-top: 0.75rem;
    border-top: 1px solid var(--line);
  }
</style>
