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

  <!-- Text size: the same six steps as + and -, and the same control as Settings. -->
  <div class="flex flex-col gap-1.5">
    <p id="aa-size-name" class="text-small text-ink-2">Text size</p>
    <TextSize bind:size={preferences.textSize} labelledby="aa-size-name" bind:first />
  </div>

  <!-- Day, night or as the device is set: the same control as Settings (decision 0056). -->
  <fieldset class="flex min-w-0 flex-col">
    <legend class="mb-1.5 text-small text-ink-2">Appearance</legend>
    <div class="choices fill" style="--columns: 3">
      {#each APPEARANCES as choice (choice.value)}
        <label class="choice">
          <input type="radio" name="aa-appearance" value={choice.value} bind:group={preferences.appearance} />
          {choice.label}
        </label>
      {/each}
    </div>
  </fieldset>

  <fieldset class="flex min-w-0 flex-col">
    <legend class="mb-1.5 text-small text-ink-2">Theme</legend>
    <div class="choices fill" style="--columns: 2">
      {#each THEMES as theme (theme)}
        <label class="choice">
          <input type="radio" name="aa-theme" value={theme} bind:group={preferences.theme} />
          {LOOKS[theme].label}
        </label>
      {/each}
    </div>
  </fieldset>

  <fieldset class="flex min-w-0 flex-col">
    <legend class="mb-1.5 text-small text-ink-2">Font</legend>
    <div class="choices fill" style="--columns: 3">
      {#each Object.entries(READING_FONTS) as [value, font] (value)}
        <!-- Each name is set in its own font, so the choice shows itself. -->
        <label class="choice" style:font-family={font.family}>
          <input type="radio" name="aa-font" {value} bind:group={preferences.readingFont} />
          {font.label}{#if font.rest}<span class="sr-only">{font.rest}</span>{/if}
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

</style>
