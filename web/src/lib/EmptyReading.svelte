<!--
  The reading area with nothing open (decision 0053): one quiet line in the middle of the paper, as
  a Mac app shows when nothing is chosen: Literata, muted, never the accent, no picture, 40% down
  (decision 0142). Under it, when the list has something to open, how to open one (`ReadingTip`).
-->
<script lang="ts">
  import ReadingTip from "./ReadingTip.svelte";

  let { listCount, missing, tipSeen }: { listCount: number; missing: boolean; tipSeen: boolean } = $props();
</script>

<section aria-label="Article" class="flex min-w-0 flex-1 flex-col items-center justify-center bg-paper px-5 pb-[20vh]">
  <div class="relative">
    <p class="reading-empty">Time to read something beautiful.</p>
    {#if listCount > 0 && !missing}
      <ReadingTip {tipSeen} floating />
    {/if}
  </div>
</section>
