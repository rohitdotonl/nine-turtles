<!--
  Recently unsubscribed (decision 0240), the last group of Everyone you
  follow: who the reader, or an assistant, unsubscribed from in the last 30
  days, newest first, each with when and until when it's kept, and Bring
  back. Drawn as Settings' rows; nothing shows while it's empty.
-->
<script lang="ts">
  import Dated from "./Dated.svelte";
  import { shortName } from "./assistants";
  import { keptLine, type Kept } from "./recentlyUnsubscribed";

  let { kept, busy, onBringBack }: { kept: Kept[]; busy: boolean; onBringBack: (kept: Kept) => void } = $props();
</script>

{#if kept.length > 0}
  <section aria-labelledby="recently-unsubscribed">
    <h3 id="recently-unsubscribed" class="inset-head">Recently unsubscribed</h3>
    <ul class="inset-group">
      {#each kept as row (row.ids.join())}
        {@const name = shortName(row.title || "Untitled")}
        <li class="inset-row kept-row">
          <p class="min-w-0 flex-1 break-words">
            {name}<br /><span class="text-meta text-muted"><Dated text={keptLine(row)} /></span>
          </p>
          <button type="button" data-kept={row.ids.join()} aria-disabled={busy} onclick={() => onBringBack(row)} class="btn btn-small"
            >Bring back<span class="sr-only"> {name}</span></button
          >
        </li>
      {/each}
    </ul>
    <p class="inset-foot">Kept for 30 days, with their articles, so you can bring them back.</p>
  </section>
{/if}

<style>
  /* As Connected assistants' rows: the name and its line, Bring back at the right. */
  .kept-row {
    flex-wrap: nowrap;
    padding-block: 0.5rem;
  }
  .kept-row > p {
    line-height: 1.4;
  }
  @media (width < 30rem) {
    .kept-row {
      flex-wrap: wrap;
    }
    .kept-row > button {
      margin-left: auto;
    }
  }
</style>
