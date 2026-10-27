<!--
  The top line of a page that opens in place of the list and reading area
  (Settings, Add a feed, Edit feed, Edit folder): its title in the same serif
  as the list's, on the same line as the sidebar's wordmark, and an X that
  closes it (Escape does too), in the top line shared by every pane (decision 0043). It never scrolls. Like the page under it, it's
  a column centred in the pane. A page opened from Settings (decision 0120)
  has "‹ Settings" on a line of its own above its title instead of an X.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";

  let {
    title,
    id = "list-heading",
    heading = $bindable(),
    onClose,
    closeLabel,
    onBack,
    backTo,
    besideToggle = false,
    column = "max-w-2xl",
  }: {
    title: string;
    id?: string;
    heading?: HTMLHeadingElement;
    /** Leave it out where a Back button already closes the page. */
    onClose?: () => void;
    /** What the X says to screen readers, e.g. "Close settings". */
    closeLabel?: string;
    /** A back button above the title, to the page named `backTo` (Escape does the same). */
    onBack?: () => void;
    backTo?: string;
    /** The sidebar is hidden, so the line starts clear of its toggle. */
    besideToggle?: boolean;
    /** The page's column width, so the title lines up with it. */
    column?: string;
  } = $props();
</script>

<div class={["pane-bar pr-5 md:pr-10", besideToggle ? "pl-16" : "pl-5 md:pl-10"]}>
  {#if onBack}
    <div class={["mx-auto flex w-full flex-col items-start pb-1", column]}>
      <button type="button" onclick={onBack} aria-label={`Back to ${backTo}`} title={`Back to ${backTo} (Esc)`} class="btn-quiet nav-back -ml-2 text-ink-2"
        ><Icon name="back" size={20} />{backTo}</button
      >
      <h2 {id} tabindex="-1" bind:this={heading} class="min-w-0 font-serif text-heading font-semibold tracking-[-0.01em] break-words">{title}</h2>
    </div>
  {:else}
    <div class={["mx-auto flex min-h-11 w-full items-center justify-between gap-4", column]}>
      <h2 {id} tabindex="-1" bind:this={heading} class="min-w-0 font-serif text-heading font-semibold tracking-[-0.01em] break-words">{title}</h2>
      {#if onClose}
        <button type="button" onclick={onClose} aria-label={closeLabel ?? "Close"} title="Close (Esc)" class="btn-quiet btn-icon -mr-2.5"><Icon name="close" size={20} /></button>
      {/if}
    </div>
  {/if}
</div>
