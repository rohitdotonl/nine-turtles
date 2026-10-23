<!--
  Settings (SPEC section 18). It fills the list and reading areas while the
  sidebar stays, so the reader never loses their place. "Close settings" or
  Escape goes back. Reading (the sort order) is shared across the reader's
  devices; the reader controls belong to this device. Your data imports and
  exports the reader's feeds and folders as an OPML file, and exports their
  starred articles as a JSON Feed file.
-->
<script lang="ts">
  import ImportOpml from "./ImportOpml.svelte";
  import type { Order } from "./feeds";
  import { BAR_COLORS, LINE_WIDTHS, READING_FONTS, TEXT_SIZES, type Preferences } from "./preferences";
  import { signOut } from "./session";
  import { updates } from "./updates.svelte";

  let {
    preferences = $bindable(),
    sort,
    onSort,
    heading = $bindable(),
    dataHeading = $bindable(),
    version,
    onSignedOut,
    onClose,
    onImported,
  }: {
    preferences: Preferences;
    /** Newest or oldest first; unknown until the server answers. */
    sort: Order | undefined;
    /** Saves a new sort order; fails if it couldn't be saved. */
    onSort: (sort: Order) => Promise<void>;
    heading?: HTMLHeadingElement;
    /** "Your data", where the empty state's "Import OPML" leads. */
    dataHeading?: HTMLHeadingElement;
    version: string;
    onSignedOut: () => void;
    onClose: () => void;
    /** Feeds were imported: the sidebar loads them. */
    onImported: () => void;
  } = $props();

  const THEME_CHOICES = [
    { value: "system", label: "Match this device" },
    { value: "off-white", label: "Off-white" },
    { value: "sepia", label: "Sepia" },
    { value: "dark", label: "Dark" },
  ] as const;

  // A small disc of each theme's reading background (DESIGN.md → "Color"); "Match this device" is half of each.
  const SWATCHES: Record<(typeof THEME_CHOICES)[number]["value"], string> = { system: BAR_COLORS["off-white"], ...BAR_COLORS };

  const SORT_CHOICES = [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
  ] as const;

  let message = $state("");
  let sortMessage = $state("");

  async function chooseSort(next: Order) {
    sortMessage = "";
    try {
      await onSort(next);
    } catch {
      sortMessage = "The sort order couldn't be saved. Try again in a moment.";
    }
  }

  async function leave() {
    try {
      await signOut();
      onSignedOut();
    } catch {
      message = "Couldn't sign out. Try again in a moment.";
    }
  }
</script>

<section aria-labelledby="settings-heading" class="flex flex-1 flex-col bg-paper pt-16">
  <div class="min-h-0 flex-1 overflow-y-auto px-6 pb-10 md:px-10">
    <div class="flex max-w-2xl flex-wrap items-center justify-between gap-4">
      <h2 id="settings-heading" tabindex="-1" bind:this={heading} class="text-xlarge font-semibold">Settings</h2>
      <button type="button" onclick={onClose} class="btn">Close settings</button>
    </div>

    <div class="mt-8 flex max-w-2xl flex-col gap-10">
      <section aria-labelledby="reading-heading" class="flex flex-col gap-6">
        <div>
          <h3 id="reading-heading" class="text-large font-semibold">Reading</h3>
          <p class="text-small text-muted">This applies on all your devices.</p>
        </div>

        <fieldset>
          <legend class="mb-2 font-semibold">Sort order</legend>
          <div class="choices">
          {#each SORT_CHOICES as choice (choice.value)}
            <label class="choice">
              <input
                type="radio"
                name="sort"
                value={choice.value}
                checked={sort === choice.value}
                disabled={sort === undefined}
                onchange={() => chooseSort(choice.value)}
              />
              {choice.label}
            </label>
          {/each}
          </div>
          <p role="status" class="text-small">{sortMessage}</p>
        </fieldset>
      </section>

      <section aria-labelledby="reader-heading" class="flex flex-col gap-6">
        <div>
          <h3 id="reader-heading" class="text-large font-semibold">Reader</h3>
          <p class="text-small text-muted">These apply to this device only.</p>
        </div>

        <fieldset>
          <legend class="mb-2 font-semibold">Theme</legend>
          <div class="choices">
          {#each THEME_CHOICES as choice (choice.value)}
            <label class="choice">
              <input type="radio" name="theme" value={choice.value} bind:group={preferences.theme} />
              <span aria-hidden="true" class="swatch" style:background-color={SWATCHES[choice.value]}
                >{#if choice.value === "system"}<span class="swatch-half" style:background-color={BAR_COLORS.dark}></span>{/if}</span
              >
              {choice.label}
            </label>
          {/each}
          </div>
          <p class="mt-2 text-small text-muted">Match this device uses off-white or dark, following its light or dark setting.</p>
        </fieldset>

        <fieldset>
          <legend class="mb-2 font-semibold">Reading font</legend>
          <div class="choices">
          {#each Object.entries(READING_FONTS) as [value, font] (value)}
            <!-- Each name is set in its own font, so the choice shows itself. -->
            <label class="choice" style:font-family={font.family}>
              <input type="radio" name="reading-font" {value} bind:group={preferences.readingFont} />
              {font.label}
            </label>
          {/each}
          </div>
        </fieldset>

        <fieldset>
          <legend class="mb-2 font-semibold">Text size</legend>
          <div class="choices">
            {#each TEXT_SIZES as size, index (size.label)}
              <label class="choice">
                <input type="radio" name="text-size" value={index} bind:group={preferences.textSize} />
                {size.label}
              </label>
            {/each}
          </div>
        </fieldset>

        <fieldset>
          <legend class="mb-2 font-semibold">Line width</legend>
          <div class="choices">
            {#each Object.entries(LINE_WIDTHS) as [value, width] (value)}
              <label class="choice">
                <input type="radio" name="line-width" {value} bind:group={preferences.lineWidth} />
                {width.label}
              </label>
            {/each}
          </div>
        </fieldset>

        <figure class="flex flex-col gap-2">
          <figcaption class="text-small text-muted">How articles will look</figcaption>
          <div class="reading-sample">
            <p>
              Most writing on the open web was never meant to be skimmed. It was written slowly, by someone who
              cared, for whoever would read it to the end. A reader can be built the same way: it shows you what is
              there, and then it lets you go.
            </p>
          </div>
        </figure>
      </section>

      <section aria-labelledby="data-heading" class="flex flex-col gap-4">
        <div>
          <h3 id="data-heading" tabindex="-1" bind:this={dataHeading} class="text-large font-semibold">Your data</h3>
          <p class="max-w-xl">
            OPML is the file feed readers use to move your feeds and folders between apps. Import one to bring your
            feeds here; export one now and then, and keep it somewhere safe.
          </p>
        </div>
        <ImportOpml {onImported} />
        <p class="max-w-xl">
          Your starred articles can be saved as a JSON Feed file, a standard format other feed readers can open. It
          keeps each article's text, its original link and the feed it came from.
        </p>
        <a href="/api/starred/export" download class="btn self-start">
          Export starred articles
        </a>
      </section>

      <section aria-labelledby="status-heading" class="flex flex-col gap-2">
        <h3 id="status-heading" class="text-large font-semibold">Status</h3>
        <p>Version {version}</p>
        {#if updates.ready}
          <!-- Never swapped while you read: the new version starts when you reload, or next time you open slowfeed. -->
          <p class="flex flex-wrap items-center gap-x-4 gap-y-2">
            A new version is ready.
            <button type="button" onclick={() => location.reload()} class="btn">Reload</button>
          </p>
        {/if}
      </section>

      <section aria-labelledby="account-heading" class="flex flex-col items-start gap-2">
        <h3 id="account-heading" class="text-large font-semibold">Signing in</h3>
        <button type="button" onclick={leave} class="btn">Sign out</button>
        <p role="status">{message}</p>
      </section>
    </div>
  </div>
</section>

<style>
  /*
    A choice among a few (SPEC section 18): each one a labeled tile. The radio
    button itself covers the whole tile, invisible, so a tap anywhere picks it
    and screen readers and keys work as with any radio button. The chosen tile
    is filled with the text color and its word is semibold, so it shows
    without color too. Never ink blue.
  */
  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .choice {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.75rem;
    padding-inline: 1rem;
    border: 1px solid var(--muted);
    border-radius: 0.375rem;
    cursor: pointer;
  }
  @media (hover: hover) {
    .choice:hover {
      background-color: var(--hover);
    }
  }
  .choice input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  .choice:has(input:checked) {
    border-color: var(--ink);
    background-color: var(--ink);
    color: var(--paper);
    font-weight: 600;
  }
  .choice:has(input:focus-visible) {
    outline: 3px solid var(--ink);
    outline-offset: 2px;
  }
  /* High-contrast mode replaces the fill, so the chosen tile takes the system's own highlight colors. */
  @media (forced-colors: active) {
    .choice:has(input:checked) {
      forced-color-adjust: none;
      border-color: Highlight;
      background-color: Highlight;
      color: HighlightText;
    }
    .choice:has(input:focus-visible) {
      outline-color: CanvasText;
    }
  }
  .choice:has(input:disabled) {
    cursor: default;
    color: var(--muted);
  }
  .swatch {
    position: relative;
    overflow: hidden;
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    border: 1px solid var(--muted);
    border-radius: 9999px;
  }
  .swatch-half {
    position: absolute;
    inset: 0 0 0 50%;
  }
  .reading-sample {
    font-family: var(--reading-font);
    font-size: var(--reading-size);
    line-height: 1.6;
    max-width: var(--reading-measure);
  }
</style>
