<!--
  Text size as Apple Books sets it: a small A and a large A on one track,
  one step each press (the same six steps as `+` and `-`), with the current
  step's name beside them, said aloud when it changes. At either end the A
  that can't go further fades and says so to screen readers. Settings › Look
  and feel and the Aa panel above an article use the same control.
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

<div class="flex items-center gap-3">
  <p role="status" class="min-w-[4.5rem] text-right text-small text-ink-2">{TEXT_SIZES[size]?.label}</p>
  <div role="group" aria-labelledby={labelledby} class="sizes">
    <button
      type="button"
      bind:this={first}
      aria-label="Smaller text"
      title="Smaller text (-)"
      aria-disabled={smallest}
      onclick={() => step(-1)}
      class="size"><span aria-hidden="true" class="text-[0.9375rem]">A</span></button
    >
    <span aria-hidden="true" class="sizes-divider"></span>
    <button
      type="button"
      aria-label="Larger text"
      title="Larger text (+)"
      aria-disabled={largest}
      onclick={() => step(1)}
      class="size"><span aria-hidden="true" class="text-[1.375rem]">A</span></button
    >
  </div>
</div>

<style>
  .sizes {
    display: flex;
    flex: 1 1 auto;
    align-items: stretch;
    padding: 0.25rem;
    border-radius: 0.625rem;
    background-color: var(--tone);
  }
  .size {
    display: flex;
    flex: 1 1 0;
    min-width: 2.75rem;
    min-height: 2.75rem;
    align-items: center;
    justify-content: center;
    border-radius: 0.4375rem;
    color: var(--ink);
    font-family: var(--reading-font);
    line-height: 1;
    cursor: pointer;
  }
  @media (pointer: fine) {
    .size {
      min-height: 2.25rem;
    }
  }
  @media (hover: hover) {
    .size:hover {
      background-color: var(--hover);
    }
  }
  .size[aria-disabled="true"] {
    color: var(--muted);
    cursor: default;
  }
  .sizes-divider {
    width: 1px;
    margin-block: 0.5rem;
    background-color: color-mix(in srgb, var(--ink) 18%, transparent);
  }
</style>
