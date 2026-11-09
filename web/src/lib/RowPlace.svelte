<!--
  Your place, shown in the list (SPEC section 6, decision 0224): while an
  article is kept part of the way through (places.ts), its row's meta line
  says how far, in a few plain words ("· Half read"), in the source name's
  muted grey. It goes once you reach the end or scroll back to the top, as
  the place itself does. Words, never a bar or a number.
-->
<script lang="ts">
  import { howFarWords, keptPlace, onPlaces } from "./places";

  let { article }: { article: number } = $props();

  let words: string | undefined = $state();

  $effect(() => {
    const id = article;
    const look = () => {
      const place = keptPlace(id);
      words = place ? howFarWords(place) : undefined;
    };
    look();
    return onPlaces(look);
  });
</script>

{#if words}<span class="row-place">·&nbsp;{words}</span>{/if}

<style>
  .row-place {
    flex: none;
    color: var(--muted);
  }
</style>
