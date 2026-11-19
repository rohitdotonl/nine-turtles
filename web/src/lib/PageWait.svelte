<!--
  A page in a file of its own (decisions 0314, 0315) whose file hasn't come
  yet: it says so in the page's place, never a blank screen. "Loading
  Settings…" once the wait passes half a second (LateLine, decision 0230).
  If the file couldn't be fetched, never a dead end (decision 0312): without
  a connection, calmly, when it will open, and it opens by itself once the
  device is back online; otherwise that nine turtles can't be reached, with
  Try again. Both load the page again, because a browser remembers a file it
  couldn't fetch and won't ask for it twice. The page takes this line's
  place, and the keyboard goes to its heading (`focusArriving`).
-->
<script lang="ts">
  import { away } from "./connection.svelte";
  import LateLine from "./LateLine.svelte";
  import LoadFailed from "./LoadFailed.svelte";

  let {
    name,
    opens = "opens",
    failed,
    class: classes = "min-w-0 flex-1 px-5 pt-5 md:px-10",
  }: { name: string; opens?: string; failed: boolean; class?: string } = $props();

  const again = () => location.reload();

  $effect(() => {
    if (!failed || !away().offline) return;
    addEventListener("online", again);
    return () => removeEventListener("online", again);
  });
</script>

<div id="page-wait" tabindex="-1" class={classes}>
  {#if failed && away().offline}
    <p role="status">{away().why} {name} {opens} {away().back}.</p>
  {:else if failed}
    <LoadFailed words={away().why} heading="page-wait" onRetry={again} />
  {:else}
    <LateLine words={`Loading ${name}…`} />
  {/if}
</div>
