<!--
  A page in a file of its own (decision 0314) whose file hasn't come yet: it
  says so in the page's place, never a blank screen. "Loading Settings…" once
  the wait passes half a second (LateLine, decision 0230); if the file can't
  be fetched, when the page will open instead (decision 0312), as Settings
  itself says without a connection. The page takes this line's place, and the
  keyboard goes to its heading (`focusArriving`).
-->
<script lang="ts">
  import { away } from "./connection.svelte";
  import LateLine from "./LateLine.svelte";

  let { name, opens = "opens", failed }: { name: string; opens?: string; failed: boolean } = $props();
</script>

<div class="min-w-0 flex-1 px-5 pt-5 md:px-10">
  {#if failed}
    <p role="status">{away().why} {name} {opens} {away().back}.</p>
  {:else}
    <LateLine words={`Loading ${name}…`} />
  {/if}
</div>
