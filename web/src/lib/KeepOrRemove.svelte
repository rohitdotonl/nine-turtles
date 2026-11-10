<!--
  Unsubscribing from a place where the reader kept something (SPEC section
  42): it asks, in place of Edit's Unsubscribe, whether what they kept stays.
  "Keep them" leaves their starred and marked articles, and their note on
  the person, where they are (Starred, Notes, search). The safe answers sit
  together (Keep them, Cancel); under a hairline, apart, the oxblood button
  names exactly what it removes ("Remove the 2 starred articles too",
  decision 0237). Either can be undone straight afterwards, as any
  unsubscribe can. Asked only when there's something kept.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { keptWords, removeWords, type Kept } from "./keeping";

  let { name, kept, busy, onChoose, onCancel }: { name: string; kept: Kept; busy: boolean; onChoose: (removeKept: boolean) => void; onCancel: () => void } = $props();

  let first: HTMLButtonElement | undefined = $state();
  onMount(() => first?.focus());
</script>

<div role="group" aria-labelledby="keep-question" aria-describedby="keep-what" class="keep flex flex-col gap-3" lang="en">
  <p id="keep-question" class="text-base font-semibold text-ink">Keep what you saved from {name}?</p>
  <p id="keep-what" class="text-small text-ink-2">{keptWords(kept)}</p>
  <div class="flex flex-wrap gap-2">
    <button type="button" bind:this={first} class="btn-primary" aria-disabled={busy} onclick={() => onChoose(false)}>Keep them</button>
    <button type="button" class="btn-quiet" onclick={onCancel}>Cancel</button>
  </div>
  <!-- Apart, under a hairline: the one answer that removes something, saying exactly what. -->
  <div class="remove flex flex-col items-start gap-2">
    <p id="remove-what" class="text-small text-ink-2">Or, if you don't want them any more:</p>
    <button type="button" class="btn-danger" aria-describedby="remove-what" aria-disabled={busy} onclick={() => onChoose(true)}>{removeWords(kept)}</button>
  </div>
</div>

<style>
  .keep {
    padding: 1rem 1.125rem;
    border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
    border-radius: 0.75rem;
  }
  .remove {
    padding-top: 0.75rem;
    border-top: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
  }
</style>
