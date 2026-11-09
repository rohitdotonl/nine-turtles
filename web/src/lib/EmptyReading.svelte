<!--
  The reading area with nothing open (decision 0053). Where you left off part of the way through an
  article, one quiet line offers it (`PickUp`, decision 0175). Otherwise one quiet line in the middle
  of the paper: Literata, muted, never the accent, no picture, 40% down (decision 0142), and under it,
  when the list has something to open, how to open one (`ReadingTip`). The same in every list: the
  newest article waits in the list, as every other does (decision 0220).
-->
<script lang="ts">
  import PickUp from "./PickUp.svelte";
  import ReadingTip from "./ReadingTip.svelte";
  import type { Article } from "./shapes";

  let {
    first,
    missing,
    tipSeen,
    onOpen,
  }: {
    /** The list's first article, if it has one. */
    first: Article | undefined;
    missing: boolean;
    tipSeen: boolean;
    onOpen: (article: Article) => void;
  } = $props();
</script>

<section aria-label="Article" class="flex min-w-0 flex-1 flex-col items-center justify-center bg-paper px-5 pb-[20vh]">
  <div class="relative">
    <PickUp {onOpen}>
      {#snippet otherwise()}<p class="reading-empty">Time to read something beautiful.</p>{/snippet}
    </PickUp>
    {#if first !== undefined && !missing}
      <ReadingTip {tipSeen} floating />
    {/if}
  </div>
</section>
