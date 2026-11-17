<!--
  The list's top, which never scrolls. On a phone, its bar (SPEC section 20): back to Home, the feeds
  screen; then the list's title with Search and More (`ListHead`). On a computer, the title line alone, in
  the column it shares with an article (list-column.css, decision 0277). Their list opened from an
  article's byline has "‹ Article" leading it, on both, where an article's own "‹ Unread" stands, back to
  that article (decision 0289).
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";
  import NineAbove from "./NineAbove.svelte";

  let {
    phone,
    feeds,
    titleHidden,
    toArticle,
    onHome,
    children,
  }: {
    phone: boolean;
    /** The reader's feeds, for the nine above the list (`NineAbove`). */
    feeds?: { checkedAt?: number | null }[];
    /** On a phone, the welcome's own heading shows instead (screen readers still hear the title). */
    titleHidden: boolean;
    /** Opened from an article's byline: back to it. */
    toArticle?: () => void;
    onHome: () => void;
    /** The title line. */
    children: Snippet;
  } = $props();

  let titleLine: HTMLElement | undefined = $state();
</script>

{#if phone || toArticle}
  <div class="pane-bar nav-bar">
    {#if toArticle}
      <button type="button" onclick={toArticle} aria-label="Back to the article" title="Back to the article" class={["btn-quiet nav-back", !phone && "text-ink-2"]}
        ><Icon name="back" size="alone" />Article</button
      >
    {:else}
      <button type="button" onclick={onHome} aria-label="Back to Home" data-behind="sidebar" class="btn-quiet nav-back"><Icon name="back" size="alone" />Home</button>
    {/if}
  </div>
{/if}
{#if phone}
  <!-- The list's scrolling area comes next: a pull down at its top shows the nine just under the title (decision 0302). -->
  <div bind:this={titleLine} class={titleHidden ? "sr-only" : "relative pr-[var(--list-end)] pb-2 pl-[var(--list-start)]"}>
    {@render children()}
    {#if !titleHidden}<NineAbove area={titleLine?.nextElementSibling as HTMLElement | undefined} {feeds} />{/if}
  </div>
{:else}
  <div class="pane-bar">{@render children()}</div>
{/if}
