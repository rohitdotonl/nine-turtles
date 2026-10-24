<!--
  Text size as a stepper on the same track as the other segmented settings
  (decisions 0045, 0052): a faint track with 4px round it, a small A and a
  large A at its ends, each a raised cell like a chosen segment, with the
  same inner corners, one step each press (the same six steps as `+` and
  `-`). The current step's name sits between them as plain words on the
  track with nothing behind it of its own, so it never reads as a third
  button, and it's said aloud when it changes. At either end the A that
  can't go further fades and says so to screen readers. Settings › Look and
  feel and the Aa panel above an article use the same control.
-->
<script lang="ts">
  import { TEXT_SIZES } from "./preferences";

  let {
    size = $bindable(),
    labelledby,
    first = $bindable(),
  }: {
    /** The step, 0 to 5. */
    size: number;
    /** The id of the words naming this control ("Text size"). */
    labelledby: string;
    /** The smaller A, for a panel that starts the keyboard there. */
    first?: HTMLButtonElement;
  } = $props();

  const smallest = $derived(size <= 0);
  const largest = $derived(size >= TEXT_SIZES.length - 1);

  function step(by: 1 | -1) {
    const next = size + by;
    if (next >= 0 && next < TEXT_SIZES.length) size = next;
  }
</script>

<div role="group" aria-labelledby={labelledby} class="sizes">
  <button
    type="button"
    bind:this={first}
    aria-label="Smaller text"
    title="Smaller text (−)"
    aria-disabled={smallest}
    onclick={() => step(-1)}
    class="step"><span aria-hidden="true" class="text-[0.9375rem]">A</span></button
  >
  <p role="status" class="sizes-name">{TEXT_SIZES[size]?.label}</p>
  <button
    type="button"
    aria-label="Larger text"
    title="Larger text (+)"
    aria-disabled={largest}
    onclick={() => step(1)}
    class="step"><span aria-hidden="true" class="text-[1.375rem]">A</span></button
  >
</div>

<style>
  /* The segmented settings' own track (app.css → .choices): 4px round, a faint tone, 10px corners. */
  .sizes {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem;
    padding: 0.25rem;
    border-radius: 0.625rem;
    background-color: var(--tone);
  }
  /* Each A is a cell as a chosen segment is drawn: a raised fill, a small shadow, the segments' 7px corners. */
  .step {
    display: flex;
    flex: 0 0 auto;
    width: 3.5rem;
    min-height: 2.75rem;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    border-radius: 0.4375rem;
    background-color: var(--raised, var(--paper));
    box-shadow: var(--raised-shadow, 0 1px 2px rgb(0 0 0 / 0.12));
    color: var(--ink);
    font-family: var(--reading-font);
    line-height: 1;
    touch-action: manipulation;
    cursor: pointer;
  }
  @media (pointer: fine) {
    .step {
      min-height: 2.5rem;
    }
  }
  /* At an end, the A that can't go further sinks into the track: no fill, no shadow, the muted grey. */
  .step[aria-disabled="true"] {
    background-color: transparent;
    box-shadow: none;
    color: var(--muted);
    cursor: default;
  }
  @media (hover: hover) {
    .step:not([aria-disabled="true"]):hover {
      background-color: color-mix(in srgb, var(--ink) 5%, var(--raised, var(--paper)));
    }
  }
  @media (forced-colors: active) {
    .step {
      border-color: ButtonText;
    }
    .step[aria-disabled="true"] {
      border-color: GrayText;
      color: GrayText;
    }
  }
  /* The current step: plain words in the second ink, wide enough for "Smallest" and "Largest", so the As never shift. */
  .sizes-name {
    flex: 1 1 auto;
    min-width: 5.5rem;
    color: var(--ink-2);
    font-size: var(--text-small);
    text-align: center;
    white-space: nowrap;
  }
</style>
