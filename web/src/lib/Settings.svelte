<!--
  Settings (SPEC section 18). It fills the list and reading areas while the
  sidebar stays, so the reader never loses their place. "Close settings" or
  Escape goes back. Reading (the sort order) is shared across the reader's
  devices; the reader controls belong to this device. Your data imports and
  exports the reader's feeds and folders as an OPML file.
-->
<script lang="ts">
  import ImportOpml from "./ImportOpml.svelte";
  import type { Order } from "./feeds";
  import { LINE_WIDTHS, READING_FONTS, TEXT_SIZES, type Preferences } from "./preferences";
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
    { value: "system", label: "Match this device (off-white or dark)" },
    { value: "off-white", label: "Off-white" },
    { value: "sepia", label: "Sepia" },
    { value: "dark", label: "Dark" },
  ] as const;

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
      <button type="button" onclick={onClose} class="min-h-11 rounded border border-ink px-4">Close settings</button>
    </div>

    <div class="mt-8 flex max-w-2xl flex-col gap-10">
      <section aria-labelledby="reading-heading" class="flex flex-col gap-6">
        <div>
          <h3 id="reading-heading" class="text-large font-semibold">Reading</h3>
          <p class="text-small text-muted">This applies on all your devices.</p>
        </div>

        <fieldset>
          <legend class="font-semibold">Sort order</legend>
          {#each SORT_CHOICES as choice (choice.value)}
            <label class="flex min-h-11 items-center gap-3">
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
          <p role="status" class="text-small">{sortMessage}</p>
        </fieldset>
      </section>

      <section aria-labelledby="reader-heading" class="flex flex-col gap-6">
        <div>
          <h3 id="reader-heading" class="text-large font-semibold">Reader</h3>
          <p class="text-small text-muted">These apply to this device only.</p>
        </div>

        <fieldset>
          <legend class="font-semibold">Theme</legend>
          {#each THEME_CHOICES as choice (choice.value)}
            <label class="flex min-h-11 items-center gap-3">
              <input type="radio" name="theme" value={choice.value} bind:group={preferences.theme} />
              {choice.label}
            </label>
          {/each}
        </fieldset>

        <fieldset>
          <legend class="font-semibold">Reading font</legend>
          {#each Object.entries(READING_FONTS) as [value, font] (value)}
            <label class="flex min-h-11 items-center gap-3">
              <input type="radio" name="reading-font" {value} bind:group={preferences.readingFont} />
              {font.label}
            </label>
          {/each}
        </fieldset>

        <fieldset>
          <legend class="font-semibold">Text size</legend>
          <div class="flex flex-wrap gap-x-6">
            {#each TEXT_SIZES as size, index (size.label)}
              <label class="flex min-h-11 items-center gap-3">
                <input type="radio" name="text-size" value={index} bind:group={preferences.textSize} />
                {size.label}
              </label>
            {/each}
          </div>
        </fieldset>

        <fieldset>
          <legend class="font-semibold">Line width</legend>
          <div class="flex flex-wrap gap-x-6">
            {#each Object.entries(LINE_WIDTHS) as [value, width] (value)}
              <label class="flex min-h-11 items-center gap-3">
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
      </section>

      <section aria-labelledby="status-heading" class="flex flex-col gap-2">
        <h3 id="status-heading" class="text-large font-semibold">Status</h3>
        <p>Version {version}</p>
        {#if updates.ready}
          <!-- Never swapped while you read: the new version starts when you reload, or next time you open slowfeed. -->
          <p class="flex flex-wrap items-center gap-x-4 gap-y-2">
            A new version is ready.
            <button type="button" onclick={() => location.reload()} class="min-h-11 rounded border border-ink px-4">Reload</button>
          </p>
        {/if}
      </section>

      <section aria-labelledby="account-heading" class="flex flex-col items-start gap-2">
        <h3 id="account-heading" class="text-large font-semibold">Signing in</h3>
        <button type="button" onclick={leave} class="min-h-11 rounded border border-ink px-4">Sign out</button>
        <p role="status">{message}</p>
      </section>
    </div>
  </div>
</section>

<style>
  .reading-sample {
    font-family: var(--reading-font);
    font-size: var(--reading-size);
    line-height: 1.6;
    max-width: var(--reading-measure);
  }
</style>
