<!--
  A sheet: a small card over the place you were (adding a feed, editing a feed
  or a folder), so the list and the article stay in view behind it. A native
  modal dialog, so the keyboard stays inside while it's open; Escape, or a
  click on the dimmed page around it, closes it without saving.

  Every sheet has the same build (DESIGN.md → "Visual language"): a title in
  the interface font (the serif names places; a sheet is a task), the form,
  and one row of actions at its foot in a Mac sheet's order (`.sheet-actions`):
  a destructive action, if there is one, at the far left in red words, then
  Cancel, then the main action at the right end. There's no X: Cancel (or
  Escape) is the way out. Its corners, edge and shadow are the search
  options' too (`.floating`).

  It opens a little above the middle of the window, where the eye rests, and
  its height follows what's in it. Its top then stays put: a message
  appearing in it grows it downwards, so nothing you are looking at moves.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    title,
    heading = $bindable(),
    onClose,
    initial,
    children,
  }: {
    title: string;
    heading?: HTMLHeadingElement;
    onClose: () => void;
    /** Where the keyboard starts; otherwise the title, so screen readers start there. */
    initial?: () => HTMLElement | undefined;
    children: Snippet;
  } = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  /** How far down the window the card's top sits, set as it opens (and when the window is resized). */
  let top: number | undefined = $state();

  /** A little above the middle (two fifths of the space left over above it), never closer than 16px to the top. */
  function place() {
    if (!dialog) return;
    top = Math.max(16, Math.round((innerHeight - dialog.offsetHeight) * 0.4));
  }

  $effect(() => {
    if (dialog && !dialog.open) {
      dialog.showModal();
      place();
      (initial?.() ?? heading)?.focus();
    }
  });

  /** Escape: close through the page, so the address and history follow. */
  function cancel(event: Event) {
    event.preventDefault();
    onClose();
  }

  /**
   * A press on the dimmed page around the card (the dialog itself, outside its
   * card) closes it, but only if it began there too: dragging out of a field
   * while selecting its text doesn't.
   */
  let pressedOutside = false;
  function outside(event: MouseEvent) {
    if (pressedOutside && event.target === dialog) onClose();
    pressedOutside = false;
  }
</script>

<svelte:window onresize={place} />

<dialog
  bind:this={dialog}
  aria-labelledby="sheet-heading"
  oncancel={cancel}
  onpointerdown={(event) => (pressedOutside = event.target === dialog)}
  onclick={outside}
  class="floating dimmed mx-auto mb-auto w-[min(32rem,calc(100vw-2rem))] overflow-y-auto p-0 text-ink"
  style:margin-top={top === undefined ? undefined : `${top}px`}
  style:max-height={top === undefined ? undefined : `calc(100dvh - ${top}px - 1rem)`}
>
  <div class="flex flex-col gap-5 p-6">
    <h2 id="sheet-heading" tabindex="-1" bind:this={heading} class="text-large font-semibold tracking-[-0.015em] break-words">
      {title}
    </h2>
    {@render children()}
  </div>
</dialog>
