<!--
  Settings (SPEC section 18). It fills the list and reading areas while the
  sidebar stays, so the reader never loses their place. "Close settings" or
  Escape goes back. Sections for sort order and the reader's data arrive with
  the milestones that give them something to do.
-->
<script lang="ts">
  import { LINE_WIDTHS, READING_FONTS, TEXT_SIZES, type Preferences } from "./preferences";
  import { signOut } from "./session";

  let {
    preferences = $bindable(),
    heading = $bindable(),
    version,
    onSignedOut,
    onClose,
  }: {
    preferences: Preferences;
    heading?: HTMLHeadingElement;
    version: string;
    onSignedOut: () => void;
    onClose: () => void;
  } = $props();

  const THEME_CHOICES = [
    { value: "system", label: "Match this device (off-white or dark)" },
    { value: "off-white", label: "Off-white" },
    { value: "sepia", label: "Sepia" },
    { value: "dark", label: "Dark" },
  ] as const;

  let message = $state("");

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

      <section aria-labelledby="status-heading" class="flex flex-col gap-2">
        <h3 id="status-heading" class="text-large font-semibold">Status</h3>
        <p>Version {version}</p>
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
