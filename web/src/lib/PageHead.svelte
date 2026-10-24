<!--
  The top line of a page that opens in place of the list and reading area
  (Settings, Add a feed, Edit feed, Edit folder): its title in the same serif
  as the list's, on the same line as the sidebar's wordmark, and an X that
  closes it (Escape does too). It never scrolls.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";

  let {
    title,
    id = "list-heading",
    heading = $bindable(),
    onClose,
    closeLabel,
    besideToggle = false,
  }: {
    title: string;
    id?: string;
    heading?: HTMLHeadingElement;
    /** Leave it out where a Back button already closes the page. */
    onClose?: () => void;
    /** What the X says to screen readers, e.g. "Close settings". */
    closeLabel?: string;
    /** The sidebar is hidden, so the line starts clear of its toggle. */
    besideToggle?: boolean;
  } = $props();
</script>

<div class={["pr-6 md:pr-10", besideToggle ? "pl-16" : "pl-6 md:pl-10"]}>
  <div class="flex min-h-11 max-w-2xl items-center justify-between gap-4">
    <h2 {id} tabindex="-1" bind:this={heading} class="min-w-0 font-serif text-heading font-bold tracking-[-0.01em] break-words">{title}</h2>
    {#if onClose}
      <button type="button" onclick={onClose} aria-label={closeLabel ?? "Close"} title="Close (Esc)" class="btn-quiet btn-icon -mr-2.5"><Icon name="close" size={20} /></button>
    {/if}
  </div>
</div>
