<!--
  The top line of a page that opens in place of the list and reading area
  (Settings, Add a feed, Edit feed, Edit folder): its title in the same serif
  as the list's, on the same line as the sidebar's wordmark, and an X that
  closes it (Escape does too), in the top line shared by every pane (decision 0043). It never scrolls. Like the page under it, it's
  a column centred in the pane. A page opened from Settings (decision 0120)
  (Hidden articles and All readers too, decision 0231) has
  "‹ Settings" (or the page it came from) on a line of its own above its
  title instead of an X, and on a phone Settings itself and Everyone you
  follow have "‹ Home". On a computer Everyone you follow has neither: it's
  a place in the sidebar, as a list is (decision 0266).
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
    /** The page's column width, so the title lines up with it. */
    column?: string;
  } = $props();
</script>

<div class="pane-bar px-5 md:px-10">
  {#if onBack}
    <!-- One top for every screen below home (DESIGN.md → "The system"): Back in the top line's own height, the title on the line under it. -->
    <div class={["mx-auto flex w-full min-w-0 flex-col items-start pb-2", column]}>
      <div class="top-back">
        <!-- Back to Home, a phone's swipe drags this screen off the sidebar (SwipeBack.svelte). -->
        <button type="button" onclick={onBack} aria-label={`Back to ${backTo}`} title={`Back to ${backTo} (Esc)`} data-behind={backTo === "Home" ? "sidebar" : undefined} class="btn-quiet nav-back -ml-2 text-ink-2"
          ><Icon name="back" size="alone" /><bdi>{backTo}</bdi></button
        >
      </div>
      <h2 {id} tabindex="-1" bind:this={heading} class="top-title min-w-0 font-display text-heading font-semibold tracking-[-0.01em] break-words"><bdi>{title}</bdi></h2>
    </div>
  {:else}
    <div class={["mx-auto flex min-h-11 w-full items-center justify-between gap-4", column]}>
      <h2 {id} tabindex="-1" bind:this={heading} class="min-w-0 font-display text-heading font-semibold tracking-[-0.01em] break-words"><bdi>{title}</bdi></h2>
      {#if onClose}
        <button type="button" onclick={onClose} aria-label={closeLabel ?? "Close"} title="Close (Esc)" class="btn-quiet btn-icon -mr-3"><Icon name="close" size="alone" /></button>
      {/if}
    </div>
  {/if}
</div>
