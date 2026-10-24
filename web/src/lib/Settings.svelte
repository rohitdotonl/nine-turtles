<!--
  Settings (SPEC section 18), laid out as Apple Books' settings are: one
  centred column of grouped inset lists, each group with a small header above
  it and an explaining line below, each row its name on the left and its
  control on the right, every control the same width (decision 0039). It
  fills the list and reading areas while the sidebar stays, so the reader
  never loses their place. "Close settings" or
  Escape goes back. Reading (the sort order) is shared across the reader's
  devices; the reader controls belong to this device. Your data imports and
  exports the reader's feeds and folders as an OPML file, and exports their
  starred articles as a JSON Feed file.
-->
<script lang="ts">
  import { edge } from "./edge";
  import Icon from "./Icon.svelte";
  import ImportOpml from "./ImportOpml.svelte";
  import PageHead from "./PageHead.svelte";
  import TextSize from "./TextSize.svelte";
  import ThemeTiles from "./ThemeTiles.svelte";
  import type { Order } from "./feeds";
  import { LINE_WIDTHS, READING_FONTS, type Preferences } from "./preferences";
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

  const SORT_CHOICES = [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
  ] as const;

  let message = $state("");
  let sortMessage = $state("");
  /** What the last OPML import did, in plain words. */
  let importLines: string[] = $state([]);

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

<section aria-labelledby="settings-heading" class="flex flex-1 flex-col bg-paper">
  <PageHead title="Settings" id="settings-heading" bind:heading {onClose} closeLabel="Close settings" {besideToggle} column="max-w-[35rem]" />
  <div use:edge class="scroller relative min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-16 md:px-10">
    <div class="mx-auto flex max-w-[35rem] flex-col gap-8">
      <section aria-labelledby="reading-heading">
        <h3 id="reading-heading" class="inset-head">Reading</h3>
        <div class="inset-group">
          <fieldset class="inset-row">
            <legend class="row-name">Sort order</legend>
            <div class="choices control" style="--columns: 2">
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
          </fieldset>
        </div>
        <p class="inset-foot">This applies on all your devices.</p>
        <p role="status" class={["inset-foot text-danger", !sortMessage && "sr-only"]}>{sortMessage}</p>
      </section>

      <section aria-labelledby="reader-heading">
        <h3 id="reader-heading" class="inset-head">Look and feel</h3>
        <!--
          A short passage set as articles will be, straight under the header and
          before the controls, as the sample sits at the top of Apple Books' Aa
          panel: on the page itself, not a card inside a card (decision 0042).
        -->
        <figure class="reading-sample">
          <figcaption class="sr-only">Preview</figcaption>
          <p>
            Most writing on the open web was never meant to be skimmed. It was written slowly, by someone who
            cared, for whoever would read it to the end. A reader can be built the same way: it shows you what is
            there, and then it lets you go.
          </p>
        </figure>
        <div class="inset-group">
          <div class="inset-row block py-4">
            <ThemeTiles bind:theme={preferences.theme} name="theme" legend="Theme" legendClass="mb-3" />
          </div>

          <fieldset class="inset-row">
            <legend class="row-name">Reading font</legend>
            <div class="choices control" style="--columns: 2">
              {#each Object.entries(READING_FONTS) as [value, font] (value)}
                <!-- Each name is set in its own font, so the choice shows itself. -->
                <label class="choice" style:font-family={font.family}>
                  <input type="radio" name="reading-font" {value} bind:group={preferences.readingFont} />
                  {font.label}
                </label>
              {/each}
            </div>
          </fieldset>

          <div class="inset-row">
            <p id="text-size-name" class="row-name">Text size</p>
            <!-- A stepper: two round-ended As with the current step between them as plain words (decision 0045). -->
            <div class="control">
              <TextSize bind:size={preferences.textSize} labelledby="text-size-name" />
            </div>
          </div>

          <fieldset class="inset-row">
            <legend class="row-name">Line width</legend>
            <div class="choices control" style="--columns: 3">
              {#each Object.entries(LINE_WIDTHS) as [value, width] (value)}
                <label class="choice">
                  <input type="radio" name="line-width" {value} bind:group={preferences.lineWidth} />
                  {width.label}
                </label>
              {/each}
            </div>
          </fieldset>

        </div>
        <!-- The same preferences as the Aa panel above an article (decision 0034). -->
        <p class="inset-foot">
          These apply to this device only. Automatic is off-white or dark, following the device's own setting. The Aa
          button above an article changes these too, while you read.
        </p>
      </section>

      <section aria-labelledby="data-heading">
        <h3 id="data-heading" tabindex="-1" bind:this={dataHeading} class="inset-head">Your data</h3>
        <div class="inset-group">
          <ImportOpml {onImported} bind:lines={importLines} />
          <a href="/api/starred/export" download class="inset-row inset-action"
            >Export starred articles<span class="row-glyph"><Icon name="download" size={18} /></span></a
          >
        </div>
        <div role="status" class={["inset-foot flex flex-col gap-1 text-ink", importLines.length === 0 && "sr-only"]}>
          {#each importLines as line (line)}
            <p>{line}</p>
          {/each}
        </div>
        <p class="inset-foot">
          OPML is the file feed readers use to move your feeds and folders between apps; export one now and then, and
          keep it somewhere safe. Starred articles are saved as a JSON Feed file, which other feed readers can open,
          with each article's text, its original link and the feed it came from.
        </p>
      </section>

      <section aria-labelledby="account-heading">
        <h3 id="account-heading" class="inset-head">Account</h3>
        <div class="inset-group">
          {#if updates.ready}
            <!-- Never swapped while you read: the new version starts when you reload, or next time you open slowfeed. -->
            <div class="inset-row">
              <p>A new version is ready.</p>
              <button type="button" onclick={() => location.reload()} class="btn btn-small">Reload</button>
            </div>
          {/if}
          <!--
            In the text color, not the destructive red: signing out removes
            nothing, and red in slowfeed means something goes (decision 0042).
            Its trailing door says it acts, as the rows above do.
          -->
          <button type="button" onclick={leave} class="inset-row inset-action"
            >Sign out<span class="row-glyph"><Icon name="sign-out" size={18} /></span></button
          >
        </div>
        <p role="status" class={["inset-foot text-danger", !message && "sr-only"]}>{message}</p>
        <p class="inset-foot" translate="no">Version {version}</p>
      </section>
    </div>
  </div>
</section>

<style>
  /* A row's name, on its left. A fieldset's legend floats so it sits in the row like any other child. */
  .row-name {
    float: left;
    padding: 0;
    color: var(--ink);
    font-size: var(--text-ui);
  }
  /* Every control the same width at a row's right end; on a narrow screen it takes the row's width under its name. */
  .control {
    flex: 0 1 22rem;
    min-width: 0;
  }
  .choices.control {
    display: grid;
    grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
  }
  .choices.control :global(.choice) {
    justify-content: center;
    padding-inline: 0.5rem;
    text-align: center;
    line-height: 1.2;
    text-wrap: balance;
  }
  @media (width < 40rem) {
    .control {
      flex-basis: 100%;
    }
  }
  /* A passage on the page itself, set as articles will be, its left edge on the rows' words. */
  .reading-sample {
    max-width: calc(var(--reading-measure) + 2rem);
    margin: 0.25rem 0 1.25rem;
    padding-inline: 1rem;
    font-family: var(--reading-font);
    font-size: var(--reading-size);
    line-height: 1.6;
  }
  /*
    On a phone articles read a tenth smaller; so does the sample. Its left
    edge moves out to the groups' own edge, the screen's one 20px margin, so
    it reads as the page's text, not as indented body text; the small
    headers stay inset on the rows' words, as iOS sets them (decision 0048).
  */
  @media (max-width: 40rem) {
    .reading-sample {
      padding-inline: 0;
      font-size: calc(var(--reading-size) * 0.9);
    }
  }
</style>
