<!--
  A sheet: a small card over the place you were (adding a feed, editing a feed
  or a folder), so the list and the article stay in view behind it. A native
  modal dialog, so the keyboard stays inside while it's open; Escape, or a
  click on the dimmed page around it, closes it without saving.

  Every sheet has the same build (DESIGN.md → "Visual language"): a title in
  the interface font (the serif names places; a sheet is a task), the form,
  one row of actions at its foot (Cancel, then the main action at the right
  end; `.sheet-actions`), and, when there is one, a destructive action apart
  below a hairline (`.sheet-danger`). There's no X: Cancel (or Escape) is
  the way out. Its corners, edge and shadow are the search options' too
  (`.floating`).
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

  $effect(() => {
    if (dialog && !dialog.open) {
      dialog.showModal();
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

<dialog
  bind:this={dialog}
  aria-labelledby="sheet-heading"
  oncancel={cancel}
  onpointerdown={(event) => (pressedOutside = event.target === dialog)}
  onclick={outside}
  class="floating mx-auto mt-[12vh] max-h-[min(40rem,84dvh)] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto p-0 text-ink"
>
  <div class="flex flex-col gap-5 p-6">
    <h2 id="sheet-heading" tabindex="-1" bind:this={heading} class="text-large font-semibold tracking-[-0.015em] break-words">
      {title}
    </h2>
    {@render children()}
  </div>
</dialog>

<style>
  /* Anchored a fixed way down rather than centred, so it doesn't move when a message appears in it. */
  dialog::backdrop {
    background: rgb(28 24 20 / 0.28);
  }
</style>
