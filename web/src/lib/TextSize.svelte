<!--
  Text size as a stepper, as Apple Books draws it (decision 0055): one flat
  capsule in the segmented settings' faint track, a small A with a minus and a large A with a plus at
  its ends (so which does what is plain), one step each press (the same six steps as `+` and `-`), and the
  current step's name between them, each part split from the next by a
  hairline. Nothing in it is raised, so it never reads as a choice with a
  chosen segment. The step's name is plain words, and it's said aloud when
  it changes. At either end the A that
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
    class="step"><span aria-hidden="true" class="text-[0.9375rem]">A</span><span aria-hidden="true" class="sign">−</span></button
  >
  <p role="status" class="sizes-name">{TEXT_SIZES[size]?.label}</p>
  <button
    type="button"
    aria-label="Larger text"
    title="Larger text (+)"
    aria-disabled={largest}
    onclick={() => step(1)}
    class="step"><span aria-hidden="true" class="text-[1.375rem]">A</span><span aria-hidden="true" class="sign">+</span></button
  >
</div>

<style>
  /* The minus and plus beside each A: smaller and quieter than the A. */
  .sign {
    margin-left: 0.1875rem;
    font-size: 1rem;
    font-weight: 500;
    color: var(--ink-2);
  }
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
  /* Each A is a flat cell of the capsule: no fill, no shadow, the segments' 7px corners for the pointer's tone. */
  .step {
    display: flex;
    flex: 0 0 auto;
    width: 3.5rem;
    min-height: 2.75rem;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    border-radius: 0.4375rem;
    background-color: transparent;
    box-shadow: none;
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
  /*
    The hairlines between the parts, as Books splits its capsule: in a faint
    tone of the text color, the cells' own height, so the capsule's 4px rim
    stays clear of them.
  */
  .step + .sizes-name,
  .sizes-name + .step {
    border-left: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
  }
  .step + .sizes-name {
    align-self: stretch;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* At an end, the A that can't go further fades to the muted grey (and says so to screen readers); the step's name says "Smallest" or "Largest" too. */
  .step[aria-disabled="true"] {
    color: var(--muted);
    cursor: default;
  }
  @media (hover: hover) {
    .step:not([aria-disabled="true"]):hover {
      background-color: var(--hover);
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
