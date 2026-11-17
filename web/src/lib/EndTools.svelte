<!--
  The article's end, on a computer (SPEC section 7, decisions 0263, 0298):
  what's wanted on finishing waits under the closing rule, close to the last
  words, above Write back: Save and View original, as quiet
  buttons with their words, in the muted grey (decision 0298). View original is left out when the note above
  already links the rest on the publisher's site. A phone keeps its toolbar
  in reach instead, so this is a computer's only.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { tip } from "./keyboard";

  let { starred, onStar, original }: { starred: boolean; onStar: () => void; /** The original's address, when this row offers it. */ original?: string } = $props();
</script>

<div class="end-tools" lang="en">
  <!-- One name for screen readers, pressed or not, as the top bar's Save; the filled bookmark shows its state. -->
  <button type="button" aria-pressed={starred} title={tip(starred ? "Remove from Saved" : "Save", "star")} onclick={onStar} class={["btn-quiet btn-small", starred && "text-ink"]}
    ><Icon name="bookmark" filled={starred} />Save</button
  >
  {#if original}
    <a href={original} target="_blank" rel="noopener noreferrer" title={tip("View original", "open-original")} class="btn-quiet btn-small"
      ><Icon name="open" />View original<span class="sr-only">{" "}(opens in a new tab)</span></a
    >
  {/if}
</div>

<style>
  /* In the reading face's small spaced capitals, as a book's last page names its maker (decision 0300). */
  .end-tools {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1rem;
    margin-top: 2rem;
    font-family: var(--reading-font);
  }
  .end-tools > :global(*) {
    font-size: var(--text-meta);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  /* A step quieter than Write back under them (decision 0298): the muted grey, which keeps 4.5 : 1 on the page in every theme; a saved bookmark stays in full ink. */
  .end-tools > :global(:not(.text-ink)) {
    color: var(--muted);
  }
</style>
