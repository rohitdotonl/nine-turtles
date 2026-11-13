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
  import Dated from "./Dated.svelte";
  import Icon from "./Icon.svelte";
  import TextButton from "./TextButton.svelte";
  import { tipEvery } from "./keyboard";

  let {
    message,
    refusal = false,
    onUndo,
    undoWord = "Undo",
    onRetry,
    retryWord = "Try again",
    onClose,
    also,
    busy = false,
    announce = false,
    undoButton = $bindable(),
  }: {
    message: string;
    /** Something failed: oxblood, with the alert icon. */
    refusal?: boolean;
    /** Shown while there's something to undo. */
    onUndo?: () => void;
    /** What Undo says: "Undo the import" after "Wrong file?" (decision 0238). */
    undoWord?: string;
    /** Shown when trying again is the fix. */
    onRetry?: () => void;
    /** What that button says: "Sign in" when being signed out is why (decision 0230). */
    retryWord?: string;
    onClose: () => void;
    /** Other ways on, before Try again: Write back's "Write in Gmail" (SPEC section 37). */
    also?: { word: string; press: () => void }[];
    busy?: boolean;
    /** The words carry the status role themselves, without the buttons. */
    announce?: boolean;
    undoButton?: HTMLButtonElement;
  } = $props();
</script>

{#if message || announce}
  <!-- Empty, it stays for screen readers but takes no room: "w-full" beside "sr-only" would win and push the page sideways. -->
  <span class={["flex items-center gap-x-2", refusal ? "text-danger" : "text-ink", message ? "w-full" : "sr-only"]}>
    <span role={announce ? "status" : undefined} class="flex min-w-0 flex-1 items-start gap-2 py-2"
      >{#if message && refusal}<span class="mt-px shrink-0"><Icon name="alert" /></span>{/if}<Dated text={message} /></span
    >
    {#if message}
      {#each also ?? [] as way (way.word)}
        <TextButton class="-mr-2 px-2" onclick={way.press}>{way.word}</TextButton>
      {/each}
      {#if onRetry}
        <TextButton class="-mr-2 px-2" aria-disabled={busy} onclick={onRetry}>{retryWord}</TextButton>
      {/if}
      {#if onUndo}
        <TextButton bind:element={undoButton} class="-mr-2 px-2" data-focus="undo" title={tipEvery("Undo", "undo")} aria-disabled={busy} onclick={onUndo}>{undoWord}</TextButton>
      {/if}
      <button type="button" onclick={onClose} aria-label="Close the note" title="Close the note" class="btn-quiet btn-icon -mr-3 shrink-0"
        ><Icon name="close" size="alone" /></button
      >
    {/if}
  </span>
{/if}
