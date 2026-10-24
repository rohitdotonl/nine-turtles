<!--
  The "Aa" reading panel (SPEC section 7; decision 0034): the reader's own
  controls, one press from the text, as in Apple Books. Text size (the same
  steps as `+` and `-`), the theme, the reading font and the line width, all
  the same preferences as Settings › Look and feel, applied at once to the
  article behind it.

  On a computer it is a small panel under its Aa button; on a phone, a sheet
  along the bottom of the screen with its own Close button. It isn't modal:
  the article stays readable and usable around it. Escape closes it and puts
  the keyboard back on the Aa button; a press outside it, or the keyboard
  leaving it, closes it too.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "./Icon.svelte";
  import { LINE_WIDTHS, READING_FONTS, TEXT_SIZES, type Preferences } from "./preferences";
  import { LOOKS, THEMES } from "./themes";

  let {
    preferences = $bindable(),
    anchor,
    phone = false,
    onClose,
  }: {
    preferences: Preferences;
    /** The Aa button: the panel sits under it, and the keyboard goes back to it. */
    anchor: HTMLElement | undefined;
    /** A sheet along the bottom of a phone's screen, rather than a panel under the button. */
    phone?: boolean;
    /** `giveBack`: put the keyboard back on the Aa button. */
    onClose: (giveBack: boolean) => void;
  } = $props();

  const THEME_CHOICES: { value: Preferences["theme"]; label: string }[] = [
    { value: "system", label: "Automatic" },
    ...THEMES.map((theme) => ({ value: theme, label: LOOKS[theme].label })),
  ];

  let panel: HTMLDivElement | undefined = $state();
  let first: HTMLButtonElement | undefined = $state();
  let place = $state({ top: 0, right: 0 });

  const smallest = $derived(preferences.textSize <= 0);
  const largest = $derived(preferences.textSize >= TEXT_SIZES.length - 1);

  function size(step: 1 | -1) {
    const next = preferences.textSize + step;
    if (next >= 0 && next < TEXT_SIZES.length) preferences.textSize = next;
  }

  /** Under the Aa button, its right edge lined up with the button's, never past the window's edges. */
  function measure() {
    if (phone || !anchor) return;
    const box = anchor.getBoundingClientRect();
    place = { top: Math.round(box.bottom + 4), right: Math.max(16, Math.round(innerWidth - box.right)) };
  }

  onMount(() => {
    measure();
    first?.focus();
  });
</script>

<svelte:window
  onresize={measure}
  onpointerdown={(event) => {
    const target = event.target as Node;
    // A press on the Aa button is its own: it closes the panel by itself.
    if (!panel?.contains(target) && !anchor?.contains(target)) onClose(false);
  }}
/>

<div
  role="dialog"
  aria-label="Reading appearance"
  tabindex="-1"
  bind:this={panel}
  onkeydown={(event) => {
    if (event.key !== "Escape") return;
    // Handled here, so the app's own Escape (back to the list) waits for the next press.
    event.preventDefault();
    event.stopPropagation();
    onClose(true);
  }}
  onfocusout={(event) => {
    const next = event.relatedTarget as Node | null;
    // The keyboard moved on to something outside: the panel closes behind it, so it never covers where it went.
    if (next && !panel?.contains(next) && !anchor?.contains(next)) onClose(false);
  }}
  class={["reading-panel floating z-40 flex flex-col gap-4 overflow-y-auto font-sans", phone ? "phone" : "popover"]}
  style:top={phone ? undefined : `${place.top}px`}
  style:right={phone ? undefined : `${place.right}px`}
>
  {#if phone}
    <div class="-mt-1 -mr-2 flex items-center justify-between">
      <p aria-hidden="true" class="text-ui font-semibold">Appearance</p>
      <button type="button" aria-label="Close" title="Close" onclick={() => onClose(true)} class="btn-quiet btn-icon"><Icon name="close" size={20} /></button>
    </div>
  {/if}

  <!-- Text size: the same six steps as + and -. The current step's name is said aloud when it changes. -->
  <div class="flex flex-col gap-1.5">
    <div class="flex items-baseline justify-between">
      <p id="aa-size-name" class="text-small text-ink-2">Text size</p>
      <p role="status" class="text-meta text-muted">{TEXT_SIZES[preferences.textSize]?.label}</p>
    </div>
    <div role="group" aria-labelledby="aa-size-name" class="sizes">
      <button
        type="button"
        bind:this={first}
        aria-label="Smaller text"
        title="Smaller text (-)"
        aria-disabled={smallest}
        onclick={() => size(-1)}
        class="size"><span aria-hidden="true" class="text-[0.9375rem]">A</span></button
      >
      <span aria-hidden="true" class="sizes-divider"></span>
      <button
        type="button"
        aria-label="Larger text"
        title="Larger text (+)"
        aria-disabled={largest}
        onclick={() => size(1)}
        class="size"><span aria-hidden="true" class="text-[1.375rem]">A</span></button
      >
    </div>
  </div>

  <!-- Each theme as its own page: "Aa" in the reading font, on its own paper in its own ink. -->
  <fieldset class="flex min-w-0 flex-col gap-1.5">
    <legend class="mb-1.5 text-small text-ink-2">Theme</legend>
    <div class="tiles">
      {#each THEME_CHOICES as choice (choice.value)}
        <label class="tile">
          <input type="radio" name="aa-theme" value={choice.value} bind:group={preferences.theme} />
          <span aria-hidden="true" class="tile-page">
            {#if choice.value === "system"}
              <!-- Automatic: half the light page, half the dark one. -->
              <span class="half justify-end" style:background-color={LOOKS["off-white"].page} style:color={LOOKS["off-white"].ink}>A</span>
              <span class="half justify-start" style:background-color={LOOKS.dark.page} style:color={LOOKS.dark.ink}>a</span>
            {:else}
              <span class="half justify-center" style:background-color={LOOKS[choice.value].page} style:color={LOOKS[choice.value].ink}>Aa</span>
            {/if}
          </span>
          <span class="tile-name">{choice.label}</span>
        </label>
      {/each}
    </div>
  </fieldset>

  <fieldset class="flex min-w-0 flex-col">
    <legend class="mb-1.5 text-small text-ink-2">Font</legend>
    <div class="choices fill" style="--columns: 2">
      {#each Object.entries(READING_FONTS) as [value, font] (value)}
        <!-- Each name is set in its own font, so the choice shows itself. -->
        <label class="choice" style:font-family={font.family}>
          <input type="radio" name="aa-font" {value} bind:group={preferences.readingFont} />
          {font.label}
        </label>
      {/each}
    </div>
  </fieldset>

  <fieldset class="flex min-w-0 flex-col">
    <legend class="mb-1.5 text-small text-ink-2">Line width</legend>
    <div class="choices fill" style="--columns: 3">
      {#each Object.entries(LINE_WIDTHS) as [value, width] (value)}
        <label class="choice">
          <input type="radio" name="aa-width" {value} bind:group={preferences.lineWidth} />
          {width.label}
        </label>
      {/each}
    </div>
  </fieldset>
</div>

<style>
  .reading-panel {
    /* One of the things that float (app.css → .floating): its corners, edge and shadow. */
    position: fixed;
  }
  .popover {
    width: min(22rem, calc(100vw - 2rem));
    max-height: calc(100dvh - 6rem);
    padding: 1rem;
  }
  /* On a phone: a sheet along the bottom, the width of the screen, clear of the home bar. */
  .phone {
    inset-inline: 0;
    bottom: 0;
    max-height: 85dvh;
    padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom));
    border-width: 1px 0 0;
    border-radius: 1rem 1rem 0 0;
  }

  /* A small A and a large A on one track, parted by a fine line. */
  .sizes {
    display: flex;
    align-items: stretch;
    padding: 0.25rem;
    border-radius: 0.625rem;
    background-color: var(--tone);
  }
  .size {
    display: flex;
    flex: 1 1 0;
    min-height: 2.75rem;
    align-items: center;
    justify-content: center;
    border-radius: 0.4375rem;
    color: var(--ink);
    line-height: 1;
    cursor: pointer;
  }
  @media (hover: hover) {
    .size:hover {
      background-color: var(--hover);
    }
  }
  /* At the end of the steps, the A that can't go further fades, and says so to screen readers. */
  .size[aria-disabled="true"] {
    color: var(--muted);
    cursor: default;
  }
  .sizes-divider {
    width: 1px;
    margin-block: 0.5rem;
    background-color: color-mix(in srgb, var(--ink) 18%, transparent);
  }

  /* app.css's segmented control, filling the panel in even columns. */
  .fill {
    display: grid;
    grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
  }
  .fill :global(.choice) {
    justify-content: center;
    padding-inline: 0.5rem;
    text-align: center;
    line-height: 1.2;
    text-wrap: balance;
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.75rem 0.5rem;
  }
  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    border-radius: 0.625rem;
    color: var(--ink-2);
    font-size: var(--text-meta);
    cursor: pointer;
  }
  .tile input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  .tile-page {
    display: flex;
    overflow: hidden;
    width: 100%;
    height: 3.25rem;
    border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
    border-radius: 0.625rem;
    outline: 2px solid transparent;
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
  .tile-name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* The chosen theme: ringed in the text color, its name semibold (never color alone). */
  .tile:has(input:checked) {
    color: var(--ink);
    font-weight: 600;
  }
  .tile:has(input:checked) .tile-page {
    outline-color: var(--ink);
  }
  .tile:has(input:focus-visible) {
    outline: 2px solid var(--ink);
    outline-offset: 4px;
  }
  @media (forced-colors: active) {
    .tile:has(input:checked) .tile-page {
      outline-color: Highlight;
    }
  }
</style>
