<!--
  The themes as Apple Books shows them (decisions 0039, 0046): each a small
  page with "Aa" on it, in the reading font, drawn in that theme's own paper
  and ink for the version showing now (day or night, from the Appearance
  choice beside the tiles), its name underneath; Bold's "Aa" is bold, as its
  article text is. The chosen tile has two marks, as in Apple Books: one ring in the text
  color, a little clear of the page, and its name semibold, so it never shows
  by color alone (decision 0045: no checkmark badge, no inner edge).

  Each tile is a real radio button under the whole tile, so arrow keys move
  between them and screen readers hear the theme's name. Settings › Look and
  feel and the Aa panel above an article use the same tiles.
-->
<script lang="ts">
  import type { Preferences } from "./preferences";
  import { LOOKS, THEMES, type Mode } from "./themes";

  let {
    theme = $bindable(),
    mode,
    name,
    legend,
    legendClass = "",
  }: {
    theme: Preferences["theme"];
    /** The version showing now: each tile is drawn in it. */
    mode: Mode;
    /** The radio group's name, unique on the page. */
    name: string;
    /** The group's name ("Theme"), shown above the tiles. */
    legend: string;
    legendClass?: string;
  } = $props();
</script>

<fieldset class="flex min-w-0 flex-col">
  <legend class={legendClass}>{legend}</legend>
  <div class="tiles">
    {#each THEMES as each (each)}
      <label class="tile">
        <input type="radio" {name} value={each} bind:group={theme} />
        <span
          aria-hidden="true"
          class={["tile-page", each === "bold" && "bold"]}
          style:background-color={LOOKS[each][mode].page}
          style:color={LOOKS[each][mode].ink}>Aa</span
        >
        <span class="tile-name">{LOOKS[each].label}</span>
      </label>
    {/each}
  </div>
</fieldset>

<style>
  /* As many 72px-or-wider tiles as fit, filling the row: six to a row in Settings, three in the Aa panel (on a phone, three, below). */
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(4.5rem, 1fr));
    gap: 0.75rem 0.625rem;
  }
  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    min-width: 0;
    border-radius: 0.625rem;
    color: var(--ink-2);
    font-size: var(--text-meta);
    cursor: pointer;
  }
  .tile input {
    position: absolute;
    z-index: 1; /* above the picture, so a press anywhere on the tile chooses it */
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  .tile-page {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    width: 100%;
    max-width: 4.5rem;
    aspect-ratio: 1;
    border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
    border-radius: 0.625rem;
    outline: none;
    outline-offset: 2px;
    font-family: var(--reading-font);
    font-size: 1.375rem;
    line-height: 1;
  }
  /* Bold's "Aa" (decision 0046): 700 asks for the heaviest face shipped, Literata's 600 or Atkinson's 700. */
  .tile-page.bold {
    font-weight: 700;
  }
  .tile-name {
    max-width: 100%;
    overflow: hidden;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* The chosen theme: one ring in the text color, 2px clear of the page, and its name semibold (never color alone). */
  .tile:has(input:checked) {
    color: var(--ink);
    font-weight: 600;
  }
  .tile:has(input:checked) .tile-page {
    border-color: transparent;
    outline: 2px solid var(--ink);
  }
  /* The keyboard's place: around the whole tile and its name, a step out from the ring. */
  .tile:has(input:focus-visible) {
    outline: 2px solid var(--ink);
    outline-offset: 4px;
  }
  @media (forced-colors: active) {
    .tile:has(input:checked) .tile-page {
      outline-color: Highlight;
    }
  }
  /*
    On a phone, three to a row in two even rows, as Apple Books on iOS shows
    its six themes (never four and an orphaned two), each page a little
    wider than tall (decision 0052).
  */
  @media (width < 40rem) {
    .tiles {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.75rem 1rem;
    }
    .tile-page {
      max-width: none;
      aspect-ratio: 4 / 3;
    }
  }
</style>
