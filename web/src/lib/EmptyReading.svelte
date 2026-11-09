<!--
  The reading area with nothing open (decision 0053). Where you left off part of the way through an
  article, one quiet line offers it (`PickUp`, decision 0175). Otherwise, when the list starts with
  an unread article, that article already begun, with Start reading (`ReadingLead`, decision 0210),
  in the article's own column, its title where the article's title will be (decision 0218). Otherwise one quiet line in the middle of
  the paper: Literata, muted, never the accent, no picture, 40% down (decision 0142), and under it,
  when the list has something to open, how to open one (`ReadingTip`).
-->
<script lang="ts">
  import PickUp from "./PickUp.svelte";
  import ReadingLead from "./ReadingLead.svelte";
  import ReadingTip from "./ReadingTip.svelte";
  import { pickUp } from "./resume.svelte";
  import type { Order } from "./reading";
  import type { Article } from "./shapes";

  let {
    first,
    order,
    lead,
    missing,
    tipSeen,
    onOpen,
  }: {
    /** The list's first article, if it has one. */
    first: Article | undefined;
    order: Order;
    /** Whether the list may be begun here: not search results, and Unread is on. */
    lead: boolean;
    missing: boolean;
    tipSeen: boolean;
    onOpen: (article: Article) => void;
  } = $props();

  let begun = $derived(lead && !missing && pickUp.asked && !pickUp.offer && first !== undefined && !first.read ? first : undefined);
</script>

{#if begun}
  <section aria-label="Article" class="lead-pane scroll-gutter flex min-w-0 flex-1 flex-col overflow-y-auto bg-paper px-5 pb-10 md:px-14">
    <div class="article w-full"><ReadingLead article={begun} {order} onOpen={() => onOpen(begun)} /></div>
  </section>
{:else}
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
{/if}
