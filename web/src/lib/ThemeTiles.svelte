<!--
  The themes as Apple Books shows them (decision 0039): each a small page
  with "Aa" on it, in the reading font, drawn in that theme's own paper and
  ink, its name underneath. Automatic is half the light page, half the dark
  one. The chosen tile is ringed in the text color with a checkmark on its
  corner, and its name is semibold, so it never shows by color alone.

  Each tile is a real radio button under the whole tile, so arrow keys move
  between them and screen readers hear the theme's name. Settings › Look and
  feel and the Aa panel above an article use the same tiles.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { Preferences } from "./preferences";
  import { LOOKS, THEMES } from "./themes";

  let {
    theme = $bindable(),
    name,
    legend,
    legendClass = "",
  }: {
    theme: Preferences["theme"];
    /** The radio group's name, unique on the page. */
    name: string;
    /** The group's name ("Theme"), shown above the tiles. */
    legend: string;
    legendClass?: string;
  } = $props();

  const CHOICES: { value: Preferences["theme"]; label: string }[] = [
    { value: "system", label: "Automatic" },
    ...THEMES.map((each) => ({ value: each, label: LOOKS[each].label })),
  ];
</script>

<fieldset class="flex min-w-0 flex-col">
  <legend class={legendClass}>{legend}</legend>
  <div class="tiles">
    {#each CHOICES as choice (choice.value)}
      <label class="tile">
        <input type="radio" {name} value={choice.value} bind:group={theme} />
        <span aria-hidden="true" class="tile-page">
          {#if choice.value === "system"}
            <span class="half justify-end" style:background-color={LOOKS["off-white"].page} style:color={LOOKS["off-white"].ink}>A</span>
            <span class="half justify-start" style:background-color={LOOKS.dark.page} style:color={LOOKS.dark.ink}>a</span>
          {:else}
            <span class="half justify-center" style:background-color={LOOKS[choice.value].page} style:color={LOOKS[choice.value].ink}>Aa</span>
          {/if}
          <span class="tile-check"><Icon name="check" size={12} /></span>
        </span>
        <span class="tile-name">{choice.label}</span>
      </label>
    {/each}
  </div>
</fieldset>

<style>
  /* As many 72px-or-wider tiles as fit, filling the row: six to a row in Settings, four in the Aa panel. */
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
  .half {
    display: flex;
    flex: 1 1 0;
    align-items: center;
  }
  /* The checkmark on the chosen tile's corner: the page color on a disc of text color. */
  .tile-check {
    position: absolute;
    right: 0.25rem;
    bottom: 0.25rem;
    display: none;
    width: 1.125rem;
    height: 1.125rem;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background-color: var(--ink);
    color: var(--paper);
    box-shadow: 0 0 0 1.5px var(--paper);
  }
  .tile-name {
    max-width: 100%;
    overflow: hidden;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* The chosen theme: ringed in the text color, a checkmark, its name semibold (never color alone). */
  .tile:has(input:checked) {
    color: var(--ink);
    font-weight: 600;
  }
  .tile:has(input:checked) .tile-page {
    outline: 2px solid var(--ink);
  }
  .tile:has(input:checked) .tile-check {
    display: flex;
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
    .tile-check {
      forced-color-adjust: none;
      background-color: Highlight;
      color: HighlightText;
    }
  }
</style>
