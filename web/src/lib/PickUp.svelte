<!--
  Pick up where you left off (SPEC section 7, decision 0175): one quiet line offering the article you
  last left part of the way through, "You were reading {title}, by {writer}.", the title a link in
  the text color (never the accent). It sits at the top of the list while nothing is open (decision 0275), only on the first list you
  see when you come back after half an hour away (decision 0292). It goes once an article opens or another list shows. Pressing the title opens the article where you stopped; small to the eye,
  it's 44px tall to touch (an invisible box behind it), as Forgot? is.
-->
<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { askWhereYouLeftOff, listShown, lookedAgain, pickUp, pickUpWords } from "./resume.svelte";
  import type { Article } from "./shapes";

  /** `list`: the list on screen, if one is (not while an article, a page or a phone's feeds screen shows). */
  let { onOpen, list, reading, class: classes = "" }: { onOpen: (article: Article) => void; list: string | undefined; reading: boolean; class?: string } = $props();

  onMount(() => askWhereYouLeftOff());
  $effect(() => void (list !== undefined && untrack(() => listShown(list))));
</script>

<svelte:document onvisibilitychange={() => !document.hidden && lookedAgain(list, reading)} />

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
