<!--
  Settings (SPEC section 18), laid out as Apple Books' settings are: one
  centred column of grouped inset lists, each group with a small uppercase
  header above it (decision 0120). It fills the list and reading areas while
  the sidebar stays, so the reader never loses their place. "Close settings"
  (on a phone, "‹ Home", decision 0231) or Escape goes back.

  Its first page keeps only the everyday settings (decision 0120): Reading
  (Unread on or off, shared across the reader's devices) and Look and feel
  (Page, for this device). Each setting has one place, where it acts
  (decision 0241): sort order is in each list's More menu, text size and
  font in the Aa panel above an article. Everything else is a row ending in › that opens a page of its own
  in place of Settings, at /settings/<page> (`page`), with "‹ Settings" above
  its title; Escape goes back too, and the keyboard returns to the row:
  Your library (Everyone you follow, a page of its own, then Your data); More
  (Install the app on any device, Rules,
  Newsletters while nine turtles takes them, Connected assistants, Passkeys where they work); Your nine turtles (Readers, the
  owner only); and Account
  (Your plan while nine turtles takes payments, Email with Change…, Password,
  Weekly email, Sign out); and, apart at the very end, Leaving (Delete data…
  and, for everyone but the owner, Delete account…, decision 0239).

  Each row on the first page has its icon at the left, in the muted grey,
  lined up with the first line of its name, and a setting's description
  sits straight under its name (S1, decision 0120).

  The groups' own components, each saying where it's described: InstallApp, Rules, Newsletters, Assistants,
  Readers, Plan, Passkeys, ChangeEmail and DeleteAccount.
-->
<script lang="ts">
  import { tick } from "svelte";
  import { edge } from "./edge";
  import ChangeEmail from "./ChangeEmail.svelte";
  import ChangePassword from "./ChangePassword.svelte";
  import WeeklyEmail from "./WeeklyEmail.svelte";
  import DeleteAccount from "./DeleteAccount.svelte";
  import Icon, { type IconName } from "./Icon.svelte";
  import { noted } from "./notes.svelte";
  import { stars } from "./stars.svelte";
  import ImportOpml from "./ImportOpml.svelte";
  import NoteLine from "./NoteLine.svelte";
  import { UNDONE, UNDO_FAILED } from "./messages";
  import InstallApp from "./InstallApp.svelte";
  import ImportStars from "./ImportStars.svelte";
  import Newsletters from "./Newsletters.svelte";
  import Assistants from "./Assistants.svelte";
  import PasskeysGroup from "./Passkeys.svelte";
  import Plan from "./Plan.svelte";
  import Readers from "./Readers.svelte";
  import Rules from "./Rules.svelte";
  import PageHead from "./PageHead.svelte";
  import { LOOKS, PAGES, swatch } from "./themes";
  import type { Feed } from "./shapes";
  import { HELP_URL, SETTINGS_PAGES, type SettingsPage } from "./router";
  import type { Preferences } from "./preferences";
  import { signOut } from "./session";
  import { updates } from "./updates.svelte";
  import { connection } from "./connection.svelte";
  import { SETTINGS_NEED_CONNECTION, sendWaiting } from "./offline";
  import { newslettersStatus } from "./newsletters";
  import { browserHasPasskeys, passkeysHere } from "./passkeys";
  import { describe, loadPlan } from "./plan";

  let {
    page = undefined,
    preferences = $bindable(),
    loaded,
    unread,
    onUnread,
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
    onYourFeeds,
    onMuted,
    onReaders,
    people,
    phone = false,
    ruleForFeed = $bindable(),
    besideToggle = false,
  }: {
    /** One of Settings' own pages, or Settings itself (decision 0120). */
    page?: SettingsPage;
    preferences: Preferences;
    /** The shared settings have come from the server, so Unread can be switched. */
    loaded: boolean;
    /** Whether Unread is on (SPEC section 10). */
    unread: boolean;
    /** Switches Unread on or off; fails if it couldn't be saved. */
    onUnread: (unread: boolean) => Promise<void>;
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
    /** Opens Everyone you follow. */
    onYourFeeds: (event: MouseEvent) => void;
    /** Opens the Hidden articles page. */
    onMuted: (event: MouseEvent) => void;
    /** Opens the owner's All readers page. */
    onReaders: (event: MouseEvent) => void;
    /** Everyone the reader follows, one row each (the sidebar's rows), for Hiding. */
    people: Feed[];
    /** On a phone a task (Change email, Delete…) is a screen in place of Settings. */
    phone?: boolean;
    /** Hiding opens set to this person ("Hide articles about…" on an article or a person's page). */
    ruleForFeed?: number;
    /** The sidebar is hidden, so the top line starts clear of its toggle. */
    besideToggle?: boolean;
  } = $props();

  /** Hiding started from someone's page or an article: the word field waits, set to them. */
  let hideFor: number | undefined = $state();

  $effect(() => {
    if (ruleForFeed !== undefined) {
      hideFor = ruleForFeed;
      ruleForFeed = undefined;
    }
  });
  // Leaving Hiding lets the person go: opened again from Settings, it's for everyone.
  $effect(() => {
    if (page !== "hiding") hideFor = undefined;
  });

  /** Change email, Change password, Delete data or Delete account, while open: a sheet over Settings, or on a phone a screen in its place. */
  let task: "email" | "password" | "data" | "delete" | undefined = $state();
  let taskHeading: HTMLHeadingElement | undefined = $state();
  let changeButton: HTMLButtonElement | undefined = $state();
  let deleteButton: HTMLButtonElement | undefined = $state();
  let passwordButton: HTMLButtonElement | undefined = $state();
  let dataButton: HTMLButtonElement | undefined = $state();
  /** What Change email or Change password did, said under Account. */
  let accountNote = $state("");

  function closeTask() {
    const from =
      task === "email" ? changeButton : task === "password" ? passwordButton : task === "data" ? dataButton : deleteButton;
    task = undefined;
    queueMicrotask(() => from?.focus());
  }

  let message = $state("");
  let unreadMessage = $state("");
  /** What the last import (OPML or starred articles) did, in plain words. */
  let importLines: string[] = $state([]);
  /** After an import that added something, "Wrong file? Undo the import" until the next action here (decision 0238). */
  let importUndo: (() => Promise<"too-late" | undefined>) | undefined = $state();
  let undoingImport = $state(false);
  /** What undoing the import said, in oxblood when it couldn't be done. */
  let importUndone = $state({ words: "", refusal: false });

  async function undoTheImport() {
    if (!importUndo || undoingImport) return;
    const undo = importUndo;
    undoingImport = true;
    try {
      const why = await undo();
      importUndo = undefined;
      // Undone, the summary is no longer true; too late, it still is.
      if (why === undefined) importLines = [];
      importUndone = why === "too-late" ? { words: "It's too late to undo that.", refusal: true } : { words: UNDONE, refusal: false };
      if (why === undefined) onImported();
    } catch {
      importUndone = { words: UNDO_FAILED, refusal: true };
    }
    undoingImport = false;
    await tick();
    heading?.focus();
  }

  /** Another import, or ×, ends the import's Undo line. */
  function endImportUndo() {
    importUndo = undefined;
    importUndone = { words: "", refusal: false };
  }
  /** Your data's two exports: each a download once there's something in it, else a line saying there's nothing yet. */
  const exports = $derived([
    { href: "/api/starred/export", label: "Export starred articles", any: stars.any, none: "Nothing starred yet" },
    { href: "/api/notes/export", label: "Export notes and highlights", any: noted.any, none: "No notes yet" },
  ]);

  async function chooseUnread(next: boolean) {
    unreadMessage = "";
    try {
      await onUnread(next);
    } catch {
      unreadMessage = "Unread couldn't be switched. Try again in a moment.";
    }
  }

  async function leave() {
    try {
      // Marks made offline go first: signing out deletes this device's copies (SPEC section 32).
      await sendWaiting();
      await signOut();
      onSignedOut();
    } catch {
      message = "This device couldn't be signed out. Try again in a moment.";
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
{:else if task === "password"}
  <ChangePassword
    sheet={!phone}
    {besideToggle}
    bind:heading={taskHeading}
    onCancel={closeTask}
    onChanged={(note) => {
      accountNote = note;
      closeTask();
    }}
  />
{:else if task === "data"}
  <DeleteAccount data sheet={!phone} {besideToggle} bind:heading={taskHeading} onCancel={closeTask} onDeleted={closeTask} />
{:else if task === "delete"}
  <DeleteAccount sheet={!phone} {besideToggle} bind:heading={taskHeading} onCancel={closeTask} onDeleted={onSignedOut} />
{/if}
{#if !(task && phone)}
<!-- On one of its pages, the page itself is the region named after it, inside Settings. -->
<section aria-labelledby={page ? undefined : "settings-heading"} aria-label={page ? "Settings" : undefined} class="flex flex-1 flex-col bg-paper">
  {#if page}
    <PageHead title={SETTINGS_PAGES[page]} id="settings-heading" bind:heading onBack={onBack} backTo="Settings" {besideToggle} column="max-w-[35rem]" />
  {:else if phone}
    <!-- On a phone Settings is a screen you go into, so it goes back, as every other screen there does (decision 0231). -->
    <PageHead title="Settings" id="settings-heading" bind:heading onBack={onClose} backTo="Home" column="max-w-[35rem]" />
  {:else}
    <PageHead title="Settings" id="settings-heading" bind:heading {onClose} closeLabel="Close settings" {besideToggle} column="max-w-[35rem]" />
  {/if}
  {#key page}
  <div use:edge class="scroller relative min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-16 md:px-10">
    <div class={["mx-auto flex max-w-[35rem] flex-col gap-8", page && "settings-page"]}>
      {#if connection.offline}
        <!-- Without a connection nothing here could be saved, so Settings says so and waits (SPEC section 32). -->
        <p role="status">{SETTINGS_NEED_CONNECTION}</p>
      {:else if !page}
      <section aria-labelledby="reading-heading">
        <h3 id="reading-heading" class="settings-head">Reading</h3>
        <div class="inset-group">
          <!-- One switch (decision 0172): Unread on is the Unread list, read styling and dots; off, none of them. -->
          <div class="inset-row setting">
            <div class="setting-label">
              {@render icon("page-new")}
              <div class="setting-words">
                <p id="unread-name" class="setting-name" aria-hidden="true">Unread</p>
                <p id="unread-hint" class="setting-hint">
                  {unread ? "An Unread list, and a dot where something is new." : "No Unread list and no dots. What you've read is still remembered."}
                </p>
              </div>
            </div>
            <label class="switch-target -my-2 -mr-2">
              <input
                type="checkbox"
                role="switch"
                class="switch"
                aria-label="Unread"
                aria-describedby="unread-hint"
                checked={unread}
                disabled={!loaded}
                onchange={(event) => chooseUnread(event.currentTarget.checked)}
              />
            </label>
          </div>
        </div>
        <p class="inset-foot">Applies on all your devices.</p>
        <p role="status" class={["inset-foot flex items-start gap-1.5 text-danger", !unreadMessage && "sr-only"]}>{#if unreadMessage}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{/if}{unreadMessage}</p>
      </section>

      <section aria-labelledby="reader-heading">
        <h3 id="reader-heading" class="settings-head">Look and feel</h3>
        <div class="inset-group">
          <!-- The page itself: White, Paper, Night, or Match device, White by day and Night by night (decision 0176). -->
          <div class="inset-row setting has-control">
            <div class="setting-label">
              {@render icon("palette")}
              <div class="setting-words"><p id="page-name" class="setting-name">Page</p></div>
            </div>
            <div role="group" aria-labelledby="page-name" class="choices setting-control" style="--columns: 4">
              {#each PAGES as choice (choice.value)}
                <label class="choice page-choice">
                  <input type="radio" name="page" value={choice.value} bind:group={preferences.page} />
                  <span aria-hidden="true" class={["paper", choice.value !== "auto" && "lettered"]} style:background={swatch(choice.value)} style:color={choice.value === "auto" ? undefined : LOOKS[choice.value].ink}></span>
                  {choice.label}
                </label>
              {/each}
            </div>
          </div>
        </div>
        <!-- Text size and font are only in the Aa panel, beside the text they change (decision 0241). -->
        <p class="inset-foot">This device only. Text size and font are in Aa, above any article.</p>
      </section>

      <section aria-labelledby="library-heading">
        <h3 id="library-heading" class="settings-head">Your library</h3>
        <div class="inset-group">
          {@render pageRow("feeds", "/settings/feeds", "Everyone you follow", "feed", onYourFeeds)}
          {@render pageRow("data", "/settings/data", SETTINGS_PAGES.data, "archive-box", open("data"))}
        </div>
      </section>

      <section aria-labelledby="more-heading">
        <h3 id="more-heading" class="settings-head">More</h3>
        <div class="inset-group">
          {@render pageRow("install", "/settings/install", SETTINGS_PAGES.install, "phone-download", open("install"))}
          {@render pageRow("hiding", "/settings/hiding", SETTINGS_PAGES.hiding, "eye-off", open("hiding"))}
          {#if newslettersOn}
            {@render pageRow("newsletters", "/settings/newsletters", SETTINGS_PAGES.newsletters, "newsletter", open("newsletters"))}
          {/if}
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
              {@render icon("person-at")}
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
          <!-- Changed with the current password; every other device is signed out (decision 0200). -->
          <div class="inset-row setting">
            <div class="setting-label">
              {@render icon("lock")}
              <div class="setting-words"><p class="setting-name">Password</p></div>
            </div>
            <button bind:this={passwordButton} type="button" onclick={() => (task = "password")} class="btn btn-small shrink-0"
              >Change…<span class="sr-only"> password</span></button
            >
          </div>
          {#if emailSending && email}<WeeklyEmail onProblem={(text) => (message = text)} />{/if}
          <!-- In the text color, not oxblood: signing out removes nothing, and oxblood means something goes (decision 0042). -->
          <button type="button" onclick={leave} class="inset-row inset-action setting"
            ><span class="setting-label">{@render icon("sign-out")}<span class="setting-name">Sign out</span></span></button
          >
        </div>
        <p role="status" class={["inset-foot text-ink", !accountNote && "sr-only"]}>{accountNote}</p>
        <p role="status" class={["inset-foot flex items-start gap-1.5 text-danger", !message && "sr-only"]}>{#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{/if}{message}</p>
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
      </section>

      <!-- Deleting sits apart from Sign out, at the very end (decision 0239): a slip aimed at an everyday row can't land on one that removes something. -->
      <section aria-labelledby="leaving-heading">
        <h3 id="leaving-heading" class="settings-head">Leaving</h3>
        <div class="inset-group">
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
        <p class="inset-foot">{owner ? "It says" : "Each one says"} exactly what goes before anything is removed.</p>
      </section>
      <p class="inset-foot"><a href={HELP_URL} target="_blank" rel="noopener" class="text-link">Help<span class="sr-only"> (on the nine turtles website, opens in a new tab)</span></a> · <span translate="no">Version {version}</span></p>
      {:else if page === "data"}
      <section aria-labelledby="settings-heading">
        <div class="inset-group">
          <ImportOpml onImported={() => ((importUndone = { words: "", refusal: false }), onImported())} bind:lines={importLines} bind:undo={importUndo} />
          <ImportStars onImported={() => (endImportUndo(), onImported())} bind:lines={importLines} />
          <!-- An export with nothing in it says so instead, in a row that isn't a button (decision 0191). -->
          {#each exports as { href, label, any, none } (href)}
            {#if any}
              <a {href} download class="inset-row inset-action">{label}<span class="row-glyph"><Icon name="download" size={18} /></span></a>
            {:else}
              <p class="inset-row text-muted">{none}</p>
            {/if}
          {/each}
        </div>
        <div role="status" class={["inset-foot flex flex-col gap-1 text-ink", importLines.length === 0 && "sr-only"]}>
          {#each importLines as line (line)}
            <p>{line}</p>
          {/each}
        </div>
        <!-- The import's Undo, drawn as every Undo line is (SPEC section 8), and what it said: always in the page, so its words are heard. -->
        <div class={["inset-foot flex flex-wrap items-center gap-x-3 gap-y-1", importUndone.refusal ? "text-danger" : "text-ink", !importUndo && !importUndone.words && "sr-only"]}>
          <NoteLine
            announce
            message={importUndone.words || (importUndo ? "Wrong file?" : "")}
            refusal={importUndone.refusal}
            busy={undoingImport}
            undoWord="Undo the import"
            onUndo={importUndo ? undoTheImport : undefined}
            onClose={() => (endImportUndo(), void tick().then(() => heading?.focus()))}
          />
        </div>

        <p class="inset-foot">
          OPML is the file feed readers use to move your feeds and folders between apps; export one now and then, and
          keep it somewhere safe. Starred articles are saved as a JSON Feed file, which other feed readers can open,
          with each article's text, its original link and the feed it came from. Notes and highlights are saved as one Markdown file. To bring your stars over from
          Inoreader, Feedly, Feedbin or another feed reader, import the JSON file it exports them in.
        </p>
      </section>
      {:else if page === "install"}
        <InstallApp />
      {:else if page === "hiding"}
        <Rules {people} {onMuted} bind:forFeed={hideFor} />
      {:else if page === "newsletters"}
        <Newsletters />
      {:else if page === "assistants"}
        <Assistants onFeedsChanged={onImported} />
      {:else if page === "passkeys"}
        <PasskeysGroup origin={passkeys} />
        {#if !passkeysShown}
          <p>Passkeys work only at this nine turtles' own address, in a browser that has them.</p>
        {/if}
      {:else if page === "readers"}
        {#if owner}
          <Readers {onReaders} />
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
  /* Each segmented choice shares its control evenly, but is never narrower than its own word (decision 0120). */
  .choices.setting-control {
    display: grid;
    grid-template-columns: repeat(var(--columns), minmax(min-content, 1fr));
  }
  .choices.setting-control :global(.choice) {
    justify-content: center;
    padding-inline: 0.375rem;
    text-align: center;
    line-height: 1.2;
    text-wrap: balance;
  }
  /*
    Page's choices show the paper itself (decision 0226): a 28px square of each page with an "A" in
    that page's own words' color, its name under it; Match device is half White, half Night. A faint
    edge lets the white square show on white. The control, the chosen tile and the names are the
    other segmented choices' own; the square is only a picture, the name says it.
  */
  .choices.setting-control .page-choice {
    flex-direction: column;
    gap: 0.25rem;
    padding-block: 0.5rem;
  }
  .paper {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 0.3125rem;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 25%, transparent);
    /* 12px, under the type scale on purpose: the "A" is part of the drawing, not text to read. */
    font: 600 0.75rem/1 var(--font-serif);
  }
  /* The "A" is drawn, not written, so the choice's name stays its word alone ("Paper", not "A Paper"). */
  .paper.lettered::before {
    content: "A";
  }
  @media (forced-colors: active) {
    .paper {
      forced-color-adjust: none;
      outline: 1px solid CanvasText;
    }
  }
  /* What a row that opens a page is set to (the plan), before its ›. */
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
</style>
