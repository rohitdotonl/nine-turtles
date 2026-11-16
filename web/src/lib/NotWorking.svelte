<!--
  Who isn't working, at the top of Everyone you follow (SPEC section 15,
  decisions 0186 and 0279). Under "Not working" (a week of "not found", or
  three weeks of failing), one grouped list, a line for each: the icon for
  what went wrong, their name, what went wrong in a few words at the
  right ("Feed gone"), and ›, alike ones together, the longest failing first.
  It opens their page, which has what can be done: Find new address, Write
  to and, in their settings, Unsubscribe. One line under it says so.
  Those only "Having trouble" usually come back on their own, so they're one
  row, "3 more having trouble", that shows them in place. nine turtles keeps
  checking by itself, so there's no Retry. With nothing to list, it shows
  nothing.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "./Icon.svelte";
  import LoadFailed from "./LoadFailed.svelte";
  import { byReason, listSick, reason, type Sick } from "./health";
  import { pathFor } from "./router";

  let {
    onOpen,
  }: {
    /** A row was chosen: their page opens. */
    onOpen: (event: MouseEvent, id: number) => void;
  } = $props();

  let feeds: Sick[] | undefined = $state();
  let failed = $state(false);
  /** Having trouble, shown in place. */
  let showingTrouble = $state(false);

  /** Lists who isn't working: when the page opens, and again after the list below unsubscribes, moves or undoes. */
  export function reload() {
    listSick()
      .then((sick) => {
        failed = false;
        feeds = sick;
      })
      .catch(() => (failed = true));
  }

  onMount(reload);

  let dead = $derived(byReason((feeds ?? []).filter((feed) => feed.state === "dead")));
  let trouble = $derived(byReason((feeds ?? []).filter((feed) => feed.state !== "dead")));
</script>

{#snippet row(feed: Sick)}
  {@const why = reason(feed)}
  <li class="contents">
    <a href={pathFor({ kind: "about", id: feed.id })} onclick={(event) => onOpen(event, feed.id)} class="inset-row inset-action">
      <span class="why"><Icon name={why.icon} /></span>
      <span class="min-w-0 flex-1 py-2 break-words">{feed.title}</span>
      <span class="said text-meta text-muted text-right">{why.words}</span>
      <span class="row-glyph"><Icon name="chevron-right" /></span>
    </a>
  </li>
{/snippet}

{#if failed}
  <LoadFailed words="Who isn't working couldn't be checked." heading="your-feeds-heading" onRetry={() => ((failed = false), reload())} />
{:else}
  {#if dead.length > 0}
    <section aria-labelledby="health-dead" aria-describedby="health-dead-how">
      <h3 id="health-dead" class="inset-head">Not working</h3>
      <ul class="inset-group">
        {#each dead as feed (feed.id)}{@render row(feed)}{/each}
      </ul>
      <p id="health-dead-how" class="inset-foot">Open one to fix it.</p>
    </section>
  {/if}
  {#if trouble.length > 0}
    <section aria-label="Having trouble">
      <ul class="inset-group">
        <li class="contents">
          <button type="button" class="inset-row inset-action" aria-expanded={showingTrouble} onclick={() => (showingTrouble = !showingTrouble)}>
            <span class="min-w-0 flex-1 py-2 text-left">{trouble.length}{dead.length > 0 ? " more" : ""} having trouble</span>
            <span class="text-meta text-muted shrink-0">Usually back soon</span>
            <span class="row-glyph"><Icon name={showingTrouble ? "chevron-up" : "chevron-down"} /></span>
          </button>
        </li>
        {#if showingTrouble}
          {#each trouble as feed (feed.id)}{@render row(feed)}{/each}
        {/if}
      </ul>
    </section>
  {/if}
{/if}

<style>
  /* What went wrong, at a glance: its icon in the second ink, so alike ones line up down the left edge. */
  .why {
    display: flex;
    color: var(--ink-2);
  }
  /* Its words sit at the right as a row's own small words do, and give way to a long name on a phone. */
  .said {
    max-width: 45%;
  }
</style>
