<!--
  Settings (SPEC section 18), laid out as Apple Books' settings are: one
  centred column of grouped inset lists, each group with a small uppercase
  header above it (decision 0120). It fills the list and reading areas while
  the sidebar stays, so the reader never loses their place. "Close settings"
  or Escape goes back.

  Its first page keeps only the everyday settings (decision 0120): Reading
  (reading mode, unread counts, letting unread go, sort order, shared across
  the reader's devices) and Look and feel (Appearance and Text size, for this
  device). Everything else is a row ending in › that opens a page of its own
  in place of Settings, at /settings/<page> (`page`), with "‹ Settings" above
  its title; Escape goes back too, and the keyboard returns to the row:
  Font, theme and line width; Your library (Your feeds and Feed health,
  pages of their own, then Show in the sidebar and Your data); More
  (Keyboard on a screen with keys, Add from anywhere, Rules, Newsletters
  while nine turtles takes them, Other apps, Connected assistants, Passkeys
  where they work); Your nine turtles (Readers, the owner only); and Account
  (Your plan while nine turtles takes payments, Email with Change…, Sign
  out, Delete data… and, for everyone but the owner, Delete account…).

  Each row on the first page has its icon at the left, in the muted grey,
  lined up with the first line of its name, and a setting's description
  sits straight under its name (S1, decision 0120).

  The groups' own components: AddAnywhere (decision 0104), Rules and the
  rule editor (SPEC section 27), Newsletters (SPEC section 28), OtherApps
  (SPEC section 26), Assistants (SPEC section 33), Readers (decision 0087),
  Plan (decision 0094), Passkeys (decision 0109), ChangeEmail and
  DeleteAccount (decisions 0088 and 0117).
-->
<script lang="ts">
  import { edge } from "./edge";
  import AddAnywhere from "./AddAnywhere.svelte";
  import ChangeEmail from "./ChangeEmail.svelte";
  import DeleteAccount from "./DeleteAccount.svelte";
  import Icon, { type IconName } from "./Icon.svelte";
  import ImportOpml from "./ImportOpml.svelte";
  import ImportStars from "./ImportStars.svelte";
  import Newsletters from "./Newsletters.svelte";
  import OtherApps from "./OtherApps.svelte";
  import Assistants from "./Assistants.svelte";
  import PasskeysGroup from "./Passkeys.svelte";
  import Plan from "./Plan.svelte";
  import Readers from "./Readers.svelte";
  import RuleEditor from "./RuleEditor.svelte";
  import Rules from "./Rules.svelte";
  import type { Rule } from "./rules";
  import PageHead from "./PageHead.svelte";
  import TextSize from "./TextSize.svelte";
  import { APPEARANCES, LOOKS, THEMES } from "./themes";
  import type { Feed, Folder } from "./shapes";
  import type { Counts, LetGo, Order, ReadingMode } from "./reading";
  import { SETTINGS_PAGES, type Hideable, type SettingsPage } from "./router";
  import { LINE_WIDTHS, READING_FONTS, type Preferences } from "./preferences";
  import { signOut } from "./session";
  import { updates } from "./updates.svelte";
  import { connection } from "./connection.svelte";
  import { SETTINGS_NEED_CONNECTION, keeping, sendWaiting, setKeeping } from "./offline";
  import { newslettersStatus } from "./newsletters";
  import { browserHasPasskeys, passkeysHere } from "./passkeys";
  import { describe, loadPlan } from "./plan";

  let {
    page = undefined,
    preferences = $bindable(),
    sort,
    onSort,
    mode,
    onMode,
    counts,
    onCounts,
    letGo,
    onLetGo,
    hidden,
    onHidden,
    heading = $bindable(),
    version,
    owner = false,
    email = null,
    emailSending = false,
    passkeys = null,
    onSignedOut,
    onClose,
    onOpen,
    onBack,
    onImported,
    onFeedHealth,
    onYourFeeds,
    onKeys,
    onMuted,
    onReaders,
    feeds,
    folders,
    phone = false,
    ruleForFeed = $bindable(),
    besideToggle = false,
  }: {
    /** One of Settings' own pages, or Settings itself (decision 0120). */
    page?: SettingsPage;
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
    /** The lists the sidebar leaves out (decision 0105). */
    hidden: Hideable[];
    onHidden: (hidden: Hideable[]) => Promise<void>;
    heading?: HTMLHeadingElement;
    version: string;
    /** Only the owner sees Readers. */
    owner?: boolean;
    /** The email this reader signs in with, if any. */
    email?: string | null;
    /** nine turtles can send email, so the email can be changed here. */
    emailSending?: boolean;
    /** Where passkeys work, for Passkeys (decision 0109); null when they're off. */
    passkeys?: string | null;
    onSignedOut: () => void;
    onClose: () => void;
    /** Opens one of Settings' own pages. */
    onOpen: (event: MouseEvent, page: SettingsPage) => void;
    /** "‹ Settings": back from one of its pages. */
    onBack: () => void;
    /** Feeds were imported: the sidebar loads them. */
    onImported: () => void;
    /** Opens the feed health page. */
    onFeedHealth: (event: MouseEvent) => void;
    /** Opens Your feeds. */
    onYourFeeds: (event: MouseEvent) => void;
    /** Opens the shortcut list, ready to change keys (decision 0110). */
    onKeys: () => void;
    /** Opens the Muted articles page. */
    onMuted: (event: MouseEvent) => void;
    /** Opens the owner's All readers page. */
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

  /** The lists the sidebar can leave out, as its rows name them. Unread, folders and feeds always show. */
  const SIDEBAR_LISTS: { value: Hideable; label: string }[] = [
    { value: "starred", label: "Starred" },
    { value: "all", label: "All" },
    { value: "recent", label: "Recently read" },
    { value: "searches", label: "Saved searches" },
    { value: "collections", label: "Collections" },
    // Shown only while it holds an episode, unless unticked here (decision 0113).
    { value: "upnext", label: "Up Next" },
  ];

  let sidebarMessage = $state("");

  async function showInSidebar(list: Hideable, box: HTMLInputElement) {
    sidebarMessage = "";
    const shown = box.checked;
    const next = shown ? hidden.filter((each) => each !== list) : [...hidden, list];
    try {
      await onHidden(next);
    } catch {
      // Back as it was, tick box included.
      box.checked = !shown;
      sidebarMessage = "That couldn't be saved. Try again in a moment.";
    }
  }

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

  /** Closing the editor: on a phone, Settings comes back, and the keyboard returns to Rules. */
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

  /** Change email, Delete data or Delete account, while open: a sheet over Settings, or on a phone a screen in its place. */
  let task: "email" | "data" | "delete" | undefined = $state();
  let taskHeading: HTMLHeadingElement | undefined = $state();
  let changeButton: HTMLButtonElement | undefined = $state();
  let deleteButton: HTMLButtonElement | undefined = $state();
  let dataButton: HTMLButtonElement | undefined = $state();
  /** What Change email did, said under Account. */
  let accountNote = $state("");

  function closeTask() {
    const from = task === "email" ? changeButton : task === "data" ? dataButton : deleteButton;
    task = undefined;
    queueMicrotask(() => from?.focus());
  }

  let message = $state("");
  let sortMessage = $state("");
  /** What the last import (OPML or starred articles) did, in plain words. */
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

  /** Whether this device keeps articles for reading offline (SPEC section 32): on unless switched off here. */
  let keepingOffline = $state(keeping());

  function switchKeeping(on: boolean) {
    keepingOffline = on;
    void setKeeping(on);
  }

  async function leave() {
    try {
      // Marks made offline go first: signing out deletes this device's copies (SPEC section 32).
      await sendWaiting();
      await signOut();
      onSignedOut();
    } catch {
      message = "Couldn't sign out. Try again in a moment.";
    }
  }

  /** Newsletters' row shows only while nine turtles takes them (SPEC section 28). */
  let newslettersOn = $state(false);
  newslettersStatus().then(
    (status) => (newslettersOn = status.on),
    () => {
      // Hidden until the server answers.
    },
  );

  /** Your plan's row shows only while nine turtles takes payments, never to the owner (SPEC section 29): what it says now. */
  let planStanding: string | undefined = $state();
  loadPlan().then(
    (status) => (planStanding = status.on && status.plan.standing !== "free" ? describe(status.plan).title : undefined),
    () => {
      // Hidden until the server answers.
    },
  );
  const planNow = $derived(owner ? undefined : planStanding);

  const passkeysShown = $derived(passkeysHere(passkeys, location, browserHasPasskeys()));

  function open(next: SettingsPage) {
    return (event: MouseEvent) => onOpen(event, next);
  }
</script>

<svelte:window onpopstate={backed} />

<!-- What a screen reader hears after each row's name that opens a page of its own. -->
<span id="opens-page" hidden>Opens its own page.</span>

{#snippet icon(name: IconName)}
  <span class="setting-icon" aria-hidden="true"><Icon {name} size={18} /></span>
{/snippet}

<!-- A row that opens a page of its own (decision 0120): its icon, its name, perhaps what it's set to, then ›. -->
{#snippet pageRow(key: string, href: string, label: string, name: IconName, onclick: (event: MouseEvent) => void, value?: string, extra?: string)}
  <a {href} {onclick} data-settings-row={key} aria-describedby="opens-page" class={["inset-row inset-action setting", extra]}>
    <span class="setting-label">{@render icon(name)}<span class="setting-words"><span class="setting-name">{label}</span></span></span>
    <span class="row-glyph flex items-center gap-2"
      >{#if value}<span class="setting-value">{value}</span>{/if}<Icon name="chevron-right" size={18} /></span
    >
  </a>
{/snippet}

{#snippet keepSwitch()}
  <!-- A switch, as Apple draws one (decision 0077): this device's copies for reading offline. -->
  <div class="inset-row setting">
    <p class="setting-name" aria-hidden="true">Keep articles for reading offline</p>
    <label class="switch-target -my-2 -mr-2">
      <input
        type="checkbox"
        role="switch"
        class="switch"
        aria-label="Keep articles for reading offline"
        aria-describedby="keep-offline-foot"
        checked={keepingOffline}
        onchange={(event) => switchKeeping(event.currentTarget.checked)}
      />
    </label>
  </div>
{/snippet}

{#snippet keepFoot()}
  <p id="keep-offline-foot" class="inset-foot">
    On this device only: the words of your first 200 unread and newest 200 starred articles, without images, so
    you can read, mark and star them without a connection. Switching this off, or signing out, deletes them.
  </p>
{/snippet}

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
{:else if task === "data"}
  <DeleteAccount data sheet={!phone} {besideToggle} bind:heading={taskHeading} onCancel={closeTask} onDeleted={closeTask} />
{:else if task === "delete"}
  <DeleteAccount sheet={!phone} {besideToggle} bind:heading={taskHeading} onCancel={closeTask} onDeleted={onSignedOut} />
{/if}
{#if !(editing && phone) && !(task && phone)}
<!-- On one of its pages, the page itself is the region named after it, inside Settings. -->
<section aria-labelledby={page ? undefined : "settings-heading"} aria-label={page ? "Settings" : undefined} class="flex flex-1 flex-col bg-paper">
  {#if page}
    <PageHead title={SETTINGS_PAGES[page]} id="settings-heading" bind:heading onBack={onBack} backTo="Settings" {besideToggle} column="max-w-[35rem]" />
  {:else}
    <PageHead title="Settings" id="settings-heading" bind:heading {onClose} closeLabel="Close settings" {besideToggle} column="max-w-[35rem]" />
  {/if}
  {#key page}
  <div use:edge class="scroller relative min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-16 md:px-10">
    <div class={["mx-auto flex max-w-[35rem] flex-col gap-8", page && "settings-page"]}>
      {#if connection.offline}
        <!-- Without a connection nothing here could be saved, so Settings says so and waits (SPEC section 32). -->
        <p role="status">{SETTINGS_NEED_CONNECTION}</p>
        {#if !page || page === "data"}
          <!-- The one setting that needs no connection: this device's own copies, which switching off deletes. -->
          <section aria-label="Reading offline">
            <div class="inset-group">
              {@render keepSwitch()}
            </div>
            {@render keepFoot()}
          </section>
        {/if}
      {:else if !page}
      <section aria-labelledby="reading-heading">
        <h3 id="reading-heading" class="settings-head">Reading</h3>
        <div class="inset-group">
          <div class="inset-row setting has-control">
            <div class="setting-label">
              {@render icon("book")}
              <div class="setting-words">
                <p id="mode-name" class="setting-name">Reading mode</p>
                <p id="mode-hint" class="setting-hint">
                  {mode === "inbox" ? "An Unread list, with counts of what's waiting." : "Everything flows past. No Unread list, no counts."}
                </p>
              </div>
            </div>
            <div role="group" aria-labelledby="mode-name" aria-describedby="mode-hint" class="choices setting-control" style="--columns: 2">
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
          </div>
          <!-- River mode has no Unread, so these two step aside there. -->
          {#if mode === "inbox"}
            <div class="inset-row setting has-control">
              <div class="setting-label">
                {@render icon("nine-circle")}
                <div class="setting-words">
                  <p id="counts-name" class="setting-name">Unread counts</p>
                  <p id="counts-hint" class="setting-hint">Hide keeps Unread, without the numbers.</p>
                </div>
              </div>
              <div role="group" aria-labelledby="counts-name" aria-describedby="counts-hint" class="choices setting-control" style="--columns: 2">
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
            </div>
            <div class="inset-row setting has-control">
              <div class="setting-label">
                {@render icon("clock")}
                <div class="setting-words">
                  <p id="let-go-name" class="setting-name">Let unread go after</p>
                  <p id="let-go-hint" class="setting-hint">
                    Older unread counts as read. It stays in its feed, All and search.
                  </p>
                </div>
              </div>
              <div role="group" aria-labelledby="let-go-name" aria-describedby="let-go-hint" class="choices setting-control" style="--columns: 4">
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
            </div>
          {/if}
          <div class="inset-row setting has-control">
            <div class="setting-label">
              {@render icon("sort")}
              <div class="setting-words">
                <p id="sort-name" class="setting-name">Sort order</p>
              </div>
            </div>
            <div role="group" aria-labelledby="sort-name" class="choices setting-control" style="--columns: 2">
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
          </div>
        </div>
        <p class="inset-foot">These apply on all your devices.</p>
        <p role="status" class={["inset-foot text-danger", !sortMessage && "sr-only"]}>{sortMessage}</p>
      </section>

      <section aria-labelledby="reader-heading">
        <h3 id="reader-heading" class="settings-head">Look and feel</h3>
        <div class="inset-group">
          <!-- Day, night or as the device is set: the theme's day or night version (decision 0056). -->
          <div class="inset-row setting has-control">
            <div class="setting-label">
              {@render icon("palette")}
              <div class="setting-words"><p id="appearance-name" class="setting-name">Appearance</p></div>
            </div>
            <div role="group" aria-labelledby="appearance-name" class="choices setting-control" style="--columns: 3">
              {#each APPEARANCES as choice (choice.value)}
                <label class="choice">
                  <input type="radio" name="appearance" value={choice.value} bind:group={preferences.appearance} />
                  {choice.label}
                </label>
              {/each}
            </div>
          </div>
          <div class="inset-row setting has-control">
            <div class="setting-label">
              {@render icon("a-plus")}
              <div class="setting-words"><p id="text-size-name" class="setting-name">Text size</p></div>
            </div>
            <!-- A flat "A | step | A" capsule: a small A and a large A at its ends, the current step between them as plain words, parted by hairlines (decisions 0045, 0055). -->
            <div class="setting-control">
              <TextSize bind:size={preferences.textSize} labelledby="text-size-name" />
            </div>
          </div>
          {@render pageRow("font", "/settings/font", SETTINGS_PAGES.font, "pen-nib", open("font"), READING_FONTS[preferences.readingFont].label)}
        </div>
        <!-- The same preferences as the Aa panel above an article (decision 0034). -->
        <p class="inset-foot">
          These apply to this device only. Match device switches between the day and night versions as the
          device does. The Aa button above an article changes these too, while you read.
        </p>
      </section>

      <section aria-labelledby="library-heading">
        <h3 id="library-heading" class="settings-head">Your library</h3>
        <div class="inset-group">
          {@render pageRow("feeds", "/settings/feeds", "Your feeds", "feed", onYourFeeds)}
          {@render pageRow("feed-health", "/settings/feed-health", "Feed health", "heart-pulse", onFeedHealth)}
          {@render pageRow("sidebar", "/settings/sidebar", SETTINGS_PAGES.sidebar, "panel-dots", open("sidebar"))}
          {@render pageRow("data", "/settings/data", SETTINGS_PAGES.data, "download", open("data"))}
        </div>
      </section>

      <section aria-labelledby="more-heading">
        <h3 id="more-heading" class="settings-head">More</h3>
        <div class="inset-group">
          <!-- Only on a screen with a keyboard: there's nothing to press on a touch screen (decision 0110). -->
          {@render pageRow("keyboard", "/settings/keyboard", SETTINGS_PAGES.keyboard, "keyboard", open("keyboard"), undefined, "keyboard-hint")}
          {@render pageRow("add-from-anywhere", "/settings/add-from-anywhere", SETTINGS_PAGES["add-from-anywhere"], "bookmark-plus", open("add-from-anywhere"))}
          {@render pageRow("rules", "/settings/rules", SETTINGS_PAGES.rules, "sliders", open("rules"))}
          {#if newslettersOn}
            {@render pageRow("newsletters", "/settings/newsletters", SETTINGS_PAGES.newsletters, "newspaper", open("newsletters"))}
          {/if}
          {@render pageRow("other-apps", "/settings/other-apps", SETTINGS_PAGES["other-apps"], "plug", open("other-apps"))}
          {@render pageRow("assistants", "/settings/assistants", SETTINGS_PAGES.assistants, "robot", open("assistants"))}
          {#if passkeysShown}
            {@render pageRow("passkeys", "/settings/passkeys", SETTINGS_PAGES.passkeys, "key", open("passkeys"))}
          {/if}
        </div>
      </section>

      {#if owner}
        <section aria-labelledby="yours-heading">
          <h3 id="yours-heading" class="settings-head">Your nine turtles<span class="sr-only">, </span><span class="only-you">Only you</span></h3>
          <div class="inset-group">
            {@render pageRow("readers", "/settings/readers", SETTINGS_PAGES.readers, "people", open("readers"))}
          </div>
        </section>
      {/if}

      <section aria-labelledby="account-heading">
        <h3 id="account-heading" class="settings-head">Account</h3>
        <div class="inset-group">
          {#if updates.ready}
            <!-- Never swapped while you read: the new version starts when you reload, go to another place, or next time you open nine turtles. -->
            <div class="inset-row setting">
              <span class="setting-label">{@render icon("refresh")}<span class="setting-name">A new version is ready.</span></span>
              <button type="button" onclick={() => location.reload()} class="btn btn-small">Reload</button>
            </div>
          {/if}
          {#if planNow}
            {@render pageRow("plan", "/settings/plan", SETTINGS_PAGES.plan, "card", open("plan"), planNow)}
          {/if}
          <!-- The email this reader signs in with; changing it sends a link to the new one (decision 0088). -->
          <div class="inset-row setting">
            <div class="setting-label">
              {@render icon("envelope")}
              <div class="setting-words">
                <p class="setting-name">Email</p>
                <p class="setting-hint">{email ?? "No email yet"}</p>
              </div>
            </div>
            {#if emailSending && email}
              <button bind:this={changeButton} type="button" onclick={() => (task = "email")} class="btn btn-small shrink-0"
                >Change…<span class="sr-only"> email</span></button
              >
            {/if}
          </div>
          <!--
            In the text color, not the destructive red: signing out removes
            nothing, and red in nine turtles means something goes (decision 0042).
          -->
          <button type="button" onclick={leave} class="inset-row inset-action setting"
            ><span class="setting-label">{@render icon("sign-out")}<span class="setting-name">Sign out</span></span></button
          >
          <!-- Red words: these remove something. What each removes is said in the sheet it opens, before anything goes. -->
          <button bind:this={dataButton} type="button" onclick={() => (task = "data")} class="inset-row inset-action setting"
            ><span class="setting-label">{@render icon("trash")}<span class="setting-name danger-name">Delete data…</span></span></button
          >
          {#if !owner}
            <button bind:this={deleteButton} type="button" onclick={() => (task = "delete")} class="inset-row inset-action setting"
              ><span class="setting-label">{@render icon("trash")}<span class="setting-name danger-name">Delete account…</span></span></button
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
      {:else if page === "font"}
      <section aria-labelledby="settings-heading">
        <div class="inset-group">
          <!--
            A short passage set as articles will be, the group's first row, before
            the controls, as Apple Books keeps its sample inside the themes panel:
            its words start on the rows' words, 16px in, and a hairline parts it
            from the rows below (decision 0055). A row, never a card inside a card.
          -->
          <figure class="inset-row reading-sample" style:--sample-share={`${(LINE_WIDTHS[preferences.lineWidth].ch / LINE_WIDTHS.wide.ch) * 100}%`}>
            <figcaption class="sr-only">Preview</figcaption>
            <p>
              Most writing on the open web was never meant to be skimmed. It was written slowly, by someone who
              cared, for whoever would read it to the end. A reader can be built the same way: it shows you what is
              there, and then it lets you go.
            </p>
          </figure>
          <!-- Original, or Plain: rohit.onl's bare look (decision 0063). -->
          <div class="inset-row setting has-control">
            <p id="theme-name" class="setting-name">Theme</p>
            <div role="group" aria-labelledby="theme-name" class="choices setting-control" style="--columns: 2">
              {#each THEMES as theme (theme)}
                <label class="choice">
                  <input type="radio" name="theme" value={theme} bind:group={preferences.theme} />
                  {LOOKS[theme].label}
                </label>
              {/each}
            </div>
          </div>
          <div class="inset-row setting has-control">
            <p id="reading-font-name" class="setting-name">Reading font</p>
            <div role="group" aria-labelledby="reading-font-name" class="choices setting-control" style="--columns: 3">
              {#each Object.entries(READING_FONTS) as [value, font] (value)}
                <!-- Each name is set in its own font, so the choice shows itself. -->
                <label class="choice" style:font-family={font.family}>
                  <input type="radio" name="reading-font" {value} bind:group={preferences.readingFont} />
                  {font.label}{#if font.rest}<span class="sr-only">{font.rest}</span>{/if}
                </label>
              {/each}
            </div>
          </div>
          <div class="inset-row setting has-control">
            <p id="line-width-name" class="setting-name">Line width</p>
            <div role="group" aria-labelledby="line-width-name" class="choices setting-control" style="--columns: 3">
              {#each Object.entries(LINE_WIDTHS) as [value, width] (value)}
                <label class="choice">
                  <input type="radio" name="line-width" {value} bind:group={preferences.lineWidth} />
                  {width.label}
                </label>
              {/each}
            </div>
          </div>
        </div>
        <p class="inset-foot">
          These apply to this device only. The Aa button above an article changes these too, while you read.
        </p>
      </section>
      {:else if page === "sidebar"}
      <!-- Which lists the sidebar shows (decision 0105): a tick box row each, as in Edit feed; shared across devices. -->
      <section aria-labelledby="settings-heading">
        <div class="inset-group" role="group" aria-labelledby="settings-heading" aria-describedby="sidebar-help">
          {#each SIDEBAR_LISTS as list (list.value)}
            <label class="inset-row check-row">
              <input
                type="checkbox"
                checked={!hidden.includes(list.value)}
                disabled={sort === undefined}
                onchange={(event) => showInSidebar(list.value, event.currentTarget)}
              />
              <span class="setting-name min-w-0">{list.label}</span>
              <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size={14} /></span>
            </label>
          {/each}
        </div>
        <p id="sidebar-help" class="inset-foot">
          Unread, your folders and your feeds always show{mode === "river" ? ", and so does All in river mode" : ""}. A list you
          hide still opens from its address and its keys. These apply on all your devices.
        </p>
        <p role="status" class={["inset-foot text-danger", !sidebarMessage && "sr-only"]}>{sidebarMessage}</p>
      </section>
      {:else if page === "data"}
      <section aria-labelledby="settings-heading">
        <div class="inset-group">
          {@render keepSwitch()}
          <ImportOpml {onImported} bind:lines={importLines} />
          <ImportStars {onImported} bind:lines={importLines} />
          <a href="/api/starred/export" download class="inset-row inset-action"
            >Export starred articles<span class="row-glyph"><Icon name="download" size={18} /></span></a
          >
          <a href="/api/collections/export" download class="inset-row inset-action"
            >Export collections<span class="row-glyph"><Icon name="download" size={18} /></span></a
          >
        </div>
        <div role="status" class={["inset-foot flex flex-col gap-1 text-ink", importLines.length === 0 && "sr-only"]}>
          {#each importLines as line (line)}
            <p>{line}</p>
          {/each}
        </div>
        {@render keepFoot()}
        <p class="inset-foot">
          OPML is the file feed readers use to move your feeds and folders between apps; export one now and then, and
          keep it somewhere safe. Starred articles are saved as a JSON Feed file, which other feed readers can open,
          with each article's text, its original link and the feed it came from; collections the same way, each
          article tagged with its collections' names. To bring your stars over from
          Inoreader, Feedly, Feedbin or another feed reader, import the JSON file it exports them in.
        </p>
      </section>
      {:else if page === "keyboard"}
      <section aria-labelledby="settings-heading">
        <div class="inset-group">
          <button type="button" onclick={onKeys} aria-haspopup="dialog" class="inset-row inset-action"
            >Change keys…<span class="row-glyph"><Icon name="chevron-right" size={18} /></span></button
          >
        </div>
        <p class="inset-foot">Give any shortcut a key of your own, or none. Your keys follow you to every device you sign in on. Press ? anywhere to see them all.</p>
      </section>
      {:else if page === "add-from-anywhere"}
        <AddAnywhere />
      {:else if page === "rules"}
        <Rules
          bind:this={rulesPanel}
          {feeds}
          {folders}
          {onMuted}
          onNew={() => openEditor({})}
          onEdit={(rule) => openEditor({ rule })}
        />
      {:else if page === "newsletters"}
        <Newsletters />
      {:else if page === "other-apps"}
        <OtherApps />
      {:else if page === "assistants"}
        <Assistants onFeedsChanged={onImported} />
      {:else if page === "passkeys"}
        <PasskeysGroup origin={passkeys} />
        {#if !passkeysShown}
          <p>Passkeys work only at this nine turtles' own address, in a browser that has them.</p>
        {/if}
      {:else if page === "readers"}
        {#if owner}
          <Readers {email} {onReaders} />
        {:else}
          <p>Only whoever runs this nine turtles sees Readers.</p>
        {/if}
      {:else if page === "plan"}
        <Plan />
      {/if}
    </div>
  </div>
  {/key}
</section>
{/if}

<style>
  /* Each segmented choice fills its control in even columns. */
  .choices.setting-control {
    display: grid;
    grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
  }
  .choices.setting-control :global(.choice) {
    justify-content: center;
    padding-inline: 0.375rem;
    text-align: center;
    line-height: 1.2;
    text-wrap: balance;
  }
  /* What a row that opens a page is set to (the reading font, the plan), before its ›. */
  .setting-value {
    font-size: var(--text-meta);
  }
  /* Delete data… and Delete account…: red words, saying what they remove. */
  .danger-name {
    color: var(--danger);
    font-weight: 600;
  }
  /* "Only you", beside the owner's own group's header: a small outlined word, never a color. */
  .only-you {
    margin-left: 0.5rem;
    padding: 0 0.375rem;
    border: 1px solid color-mix(in srgb, var(--ink) 25%, transparent);
    border-radius: 999px;
    font-size: 0.66rem;
    letter-spacing: 0.05em;
    vertical-align: 1px;
  }
  /* The passage set as articles will be, 16px in on every side, its left edge on the rows' words. */
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
