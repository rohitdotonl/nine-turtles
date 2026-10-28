<!--
  The "Aa" reading panel (SPEC section 7; decision 0034): the reader's own
  controls, one press from the text, as in Apple Books. Text size (the same
  steps as `+` and `-`), the Appearance (day, night or as the device is set), the reading font and the line width, all
  the same preferences as Settings › Look and feel, applied at once to the
  article behind it.

  On a computer it is a small panel under its Aa button; on a phone, a sheet
  along the bottom of the screen with its own Close button. It isn't modal:
  the article stays readable and usable around it. Escape closes it and puts
  the keyboard back on the Aa button; a press outside it, or the keyboard
  leaving it, closes it too.
-->
<script lang="ts">
  import { onMount, tick } from "svelte";
  import Icon from "./Icon.svelte";
  import TextSize from "./TextSize.svelte";
  import { APPEARANCES, LOOKS, THEMES } from "./themes";
  import { LINE_WIDTHS, READING_FONTS, type Preferences } from "./preferences";

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

  let panel: HTMLDivElement | undefined = $state();
  let first: HTMLButtonElement | undefined = $state();
  let place = $state({ top: 0, right: 0 });

  /** Under the Aa button, its right edge lined up with the button's, never past the window's edges. */
  function measure() {
    if (phone || !anchor) return;
    const box = anchor.getBoundingClientRect();
    place = { top: Math.round(box.bottom + 4), right: Math.max(16, Math.round(innerWidth - box.right)) };
  }

  onMount(() => {
    measure();
    // Once the text size control inside has handed back its smaller A.
    tick().then(() => first?.focus());
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

  <!--
    One quiet line per setting (decision 0123): its name in small spaced
    capitals at the left, its choices as plain words (or, for Appearance,
    three small swatches) at the right. The chosen word is semibold in full
    ink and underlined, so it shows without color; the rest are in the
    second ink. Radio buttons underneath, so the arrow keys move along a line.
  -->
  <div class="aa-line">
    <p id="aa-size-name" class="aa-name">Text size</p>
    <div class="min-w-0 flex-1"><TextSize bind:size={preferences.textSize} labelledby="aa-size-name" bind:first /></div>
  </div>

  <!-- Day, night or as the device is set (decision 0056): a white swatch, a black one and one half of each. -->
  <fieldset class="aa-line">
    <legend class="aa-name">Appearance</legend>
    <div class="aa-choices">
      {#each APPEARANCES as choice (choice.value)}
        <label class="swatch" title={choice.label}>
          <input type="radio" name="aa-appearance" value={choice.value} bind:group={preferences.appearance} />
          <span aria-hidden="true" class={["dot", choice.value]}></span>
          <span class="sr-only">{choice.label}</span>
        </label>
      {/each}
    </div>
  </fieldset>

  <fieldset class="aa-line">
    <legend class="aa-name">Theme</legend>
    <div class="aa-choices">
      {#each THEMES as theme (theme)}
        <label class="word">
          <input type="radio" name="aa-theme" value={theme} bind:group={preferences.theme} />
          {LOOKS[theme].label}
        </label>
      {/each}
    </div>
  </fieldset>

  <fieldset class="aa-line">
    <legend class="aa-name">Font</legend>
    <div class="aa-choices">
      {#each Object.entries(READING_FONTS) as [value, font] (value)}
        <!-- Each name is set in its own font, so the choice shows itself. -->
        <label class="word" style:font-family={font.family}>
          <input type="radio" name="aa-font" {value} bind:group={preferences.readingFont} />
          {font.label}{#if font.rest}<span class="sr-only">{font.rest}</span>{/if}
        </label>
      {/each}
    </div>
  </fieldset>

  <fieldset class="aa-line">
    <legend class="aa-name">Line width</legend>
    <div class="aa-choices">
      {#each Object.entries(LINE_WIDTHS) as [value, width] (value)}
        <label class="word">
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
    width: min(26rem, calc(100vw - 2rem));
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

  /* A line: the setting's name in a fixed column, its choices after it. */
  .aa-line {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.75rem;
  }
  .aa-name {
    float: left;
    flex: none;
    width: 5.5rem;
    padding: 0;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .aa-choices {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.875rem;
  }
  /* Every choice 44px to press, with a mouse too: the floor allows less only in the sidebar and the search options. */
  .word,
  .swatch {
    position: relative;
    display: inline-flex;
    min-width: 2.75rem;
    min-height: 2.75rem;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .word {
    color: var(--ink-2);
    text-decoration: underline 2px transparent;
    text-underline-offset: 0.4em;
  }
  @media (hover: hover) {
    .word:hover {
      color: var(--ink);
    }
  }
  .word:has(input:checked) {
    color: var(--ink);
    font-weight: 600;
    text-decoration-color: currentColor;
  }
  .word input,
  .swatch input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  .word:has(input:focus-visible),
  .swatch:has(input:focus-visible) {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
    border-radius: 6px;
  }
  .swatch {
    width: 2.75rem;
  }
  /* A swatch: 24px, with a faint edge so the white one shows on white; the chosen one has a ring of the text color around it. */
  .dot {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--ink) 60%, transparent);
  }
  .dot.light {
    background: #ffffff;
  }
  .dot.dark {
    background: #141414;
  }
  .dot.auto {
    background: linear-gradient(90deg, #ffffff 50%, #141414 50%);
  }
  .swatch:has(input:checked) .dot {
    box-shadow:
      0 0 0 2px var(--paper),
      0 0 0 4px var(--ink);
  }
  @media (forced-colors: active) {
    .swatch:has(input:checked) .dot {
      forced-color-adjust: none;
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
</style>
