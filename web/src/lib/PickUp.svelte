<!--
  Pick up where you left off (SPEC section 7, decision 0175): one quiet line offering the article you
  last left part of the way through, "You were reading {title}, by {writer}.", the title a link in
  the text color (never the accent). It sits at the top of the list while nothing is open (decision 0275). It goes
  once an article opens. Pressing the title opens the article where you stopped; small to the eye,
  it's 44px tall to touch (an invisible box behind it), as Forgot? is.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { askWhereYouLeftOff, pickUp, pickUpWords } from "./resume.svelte";
  import type { Article } from "./shapes";

  let { onOpen, class: classes = "" }: { onOpen: (article: Article) => void; class?: string } = $props();

  onMount(askWhereYouLeftOff);
</script>

{#if pickUp.offer}
  {@const offer = pickUp.offer}
  {@const words = pickUpWords(offer)}
  <p class="reading-empty {classes}">
    {words.before}<button
      type="button"
      class="relative inline rounded-mark text-ink underline before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[''] underline decoration-[color-mix(in_srgb,currentColor_65%,transparent)] decoration-1 underline-offset-[3px] hover:decoration-current"
      onclick={() => onOpen(offer.article)}>{offer.article.title || "Untitled"}</button
    >{words.after}
  </p>
{/if}
