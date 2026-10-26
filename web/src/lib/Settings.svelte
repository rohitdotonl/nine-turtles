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
  starred articles as a JSON Feed file. Rules lists the reader's rules, and
  opens the rule editor over Settings (SPEC section 27). Newsletters, while
  nine turtles takes them, shows the reader's private address (SPEC section
  28). Other apps makes the
  app password other feed readers sync with (OtherApps). Readers, for the
  owner only, lists who has an account, sets the owner's email and the
  sign-up switch (Readers, decision 0087). Your plan, for everyone else
  while nine turtles takes payments, shows their trial or plan (Plan,
  decision 0094). Account shows the reader's email,
  with Change… while nine turtles can send email, Sign out, and for every
  reader but the owner Delete account… (ChangeEmail, DeleteAccount,
  decision 0088).
-->
<script lang="ts">
  import { edge } from "./edge";
  import ChangeEmail from "./ChangeEmail.svelte";
  import DeleteAccount from "./DeleteAccount.svelte";
  import Icon from "./Icon.svelte";
  import ImportOpml from "./ImportOpml.svelte";
  import Newsletters from "./Newsletters.svelte";
  import OtherApps from "./OtherApps.svelte";
  import Plan from "./Plan.svelte";
  import Readers from "./Readers.svelte";
  import RuleEditor from "./RuleEditor.svelte";
  import Rules from "./Rules.svelte";
  import type { Rule } from "./rules";
  import PageHead from "./PageHead.svelte";
  import TextSize from "./TextSize.svelte";
  import { APPEARANCES, LOOKS, THEMES } from "./themes";
  import type { Counts, Feed, Folder, LetGo, Order, ReadingMode } from "./feeds";
  import { LINE_WIDTHS, READING_FONTS, type Preferences } from "./preferences";
  import { signOut } from "./session";
  import { updates } from "./updates.svelte";
  import { connection } from "./connection.svelte";
  import { SETTINGS_NEED_CONNECTION, keeping, setKeeping } from "./offline";

  let {
    preferences = $bindable(),
    sort,
    onSort,
    mode,
    onMode,
    counts,
    onCounts,
    letGo,
    onLetGo,
    heading = $bindable(),
    dataHeading = $bindable(),
    version,
    owner = false,
    email = null,
    emailSending = false,
    onSignedOut,
    onClose,
    onImported,
    onFeedHealth,
    onYourFeeds,
    onMuted,
    onReaders,
    feeds,
    folders,
    phone = false,
    ruleForFeed = $bindable(),
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
    /** Whether the sidebar shows unread counts (decision 0097). */
    counts: Counts;
    onCounts: (counts: Counts) => Promise<void>;
    /** When unread lets go by itself (decision 0097); unknown until the server answers. */
    letGo: LetGo | undefined;
    onLetGo: (letGo: LetGo) => Promise<void>;
    heading?: HTMLHeadingElement;
    /** "Your data", where the empty state's "Import OPML" leads. */
    dataHeading?: HTMLHeadingElement;
    version: string;
    /** Only the owner sees Readers. */
    owner?: boolean;
    /** The email this reader signs in with, if any. */
    email?: string | null;
    /** nine turtles can send email, so the email can be changed here. */
    emailSending?: boolean;
    onSignedOut: () => void;
    onClose: () => void;
    /** Feeds were imported: the sidebar loads them. */
    onImported: () => void;
    /** Opens the feed health page. */
    onFeedHealth: (event: MouseEvent) => void;
    /** Opens Your feeds. */
    onYourFeeds: (event: MouseEvent) => void;
    /** Opens the Muted articles page. */
    onMuted: (event: MouseEvent) => void;
    /** Opens the owner's Readers page. */
    onReaders: (event: MouseEvent) => void;
    feeds: Feed[];
    folders: Folder[];
    /** On a phone the rule editor is the phone sheet, in place of Settings. */
    phone?: boolean;
    /** A new rule for this feed opens at once (Edit feed's "Add a rule for this feed…"). */
    ruleForFeed?: number;
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

  const COUNT_CHOICES = [
    { value: "shown", label: "Show" },
    { value: "hidden", label: "Hide" },
  ] as const;

  const LET_GO_CHOICES = [
    { value: "never", label: "Never" },
    { value: "week", label: "1 week" },
    { value: "two-weeks", label: "2 weeks" },
    { value: "month", label: "1 month" },
  ] as const;

  /** The rule editor, while open: a rule to change, or a new one (perhaps for a feed). */
  let editing: { rule?: Rule; feedId?: number } | undefined = $state();
  let rulesPanel: Rules | undefined = $state();
  /** What the editor did, for Rules to say once it's showing (on a phone it comes back as the editor closes). */
  let pending: (() => void) | undefined;
  let ruleHeading: HTMLHeadingElement | undefined = $state();

  $effect(() => {
    if (ruleForFeed !== undefined) {
      openEditor({ feedId: ruleForFeed });
      ruleForFeed = undefined;
    }
  });

  /** Closing the editor: on a phone, Settings comes back, and the keyboard returns to Rules. */
  /**
   * On a phone the editor is a screen of its own, so it's a step in history:
   * the back gesture closes it, unchanged, rather than leaving Settings.
   */
  let stepped = false;
  function openEditor(next: { rule?: Rule; feedId?: number }) {
    editing = next;
    if (phone && !stepped) {
      history.pushState(history.state, "", location.href);
      stepped = true;
    }
  }

  /** The back gesture (or Back) while the editor's step is showing: it closes, unchanged. */
  function backed() {
    if (!stepped) return;
    stepped = false;
    closeEditor();
  }

  function closeEditor() {
    if (stepped) {
      // Closed by its X, Save or Delete: its step in history goes too.
      stepped = false;
      history.back();
    }
    editing = undefined;
    queueMicrotask(() => {
      document.getElementById("rules-heading")?.focus();
      const doing = pending;
      pending = undefined;
      doing?.();
    });
  }

  /** Change email or Delete account, while open: a sheet over Settings, or on a phone a screen in its place. */
  let task: "email" | "delete" | undefined = $state();
  let taskHeading: HTMLHeadingElement | undefined = $state();
  let changeButton: HTMLButtonElement | undefined = $state();
  let deleteButton: HTMLButtonElement | undefined = $state();
  /** What Change email did, said under Account. */
  let accountNote = $state("");

  function closeTask() {
    const from = task === "email" ? changeButton : deleteButton;
    task = undefined;
    queueMicrotask(() => from?.focus());
  }

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

  async function chooseCounts(next: Counts) {
    sortMessage = "";
    try {
      await onCounts(next);
    } catch {
      sortMessage = "That couldn't be saved. Try again in a moment.";
    }
  }

  async function chooseLetGo(next: LetGo) {
    sortMessage = "";
    try {
      await onLetGo(next);
    } catch {
      sortMessage = "That couldn't be saved. Try again in a moment.";
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

  /** Whether this device keeps articles for reading offline (SPEC section 30): on unless switched off here. */
  let keepingOffline = $state(keeping());

  function switchKeeping(on: boolean) {
    keepingOffline = on;
    void setKeeping(on);
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

<svelte:window onpopstate={backed} />

{#if editing}
  {#key editing}
    <RuleEditor
      sheet={!phone}
      rule={editing.rule}
      feedId={editing.feedId}
      {feeds}
      {folders}
      bind:heading={ruleHeading}
      onCancel={closeEditor}
      onSaved={(draft, made) => {
        pending = () => rulesPanel?.saved(draft, made);
        closeEditor();
      }}
      onDelete={(rule) => {
        pending = () => rulesPanel?.remove(rule);
        closeEditor();
      }}
    />
  {/key}
{/if}
{#if task === "email"}
  <ChangeEmail
    sheet={!phone}
    {besideToggle}
    bind:heading={taskHeading}
    onCancel={closeTask}
    onSent={(note) => {
      accountNote = note;
      closeTask();
    }}
  />
{:else if task === "delete"}
  <DeleteAccount sheet={!phone} {besideToggle} bind:heading={taskHeading} onCancel={closeTask} onDeleted={onSignedOut} />
{/if}
{#if !(editing && phone) && !(task && phone)}
<section aria-labelledby="settings-heading" class="flex flex-1 flex-col bg-paper">
  <PageHead title="Settings" id="settings-heading" bind:heading {onClose} closeLabel="Close settings" {besideToggle} column="max-w-[35rem]" />
  <div use:edge class="scroller relative min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-16 md:px-10">
    <div class="mx-auto flex max-w-[35rem] flex-col gap-8">
      {#if connection.offline}
        <!-- Without a connection nothing here could be saved, so Settings says so and waits (SPEC section 30). -->
        <p role="status">{SETTINGS_NEED_CONNECTION}</p>
      {:else}
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
          {#if mode === "inbox"}
            <fieldset class="inset-row">
              <legend class="row-name"><span class="inline-flex items-center gap-2"><span class="text-muted"><Icon name="dot" size={16} /></span>Unread counts</span></legend>
              <div class="choices control" style="--columns: 2">
                {#each COUNT_CHOICES as choice (choice.value)}
                  <label class="choice">
                    <input
                      type="radio"
                      name="counts"
                      value={choice.value}
                      checked={counts === choice.value}
                      disabled={sort === undefined}
                      onchange={() => chooseCounts(choice.value)}
                    />
                    {choice.label}
                  </label>
                {/each}
              </div>
            </fieldset>
            <fieldset class="inset-row">
              <legend class="row-name"><span class="inline-flex items-center gap-2"><span class="text-muted"><Icon name="clock" size={16} /></span>Let unread go after</span></legend>
              <div class="choices control" style="--columns: 4">
                {#each LET_GO_CHOICES as choice (choice.value)}
                  <label class="choice">
                    <input
                      type="radio"
                      name="let-go"
                      value={choice.value}
                      checked={letGo === choice.value}
                      disabled={letGo === undefined}
                      onchange={() => chooseLetGo(choice.value)}
                    />
                    {choice.label}
                  </label>
                {/each}
              </div>
            </fieldset>
          {/if}
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
          Inbox keeps an Unread list and counts what's waiting. River lets everything flow past: no Unread, no counts.
          {#if mode === "inbox"}Hide the counts to keep Unread without the numbers. Unread you haven't got to lets go after the
            time you choose, a minute or so after you choose it: it counts as read and stays in its feed, All and search.{/if} These apply on all your devices.
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
          <!-- A switch, as Apple draws one (decision 0077): this device's copies for reading offline. -->
          <div class="inset-row">
            <p id="keep-offline-name" class="row-name">Keep articles for reading offline</p>
            <label class="switch-target -my-2 -mr-2" title={keepingOffline ? "On: press to stop keeping them and delete them" : "Off: press to keep them"}>
              <input
                type="checkbox"
                role="switch"
                class="switch"
                aria-labelledby="keep-offline-name"
                aria-describedby="keep-offline-foot"
                checked={keepingOffline}
                onchange={(event) => switchKeeping(event.currentTarget.checked)}
              />
            </label>
          </div>
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
        <p id="keep-offline-foot" class="inset-foot">
          On this device only: the words of your first 200 unread and newest 200 starred articles, without images, so
          you can read, mark and star them without a connection. Signing out deletes them.
        </p>
        <p class="inset-foot">
          OPML is the file feed readers use to move your feeds and folders between apps; export one now and then, and
          keep it somewhere safe. Starred articles are saved as a JSON Feed file, which other feed readers can open,
          with each article's text, its original link and the feed it came from.
        </p>
      </section>

      <section aria-labelledby="feeds-heading">
        <h3 id="feeds-heading" class="inset-head">Feeds</h3>
        <div class="inset-group">
          <a href="/settings/feeds" onclick={onYourFeeds} class="inset-row inset-action"
            >Your feeds<span class="row-glyph"><Icon name="chevron-right" size={18} /></span></a
          >
          <a href="/settings/feed-health" onclick={onFeedHealth} class="inset-row inset-action"
            >Feed health<span class="row-glyph"><Icon name="chevron-right" size={18} /></span></a
          >
        </div>
        <p class="inset-foot">
          Your feeds lists every feed with when it last posted, finds the quiet ones, and moves or unsubscribes from
          several at once. Feed health shows feeds that have stopped working, and what you can do about it.
        </p>
      </section>

      <Rules
        bind:this={rulesPanel}
        {feeds}
        {folders}
        {onMuted}
        onNew={() => openEditor({})}
        onEdit={(rule) => openEditor({ rule })}
      />

      <Newsletters />

      <OtherApps />

      {#if owner}
        <Readers {email} {onReaders} />
      {:else}
        <Plan />
      {/if}

      <section aria-labelledby="account-heading">
        <h3 id="account-heading" class="inset-head">Account</h3>
        <div class="inset-group">
          {#if updates.ready}
            <!-- Never swapped while you read: the new version starts when you reload, go to another place, or next time you open nine turtles. -->
            <div class="inset-row">
              <p>A new version is ready.</p>
              <button type="button" onclick={() => location.reload()} class="btn btn-small">Reload</button>
            </div>
          {/if}
          <!-- The email this reader signs in with; changing it sends a link to the new one (decision 0088). -->
          <div class="inset-row">
            <p class="min-w-0">Email<br /><span class="value text-muted">{email ?? "No email yet"}</span></p>
            {#if emailSending && email}
              <button bind:this={changeButton} type="button" onclick={() => (task = "email")} class="btn btn-small"
                >Change…<span class="sr-only"> email</span></button
              >
            {/if}
          </div>
          <!--
            In the text color, not the destructive red: signing out removes
            nothing, and red in nine turtles means something goes (decision 0042).
            Its trailing door says it acts, as the rows above do.
          -->
          <button type="button" onclick={leave} class="inset-row inset-action"
            >Sign out<span class="row-glyph"><Icon name="sign-out" size={18} /></span></button
          >
          {#if !owner}
            <!-- Red words: this removes something. What it removes is said in the sheet it opens, before anything goes. -->
            <button bind:this={deleteButton} type="button" onclick={() => (task = "delete")} class="inset-row inset-action text-danger font-semibold"
              >Delete account…</button
            >
          {/if}
        </div>
        <p role="status" class={["inset-foot text-ink", !accountNote && "sr-only"]}>{accountNote}</p>
        <p role="status" class={["inset-foot text-danger", !message && "sr-only"]}>{message}</p>
        {#if email && !emailSending}
          <p class="inset-foot">Changing your email needs nine turtles to send email; whoever runs it can set that up.</p>
        {/if}
        {#if !owner}
          <!-- Readers are told what the owner's Readers page shows of them (decision 0093). -->
          <p class="inset-foot">
            Whoever runs this nine turtles can see your email, when you joined, how many feeds you follow, the day
            you were last here and, once there are plans, which plan you're on. Never which feeds or what you read.
          </p>
        {/if}
        <p class="inset-foot" translate="no">Version {version}</p>
      </section>
      {/if}
    </div>
  </div>
</section>
{/if}

<style>
  /* A row's name, on its left. EditFeed.svelte's settings rows copy these; keep the two alike. A fieldset's legend floats so it sits in the row like any other child. */
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
  .value {
    font-size: var(--text-meta);
    overflow-wrap: anywhere;
  }
  /* On a phone articles read a tenth smaller; so does the sample. */
  @media (max-width: 40rem) {
    .reading-sample {
      font-size: calc(var(--reading-size) * 0.9);
    }
  }
</style>
