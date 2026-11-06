<!--
  What was just done, under a group in Settings or at the top of a page,
  with Undo and a ×: the same shape and rules as the list's floating note
  (SPEC section 8). The words on the left, the buttons on the right,
  centred beside them. It goes when you do something else here, press ×,
  or leave the page; never on a timer. A refusal is in oxblood with the
  alert icon (BRAND.md → "Messages"). A screen reader hears each message
  as it arrives: from the line that holds it, or, with `announce`, from the
  words alone, which then stay in the page while empty.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import TextButton from "./TextButton.svelte";

  let {
    message,
    refusal = false,
    onUndo,
    onRetry,
    onClose,
    busy = false,
    announce = false,
    undoButton = $bindable(),
  }: {
    message: string;
    /** Something failed: oxblood, with the alert icon. */
    refusal?: boolean;
    /** Shown while there's something to undo. */
    onUndo?: () => void;
    /** Shown when trying again is the fix. */
    onRetry?: () => void;
    onClose: () => void;
    busy?: boolean;
    /** The words carry the status role themselves, without the buttons. */
    announce?: boolean;
    undoButton?: HTMLButtonElement;
  } = $props();
</script>

{#if message || announce}
  <span class={["flex w-full items-center gap-x-2", refusal ? "text-danger" : "text-ink", !message && "sr-only"]}>
    <span role={announce ? "status" : undefined} class="flex min-w-0 flex-1 items-start gap-1.5 py-2"
      >{#if message && refusal}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{/if}{message}</span
    >
    {#if message}
      {#if onRetry}
        <TextButton class="-mr-2 px-2" aria-disabled={busy} onclick={onRetry}>Try again</TextButton>
      {/if}
      {#if onUndo}
        <TextButton bind:element={undoButton} class="-mr-2 px-2" data-focus="undo" aria-disabled={busy} onclick={onUndo}>Undo</TextButton>
      {/if}
      <button type="button" onclick={onClose} aria-label="Close the note" title="Close the note" class="btn-quiet btn-icon -mr-2.5 shrink-0"
        ><Icon name="close" size={18} /></button
      >
    {/if}
  </span>
{/if}
