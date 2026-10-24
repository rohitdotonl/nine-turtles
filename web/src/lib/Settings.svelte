<!--
  Settings (SPEC section 18). It fills the list and reading areas while the
  sidebar stays, so the reader never loses their place. "Close settings" or
  Escape goes back. Reading (the sort order) is shared across the reader's
  devices; the reader controls belong to this device. Your data imports and
  exports the reader's feeds and folders as an OPML file, and exports their
  starred articles as a JSON Feed file.
-->
<script lang="ts">
  import { edge } from "./edge";
  import ImportOpml from "./ImportOpml.svelte";
  import PageHead from "./PageHead.svelte";
  import type { Order } from "./feeds";
  import { LINE_WIDTHS, READING_FONTS, TEXT_SIZES, type Preferences } from "./preferences";
  import { signOut } from "./session";
  import { updates } from "./updates.svelte";
  import { LOOKS, THEMES } from "./themes";

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
    besideToggle = false,
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
    /** The sidebar is hidden, so the top line starts clear of its toggle. */
    besideToggle?: boolean;
  } = $props();

  const THEME_CHOICES: { value: Preferences["theme"]; label: string }[] = [
    { value: "system", label: "Automatic" },
    ...THEMES.map((theme) => ({ value: theme, label: LOOKS[theme].label })),
  ];

  /** Each theme's page, sidebar and text, for its little picture (app.css holds the real ones). */
  const PREVIEWS = LOOKS;

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

<section aria-labelledby="settings-heading" class="flex flex-1 flex-col bg-paper pt-3">
  <PageHead title="Settings" id="settings-heading" bind:heading {onClose} closeLabel="Close settings" {besideToggle} />
  <div use:edge class="scroller relative min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-16 md:px-10">
    <!--
      Grouped like a system settings window: each group a card with a heading
      above it, one setting per row, rows parted by a hairline. On a wide
      screen a row's name sits on the left and its choices on the right.
    -->
    <div class="mx-auto flex max-w-2xl flex-col gap-10">
      <section aria-labelledby="reading-heading">
        {@render groupHead("reading-heading", "Reading", "This applies on all your devices.")}
        <div class="group-card">
          <fieldset class="setting">
            <legend class="setting-name">Sort order</legend>
            <div class="setting-control">
              <div class="choices" style="--phone-columns: 2">
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
            </div>
          </fieldset>
        </div>
      </section>

      <section aria-labelledby="reader-heading">
        {@render groupHead("reader-heading", "Look and feel", "These apply to this device only.")}
        <!-- The same preferences as the Aa panel above an article (decision 0034). -->
        <p class="-mt-1 mb-3 text-small text-muted">The Aa button above an article changes these too, while you read.</p>
        <div class="group-card">
          <fieldset class="setting">
            <legend class="setting-name">Theme</legend>
            <div class="setting-control">
              <!-- A small picture of the app in each theme, its name underneath; the chosen one is ringed and its name semibold. -->
              <div class="themes">
                {#each THEME_CHOICES as choice (choice.value)}
                  <label class="theme">
                    <input type="radio" name="theme" value={choice.value} bind:group={preferences.theme} />
                    <span aria-hidden="true" class="theme-picture">
                      {#each choice.value === "system" ? (["off-white", "dark"] as const) : [choice.value] as look (look)}
                        <span class="theme-page" style:background-color={PREVIEWS[look].page} style:color={PREVIEWS[look].ink}>
                          <span class="theme-side" style:background-color={PREVIEWS[look].side}></span>
                          <span class="theme-lines"><span></span><span></span><span></span></span>
                        </span>
                      {/each}
                    </span>
                    <span class="theme-name">{choice.label}</span>
                  </label>
                {/each}
              </div>
              <p class="text-small text-muted">Automatic is off-white or dark, following this device's light or dark setting.</p>
            </div>
          </fieldset>

          <fieldset class="setting">
            <legend class="setting-name">Reading font</legend>
            <div class="setting-control">
              <div class="choices" style="--phone-columns: 2">
                {#each Object.entries(READING_FONTS) as [value, font] (value)}
                  <!-- Each name is set in its own font, so the choice shows itself. -->
                  <label class="choice" style:font-family={font.family}>
                    <input type="radio" name="reading-font" {value} bind:group={preferences.readingFont} />
                    {font.label}
                  </label>
                {/each}
              </div>
            </div>
          </fieldset>

          <fieldset class="setting">
            <legend class="setting-name">Text size</legend>
            <div class="setting-control">
              <div class="choices" style="--phone-columns: 3">
                {#each TEXT_SIZES as size, index (size.label)}
                  <label class="choice">
                    <input type="radio" name="text-size" value={index} bind:group={preferences.textSize} />
                    {size.label}
                  </label>
                {/each}
              </div>
            </div>
          </fieldset>

          <fieldset class="setting">
            <legend class="setting-name">Line width</legend>
            <div class="setting-control">
              <div class="choices" style="--phone-columns: 3">
                {#each Object.entries(LINE_WIDTHS) as [value, width] (value)}
                  <label class="choice">
                    <input type="radio" name="line-width" {value} bind:group={preferences.lineWidth} />
                    {width.label}
                  </label>
                {/each}
              </div>
            </div>
          </fieldset>

          <figure class="setting setting-wide">
            <figcaption class="setting-name">Preview</figcaption>
            <div class="reading-sample">
              <p>
                Most writing on the open web was never meant to be skimmed. It was written slowly, by someone who
                cared, for whoever would read it to the end. A reader can be built the same way: it shows you what is
                there, and then it lets you go.
              </p>
            </div>
          </figure>
        </div>
      </section>

      <section aria-labelledby="data-heading">
        <div class="mb-3">
          <h3 id="data-heading" tabindex="-1" bind:this={dataHeading} class="text-ui font-semibold">Your data</h3>
          <p class="mt-0.5 text-small text-muted">Files you can keep, and take to another app.</p>
        </div>
        <div class="group-card">
          <div class="setting setting-wide">
            <div>
              <h4 class="setting-name">Feeds and folders</h4>
              <p class="mt-1 max-w-xl text-small text-ink-2">
                OPML is the file feed readers use to move your feeds and folders between apps. Import one to bring your
                feeds here; export one now and then, and keep it somewhere safe.
              </p>
            </div>
            <ImportOpml {onImported} />
          </div>
          <div class="setting setting-wide">
            <div>
              <h4 class="setting-name">Starred articles</h4>
              <p class="mt-1 max-w-xl text-small text-ink-2">
                Saved as a JSON Feed file, a standard format other feed readers can open, with each article's text, its
                original link and the feed it came from.
              </p>
            </div>
            <a href="/api/starred/export" download class="btn self-start">Export starred articles</a>
          </div>
        </div>
      </section>

      <!-- A quiet footer: which version this is, and signing out. -->
      <footer aria-label="Version and account" class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p class="text-small text-muted" translate="no">Version {version}</p>
          <button type="button" onclick={leave} class="btn-quiet btn-small -mr-2.5">Sign out</button>
        </div>
        {#if updates.ready}
          <!-- Never swapped while you read: the new version starts when you reload, or next time you open slowfeed. -->
          <p class="flex flex-wrap items-center gap-x-4 gap-y-2 text-ui">
            A new version is ready.
            <button type="button" onclick={() => location.reload()} class="btn">Reload</button>
          </p>
        {/if}
        <p role="status" class="text-small">{message}</p>
      </footer>
    </div>
  </div>
</section>

{#snippet groupHead(id: string, name: string, note: string)}
  <div class="mb-3">
    <h3 {id} class="text-ui font-semibold">{name}</h3>
    <p class="mt-0.5 text-small text-muted">{note}</p>
  </div>
{/snippet}

<style>
  /* A group of settings: a card a shade off the page, rows parted by hairlines. */
  .group-card {
    border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
    border-radius: 0.75rem;
    background-color: var(--list);
  }
  .setting {
    display: grid;
    gap: 0.75rem;
    min-width: 0;
    margin: 0;
    padding: 1.125rem 1.25rem;
    border: 0;
  }
  .setting + .setting {
    border-top: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
  }
  .setting-name {
    padding: 0;
    color: var(--ink);
    font-size: var(--text-ui);
    font-weight: 600;
  }
  /* A legend sits in the grid only when it floats (a fieldset's legend otherwise sits on its edge). */
  legend.setting-name {
    float: left;
  }
  .setting > :is(a, button) {
    justify-self: start;
  }
  .setting-control {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.625rem;
  }
  /* On a wide screen the name sits on the left and the choices on the right. */
  @media (width >= 48rem) {
    .setting:not(.setting-wide) {
      grid-template-columns: 8.5rem minmax(0, 1fr);
      align-items: start;
    }
    .setting:not(.setting-wide) > .setting-name {
      padding-top: 0.875rem;
    }
  }

  /* The choices themselves are app.css's segmented control. On a narrow screen the choices fill the width in even columns instead of wrapping ragged. */
  @media (width < 40rem) {
    .choices {
      display: grid;
      width: 100%;
      grid-template-columns: repeat(var(--phone-columns), minmax(0, 1fr));
    }
    .choice {
      justify-content: center;
    }
  }
  .themes {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 6.5rem));
    gap: 0.75rem;
  }
  @media (width < 40rem) {
    /* Four to a row, as a phone's own theme pickers show them. */
    .themes {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.5rem;
    }
  }
  .theme {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    color: var(--ink-2);
    font-size: var(--text-small);
    cursor: pointer;
  }
  .theme input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  .theme-picture {
    display: flex;
    overflow: hidden;
    aspect-ratio: 3 / 2;
    border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
    border-radius: 0.5rem;
    outline: 2px solid transparent;
    outline-offset: 2px;
  }
  .theme-page {
    display: flex;
    flex: 1;
  }
  .theme-side {
    width: 28%;
  }
  .theme-lines {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem;
  }
  .theme-lines > span {
    height: 0.1875rem;
    border-radius: 1px;
    background-color: currentColor;
    opacity: 0.55;
  }
  .theme-lines > span:first-child {
    width: 70%;
    opacity: 0.9;
  }
  .theme-lines > span:last-child {
    width: 50%;
  }
  .theme:has(input:checked) {
    color: var(--ink);
    font-weight: 600;
  }
  .theme:has(input:checked) .theme-picture {
    outline-color: var(--ink);
  }
  .theme:has(input:focus-visible) {
    outline: 2px solid var(--ink);
    outline-offset: 4px;
    border-radius: 0.5rem;
  }
  @media (forced-colors: active) {
    .theme:has(input:checked) .theme-picture {
      outline-color: Highlight;
    }
  }
  /* A small page of the reading area's own tone, set as articles will be. */
  .reading-sample {
    font-family: var(--reading-font);
    font-size: var(--reading-size);
    line-height: 1.6;
    max-width: calc(var(--reading-measure) + 3rem);
    padding: 1.25rem 1.5rem;
    border-radius: 0.5rem;
    background-color: var(--paper);
  }
  /* On a phone articles read a tenth smaller; so does the sample. */
  @media (max-width: 40rem) {
    .reading-sample {
      font-size: calc(var(--reading-size) * 0.9);
    }
  }
</style>
