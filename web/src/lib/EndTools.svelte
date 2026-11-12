<!--
  The article's end, on a computer (SPEC section 7, decision 0263): the top
  bar scrolls away with the title, so what's wanted on finishing waits under
  the closing rule, above Write back: Star and View original, as quiet
  buttons with their words. View original is left out when the note above
  already links the rest on the publisher's site. A phone keeps its toolbar
  in reach instead, so this is a computer's only.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { tip } from "./keyboard";

  let { starred, onStar, original }: { starred: boolean; onStar: () => void; /** The original's address, when this row offers it. */ original?: string } = $props();
</script>

<div class="end-tools" lang="en">
  <!-- One name for screen readers, pressed or not, as the top bar's Star; the filled star shows its state. -->
  <button type="button" aria-pressed={starred} title={tip(starred ? "Unstar" : "Star", "star")} onclick={onStar} class={["btn-quiet btn-small", starred && "text-ink"]}
    ><Icon name="star" filled={starred} />Star</button
  >
  {#if original}
    <a href={original} target="_blank" rel="noopener noreferrer" title={tip("View original", "open-original")} class="btn-quiet btn-small"
      ><Icon name="open" />View original<span class="sr-only"> (opens in a new tab)</span></a
    >
  {/if}
</div>

<style>
  .end-tools {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.25rem;
    margin-top: 1.25rem;
    font-family: var(--font-sans);
  }
</style>
