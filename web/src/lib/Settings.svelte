<!--
  Settings (SPEC section 18), laid out as Apple Books' settings are: one
  centred column of grouped inset lists, each group with a small header above
  it and an explaining line below, each row its name on the left and its
  control on the right, every control the same width (decision 0039). It
  fills the list and reading areas while the sidebar stays, so the reader
  never loses their place. "Close settings" or
  Escape goes back. Reading (the reading mode and the sort order) is shared across the reader's
  devices; the reader controls belong to this device. Your data imports and
  exports the reader's feeds and folders as an OPML file, and exports their
  starred articles as a JSON Feed file. Other apps makes the app password
  other feed readers sync with (OtherApps).
-->
<script lang="ts">
  import { edge } from "./edge";
  import Icon from "./Icon.svelte";
  import ImportOpml from "./ImportOpml.svelte";
  import OtherApps from "./OtherApps.svelte";
  import PageHead from "./PageHead.svelte";
  import TextSize from "./TextSize.svelte";
  import { APPEARANCES, LOOKS, THEMES } from "./themes";
  import type { Order, ReadingMode } from "./feeds";
  import { LINE_WIDTHS, READING_FONTS, type Preferences } from "./preferences";
  import { signOut } from "./session";
  import { updates } from "./updates.svelte";

  let {
    preferences = $bindable(),
    sort,
    onSort,
    mode,
    onMode,
    heading = $bindable(),
    dataHeading = $bindable(),
    version,
    onSignedOut,
    onClose,
    onImported,
    onFeedHealth,
    besideToggle = false,
  }: {
    preferences: Preferences;
    /** Newest or oldest first; unknown until the server answers. */
    sort: Order | undefined;
    /** Saves a new sort order; fails if it couldn't be saved. */
    onSort: (sort: Order) => Promise<void>;
    /** Inbox or river (SPEC section 10). */
    mode: ReadingMode;
    /** Saves a new reading mode; fails if it couldn't be saved. */
    onMode: (mode: ReadingMode) => Promise<void>;
    heading?: HTMLHeadingElement;
    /** "Your data", where the empty state's "Import OPML" leads. */
    dataHeading?: HTMLHeadingElement;
    version: string;
    onSignedOut: () => void;
    onClose: () => void;
    /** Feeds were imported: the sidebar loads them. */
    onImported: () => void;
    /** Opens the feed health page. */
    onFeedHealth: (event: MouseEvent) => void;
    /** The sidebar is hidden, so the top line starts clear of its toggle. */
    besideToggle?: boolean;
  } = $props();

  const SORT_CHOICES = [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
  ] as const;

  const MODE_CHOICES = [
    { value: "inbox", label: "Inbox" },
    { value: "river", label: "River" },
  ] as const;

  let message = $state("");
  let sortMessage = $state("");
  /** What the last OPML import did, in plain words. */
  let importLines: string[] = $state([]);

  async function chooseMode(next: ReadingMode) {
    sortMessage = "";
    try {
      await onMode(next);
    } catch {
      sortMessage = "The reading mode couldn't be saved. Try again in a moment.";
    }
  }

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
          <!-- All's own sign, on purpose: river mode is everything, flowing past, and opens on All. -->
          <fieldset class="inset-row">
            <legend class="row-name"><span class="inline-flex items-center gap-2"><span class="text-muted"><Icon name="stack" size={16} /></span>Reading mode</span></legend>
            <div class="choices control" style="--columns: 2">
              {#each MODE_CHOICES as choice (choice.value)}
                <label class="choice">
                  <input
                    type="radio"
                    name="mode"
                    value={choice.value}
                    checked={mode === choice.value}
                    disabled={sort === undefined}
                    onchange={() => chooseMode(choice.value)}
                  />
                  {choice.label}
                </label>
              {/each}
            </div>
          </fieldset>
          <fieldset class="inset-row">
            <legend class="row-name"><span class="inline-flex items-center gap-2"><span class="text-muted"><Icon name="sort" size={16} /></span>Sort order</span></legend>
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
        <p class="inset-foot">
          Inbox keeps an Unread list and counts what's waiting. River lets everything flow past: no Unread, no counts. These
          apply on all your devices.
        </p>
        <p role="status" class={["inset-foot text-danger", !sortMessage && "sr-only"]}>{sortMessage}</p>
      </section>

      <section aria-labelledby="reader-heading">
        <h3 id="reader-heading" class="inset-head">Look and feel</h3>
        <div class="inset-group">
          <!--
            A short passage set as articles will be, the group's first row, before
            the controls, as Apple Books keeps its sample inside the themes panel:
            its words start on the rows' words, 16px in, and a hairline parts it
            from Appearance below (decision 0055). A row, never a card inside a card.
          -->
          <figure class="inset-row reading-sample" style:--sample-share={`${(LINE_WIDTHS[preferences.lineWidth].ch / LINE_WIDTHS.wide.ch) * 100}%`}>
            <figcaption class="sr-only">Preview</figcaption>
            <p>
              Most writing on the open web was never meant to be skimmed. It was written slowly, by someone who
              cared, for whoever would read it to the end. A reader can be built the same way: it shows you what is
              there, and then it lets you go.
            </p>
          </figure>
          <!-- Day, night or as the device is set: the theme's day or night version (decision 0056). -->
          <fieldset class="inset-row">
            <legend class="row-name">Appearance</legend>
            <div class="choices control" style="--columns: 3">
              {#each APPEARANCES as choice (choice.value)}
                <label class="choice">
                  <input type="radio" name="appearance" value={choice.value} bind:group={preferences.appearance} />
                  {choice.label}
                </label>
              {/each}
            </div>
          </fieldset>

          <!-- Original, or Plain: rohit.onl's bare look (decision 0063). -->
          <fieldset class="inset-row">
            <legend class="row-name">Theme</legend>
            <div class="choices control" style="--columns: 2">
              {#each THEMES as theme (theme)}
                <label class="choice">
                  <input type="radio" name="theme" value={theme} bind:group={preferences.theme} />
                  {LOOKS[theme].label}
                </label>
              {/each}
            </div>
          </fieldset>

          <fieldset class="inset-row">
            <legend class="row-name">Reading font</legend>
            <div class="choices control" style="--columns: 3">
              {#each Object.entries(READING_FONTS) as [value, font] (value)}
                <!-- Each name is set in its own font, so the choice shows itself. -->
                <label class="choice" style:font-family={font.family}>
                  <input type="radio" name="reading-font" {value} bind:group={preferences.readingFont} />
                  {font.label}{#if font.rest}<span class="sr-only">{font.rest}</span>{/if}
                </label>
              {/each}
            </div>
          </fieldset>

          <div class="inset-row">
            <p id="text-size-name" class="row-name">Text size</p>
            <!-- A flat "A | step | A" capsule: a small A and a large A at its ends, the current step between them as plain words, parted by hairlines (decisions 0045, 0055). -->
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
          These apply to this device only. Match device switches between the day and night versions as the
          device does. The Aa button above an article changes these too, while you read.
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

      <section aria-labelledby="feeds-heading">
        <h3 id="feeds-heading" class="inset-head">Feeds</h3>
        <div class="inset-group">
          <a href="/settings/feed-health" onclick={onFeedHealth} class="inset-row inset-action"
            >Feed health<span class="row-glyph"><Icon name="chevron-right" size={18} /></span></a
          >
        </div>
        <p class="inset-foot">Feeds that have stopped working, what went wrong, and what you can do about it.</p>
      </section>

      <OtherApps />

      <section aria-labelledby="account-heading">
        <h3 id="account-heading" class="inset-head">Account</h3>
        <div class="inset-group">
          {#if updates.ready}
            <!-- Never swapped while you read: the new version starts when you reload, or next time you open nine turtles. -->
            <div class="inset-row">
              <p>A new version is ready.</p>
              <button type="button" onclick={() => location.reload()} class="btn btn-small">Reload</button>
            </div>
          {/if}
          <!--
            In the text color, not the destructive red: signing out removes
            nothing, and red in nine turtles means something goes (decision 0042).
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
  /* The group's first row: a passage set as articles will be, 16px in on every side, its left edge on the rows' words. */
  .reading-sample {
    display: block;
    margin: 0;
    padding: 1rem;
    font-family: var(--reading-font);
    font-size: var(--reading-size);
    font-weight: 400;
    line-height: 1.6;
  }
  /*
    The sample's row is narrower than any line width, so the true measure would never show here.
    Its lines take the same share of the row as the chosen width is of Wide, so Narrow, Medium and
    Wide visibly differ.
  */
  .reading-sample p {
    max-width: min(var(--reading-measure), var(--sample-share, 100%));
  }
  /* On a phone articles read a tenth smaller; so does the sample. */
  @media (max-width: 40rem) {
    .reading-sample {
      font-size: calc(var(--reading-size) * 0.9);
    }
  }
</style>
