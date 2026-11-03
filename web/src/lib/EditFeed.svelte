<!--
  "Edit person" (SPEC sections 15 and 36): managing a person, opened from
  their list's More menu or their page. Their name; their places, with Add
  another place and, for a person with several, "Not the same person" for
  this place; their folders (one list for all their places); then this
  place's own settings. A place on its own is a person with one place: the
  name is the place's, as before.

  Built as "Edit feed" was: the name, the folders as a
  checklist ending in a "New folder…" row, its own settings (reading mode,
  how often it's checked, opening on the website), a shortcut to add a rule
  for the feed (SPEC section 27), and Unsubscribe. A YouTube channel also
  has "Include Shorts" and "Include live streams", both off (decision 0144). A feed that isn't working
  says so at the top, with Find new address (decision 0106), which moves it
  at once rather than on Save. Saving
  changes them all together; Cancel or Escape goes back to the feed unchanged.
  Unsubscribing happens at once, with Undo on the next screen. On a wide
  window it's a sheet over the feed's list; on a phone, a screen of its own.

  In the sheet, one row of actions at the foot, in a Mac sheet's order:
  Unsubscribe in red words at the far left, apart from the rest, then Cancel
  and Save at the right end (decision 0039). On a phone, the phone sheet's
  one build (decision 0052): an X beside the title is the way out (no
  Cancel), Unsubscribe is the one row of a group of its own, and Save takes
  the full width at the screen's foot, at least 32px below it.
-->
<script lang="ts">
  import { tick } from "svelte";
  import FailingLine from "./FailingLine.svelte";
  import Icon from "./Icon.svelte";
  import PageHead from "./PageHead.svelte";
  import Sheet from "./Sheet.svelte";
  import { edge } from "./edge";
  import AddPlace from "./AddPlace.svelte";
  import type { Check, Feed, Folder } from "./shapes";
  import { editFeed, feedFrequency, refused, type Notice } from "./feeds";
  import type { LoadedLibrary } from "./library.svelte";
  import { PLACE_NAMES, placeShownAs, placesOf, putBack, separate } from "./people";
  import { pausedSince } from "./times";
  import { addressFor, keepAddress, looksLikeAddress } from "./writeBack";
  import type { Sick } from "./health";
  import KeepOrRemove from "./KeepOrRemove.svelte";
  import { keptAny, keptFrom, type Kept } from "./keeping";

  let {
    feed,
    folders,
    heading = $bindable(),
    besideToggle = false,
    sheet = false,
    river = false,
    onSaved,
    onCancel,
    onUnsubscribe,
    onAddRule,
    onMoved,
    library,
    onPeople,
    onPlace,
  }: {
    feed: Feed;
    folders: Folder[];
    heading?: HTMLHeadingElement;
    /** The sidebar is hidden, so the top line starts clear of its toggle. */
    besideToggle?: boolean;
    /** Shown as a sheet over the list, not as a page. */
    sheet?: boolean;
    /** The whole app is in river mode, so every feed flows past whatever this one says. */
    river?: boolean;
    onSaved: () => void;
    onCancel: () => void;
    /** `removeKept`: what the reader starred or marked there goes too (SPEC section 42). */
    onUnsubscribe: (removeKept: boolean) => Promise<string | undefined>;
    /** "Add a rule for this feed…": Settings, with a new rule for it (SPEC section 27). */
    onAddRule: () => void;
    /** Find new address moved the feed (decision 0106). */
    onMoved: (feed: Sick) => void;
    library: LoadedLibrary;
    /** Places were joined or parted (SPEC section 36): their list, with "… · Undo". */
    onPeople: (done: Notice, lead: number) => void;
    /** Another of the person's places, to edit its own settings. */
    onPlace: (id: number) => void;
  } = $props();

  let places = $derived(placesOf(feed, library.feeds ?? []));
  let kind = $derived(PLACE_NAMES[feed.place ?? "blog"].toLowerCase());
  // The form starts from the person as they are now, once: their name, and every folder any of their places is in.
  let title = $state((() => library.shownAs(feed)?.title ?? feed.title)());
  /** Where Write back writes to them (SPEC section 37): kept for the whole person, changed only if edited. */
  const knownAddress = addressFor((() => feed)(), (() => library.feeds ?? [])()) ?? "";
  let address = $state(knownAddress);
  let chosen: number[] = $state((() => [...new Set(placesOf(feed, library.feeds ?? []).flatMap((place) => place.folders))])());
  let newFolder = $state("");
  let flows = $state((() => feed.river)());
  let check: Check = $state((() => feed.check)());
  let openOnSite = $state((() => feed.openOnSite)());
  let paused = $state((() => feed.pausedAt != null)());
  /** A YouTube channel's Shorts and live streams, left out unless switched on (decision 0144). */
  let shorts = $state((() => feed.shorts === true)());
  let liveStreams = $state((() => feed.liveStreams === true)());
  let busy = $state(false);
  let message = $state("");
  /** How often the feed posts, in plain words (decision 0105), once the server says. */
  let frequency: string | undefined = $state();
  feedFrequency((() => feed.id)()).then((words) => (frequency = words));

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    message = "";
    // A wrong address is caught before anything is saved, keeping what was typed.
    const newAddress = address.trim() !== knownAddress;
    if (newAddress && address.trim() && !looksLikeAddress(address)) {
      message = "That doesn't look like an email address. Check it and try again.";
      return;
    }
    busy = true;
    const refusal = await editFeed(feed.id, title, chosen, newFolder, {
      river: flows,
      check,
      openOnSite,
      paused,
      ...(feed.sortsVideos ? { shorts, liveStreams } : {}),
    });
    const problem = refusal ? refused(refusal, "feed") : newAddress ? await keepAddress(feed.id, address) : undefined;
    busy = false;
    if (problem) message = problem;
    else onSaved();
  }

  const MODE_CHOICES = [
    { value: false, label: "Inbox" },
    { value: true, label: "River" },
  ];
  const CHECK_CHOICES: { value: Check; label: string }[] = [
    { value: "automatic", label: "Automatic" },
    { value: "hourly", label: "Hourly" },
    { value: "daily", label: "Daily" },
  ];

  /** "Not the same person": this place stands on its own again, with Undo on its list. */
  async function part() {
    if (busy) return;
    busy = true;
    message = "";
    const { refusal, before } = await separate(feed.id);
    if (refusal) {
      busy = false;
      message = refusal;
      return;
    }
    await library.loadFeeds();
    busy = false;
    const undo = async () => {
      const problem = await putBack(before);
      await library.loadFeeds();
      return problem;
    };
    onPeople({ message: `${placeShownAs(feed)} is on its own again`, undo }, feed.id);
  }

  /** What the reader kept there, while Unsubscribe asks whether to keep it (SPEC section 42). */
  let asking: Kept | undefined = $state();
  let unsubscribeButton: HTMLButtonElement | undefined = $state();

  async function leave(removeKept?: boolean) {
    if (busy) return;
    busy = true;
    message = "";
    if (removeKept === undefined) {
      const kept = await keptFrom(feed.id);
      if (keptAny(kept)) {
        busy = false;
        asking = kept;
        return;
      }
    }
    const problem = await onUnsubscribe(removeKept ?? false);
    busy = false;
    asking = undefined;
    if (problem) message = problem;
  }

  async function keepAsking() {
    asking = undefined;
    await tick();
    unsubscribeButton?.focus();
  }
</script>

{#snippet unsubscribe(look: string)}
  <button
    type="button"
    aria-disabled={busy}
    aria-describedby="unsubscribe-help"
    title="Stops following {places.length > 1 ? `this ${kind}` : 'them'} and removes the articles; you choose whether starred and noted ones stay. You can undo it straight afterwards."
    aria-label="Unsubscribe from {feed.title}"
    bind:this={unsubscribeButton}
    onclick={() => leave()}
    class={look}>Unsubscribe</button
  >
  <span id="unsubscribe-help" class="sr-only">Removes its articles; you choose whether starred and noted ones stay. You can undo it straight afterwards.</span>
{/snippet}

{#snippet form()}
  <form onsubmit={save} class={["flex flex-col gap-5", !sheet && "flex-1"]}>
    <!-- Only while it isn't working, as the feed health page would list it: one quiet line and Find new address. -->
    <FailingLine {feed} label="Find new address" {onMoved} />
    <div class="flex flex-col gap-1.5">
      <label class="flex flex-col gap-1.5">
        <span class="text-small text-ink-2">Name</span>
        <input bind:value={title} type="text" autocomplete="off" class="field" aria-describedby="feed-frequency" />
      </label>
      <!--
        How often it posts, as a field's helper line under the name (decision 0105): plain rounded
        words, no number to chase. Its line is kept from the start, so nothing moves when the words arrive.
      -->
      <span id="feed-frequency" class="field-help mt-0">{frequency ? `${frequency}.` : " "}</span>
    </div>
    <div class="flex flex-col gap-1.5">
      <label class="flex flex-col gap-1.5">
        <span class="text-small text-ink-2">Email address</span>
        <input bind:value={address} type="text" inputmode="email" autocomplete="off" autocapitalize="none" spellcheck="false" class="field" aria-describedby="person-address-help" />
      </label>
      <span id="person-address-help" class="field-help mt-0">Write back opens your own email app with this address.</span>
    </div>

    <!-- Their places on the web (SPEC section 36): what each is, each other place leading to its own settings. -->
    <div class="flex min-w-0 flex-col gap-1.5">
      <span class="text-small text-ink-2" id="person-places-name">Places</span>
      <ul class="inset-group" aria-labelledby="person-places-name">
        {#each places as place (place.id)}
          <li class="inset-row gap-3">
            <span class="w-24 shrink-0 text-muted">{PLACE_NAMES[place.place ?? "blog"]}</span>
            <span class="min-w-0 flex-1 break-words">{placeShownAs(place)}</span>
            {#if places.length > 1 && place.id === feed.id}
              <span class="shrink-0 text-small text-muted">Settings below</span>
            {:else if places.length > 1}
              <button type="button" class="text-link shrink-0 text-small" onclick={() => onPlace(place.id)}>Its settings</button>
            {/if}
          </li>
        {/each}
      </ul>
      <div class="mt-2 flex flex-col gap-3">
        <AddPlace {feed} name={title.trim() || feed.title} {library} onJoined={onPeople} />
        {#if places.length > 1}
          <button type="button" class="text-link self-start text-small" aria-disabled={busy} onclick={part}
            >{placeShownAs(feed)} isn't the same person</button
          >
        {/if}
      </div>
    </div>

    <fieldset class="flex min-w-0 flex-col gap-1.5">
      <legend class="mb-1.5 text-small text-ink-2">Folders</legend>
      <!--
        A checklist, as Apple lists choices: each folder a 44px row ending in a
        tick box, a rounded square, empty when the feed isn't in it and filled
        with a check when it is (decision 0045). Square, because a feed can be
        in several folders; a round mark would read as "pick one". "New
        folder…" is the list's last row, a text box of its own.
      -->
      <div class="inset-group">
        {#each folders as folder (folder.id)}
          <label class="inset-row check-row">
            <input type="checkbox" value={folder.id} bind:group={chosen} />
            <span class="min-w-0 break-words">{folder.name}</span>
            <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size={14} /></span>
          </label>
        {/each}
        <label class="inset-row">
          <span class="sr-only">New folder</span>
          <input
            bind:value={newFolder}
            type="text"
            autocomplete="off"
            placeholder="New folder…"
            class="inset-input"
            aria-describedby="new-folder-hint"
          />
        </label>
      </div>
      <!-- On the field's own left edge, 6px under it (the fieldset's gap). -->
      <span id="new-folder-hint" class="field-help mt-0"
        >{folders.length === 0 ? "No folders yet. " : ""}Optional: a new folder is made when you save, with them in it.</span
      >
    </fieldset>

    <!--
      The feed's own settings, a grouped list as in Settings: each row's name on its left and a
      segmented choice at its right end (under the name when narrow), then a tick box row. Every
      setting starts as every feed behaves, so only the feeds that need it change.
    -->
    <div class="flex min-w-0 flex-col gap-1.5">
      <span class="text-small text-ink-2" id="feed-settings-name">{places.length > 1 ? `Settings for this ${kind}` : "Settings"}</span>
      <!-- Each setting's name with a short description straight under it, as in Settings (S1, decision 0120). -->
      <div class="inset-group" role="group" aria-labelledby="feed-settings-name">
        <div class="inset-row setting has-control">
          <div class="setting-words setting-label">
            <p id="feed-mode-name" class="setting-name">Reading mode</p>
            <p id="feed-mode-hint" class="setting-hint">
              {river
                ? "The whole app is in river mode for now (Settings › Reading)."
                : flows
                  ? "Its articles skip Unread and show no dot."
                  : "New articles go to Unread."}
            </p>
          </div>
          <div role="group" aria-labelledby="feed-mode-name" aria-describedby="feed-mode-hint" class="choices setting-control" style="--columns: 2">
            {#each MODE_CHOICES as choice (choice.label)}
              <label class="choice">
                <input type="radio" name="feed-mode" value={choice.value} bind:group={flows} />
                {choice.label}
              </label>
            {/each}
          </div>
        </div>
        <div class="inset-row setting has-control">
          <div class="setting-words setting-label">
            <p id="feed-check-name" class="setting-name">Check for new articles</p>
            <p id="feed-check-hint" class="setting-hint">
              {check === "hourly"
                ? "No more often than once an hour."
                : check === "daily"
                  ? "No more often than once a day."
                  : "As often as it usually posts."}
            </p>
          </div>
          <div role="group" aria-labelledby="feed-check-name" aria-describedby="feed-check-hint" class="choices setting-control" style="--columns: 3">
            {#each CHECK_CHOICES as choice (choice.value)}
              <label class="choice">
                <input type="radio" name="feed-check" value={choice.value} bind:group={check} />
                {choice.label}
              </label>
            {/each}
          </div>
        </div>
        <label class="inset-row check-row setting">
          <input type="checkbox" bind:checked={openOnSite} aria-describedby="feed-site-hint" />
          <span class="setting-words">
            <span class="setting-name">Open articles on the website</span>
            <span id="feed-site-hint" class="setting-hint">Opens the publisher's page instead of the text here.</span>
          </span>
          <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size={14} /></span>
        </label>
        {#if feed.sortsVideos}
          <!-- A YouTube channel (decision 0144): both off by default, sorted by lists YouTube keeps for each channel. -->
          <label class="inset-row check-row setting">
            <input type="checkbox" bind:checked={shorts} aria-describedby="feed-shorts-hint" />
            <span class="setting-words">
              <span class="setting-name">Include Shorts</span>
              <span id="feed-shorts-hint" class="setting-hint">YouTube's short, upright videos. Sorted by YouTube's own lists, so one may slip through now and then.</span>
            </span>
            <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size={14} /></span>
          </label>
          <label class="inset-row check-row setting">
            <input type="checkbox" bind:checked={liveStreams} aria-describedby="feed-live-hint" />
            <span class="setting-words">
              <span class="setting-name">Include live streams</span>
              <span id="feed-live-hint" class="setting-hint">Streams, and their recordings once they end.</span>
            </span>
            <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size={14} /></span>
          </label>
        {/if}
        <label class="inset-row check-row setting">
          <input type="checkbox" bind:checked={paused} aria-describedby="feed-pause-hint" />
          <span class="setting-words">
            <span class="setting-name">Pause for a while</span>
            <span id="feed-pause-hint" class="setting-hint"
              >New articles skip Unread until you untick it; then its newest three come back.{#if feed.pausedAt != null}
                {pausedSince(feed.pausedAt)}{/if}</span
            >
          </span>
          <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size={14} /></span>
        </label>
      </div>
    </div>

    <!-- A shortcut to Settings › Rules, already set to this feed; leaving this sheet unchanged. -->
    <p class="text-small">
      <button type="button" class="text-link" onclick={onAddRule}>Add a rule…</button>
    </p>

    <!-- A problem, in red words with an icon, only once there is one: the sheet grows by its line. -->
    <p role="status" class={["flex items-start gap-1.5 text-small text-danger", !message && "sr-only"]}>
      {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
    </p>

    {#if asking}
      <KeepOrRemove name={feed.title} kept={asking} {busy} onChoose={(removeKept) => leave(removeKept)} onCancel={keepAsking} />
    {:else if sheet}
      <!-- One row at the foot: Unsubscribe at the far left, then Cancel and Save at the right end. -->
      <div class="sheet-actions">
        {@render unsubscribe("btn-danger")}
        <button type="button" onclick={onCancel} class="btn">Cancel</button>
        <button type="submit" aria-disabled={busy} class="btn-primary">Save</button>
      </div>
    {:else}
      <!-- On a phone: Unsubscribe as a group of its own, a red row (its word says what it does), then Save at the foot, at least 36px below it. -->
      <div class="inset-group">
        {@render unsubscribe("inset-row inset-action text-danger font-semibold")}
      </div>
      <div class="page-action">
        <button type="submit" aria-disabled={busy} class="btn-primary">Save</button>
      </div>
    {/if}
  </form>
{/snippet}

{#if sheet}
  <Sheet title="Edit person" bind:heading onClose={onCancel}>
    {@render form()}
  </Sheet>
{:else}
<section aria-labelledby="list-heading" class="page-sheet">
  <!--
    The phone sheet's build (decisions 0052, 0055): an iOS page sheet, its grouped ground 10px
    below the dimmed screen's top with 12px top corners, the title with an X that goes back
    unchanged (as Escape does), no Cancel. Its form starts 20px under the top line, as Settings'
    first group does, the folders and Unsubscribe are cards on the ground, and Save sits at the
    screen's foot.
  -->
  <div class="page-sheet-card">
    <PageHead title="Edit person" bind:heading {besideToggle} onClose={onCancel} closeLabel="Close" />
    <div use:edge class="scroller relative flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-5 md:px-10">
      <div class="mx-auto flex w-full max-w-xl flex-1 flex-col">
        {@render form()}
      </div>
    </div>
  </div>
</section>
{/if}

<style>
  /* The same rows as Settings.svelte's (keep the two alike, decision 0120): each choice shares its control evenly, but is never narrower than its own word, so "Automatic" keeps its padding. */
  .choices.setting-control {
    /* A sheet is narrower than Settings' column, so its controls are too. */
    flex-basis: 15rem;
    display: grid;
    grid-template-columns: repeat(var(--columns), minmax(min-content, 1fr));
  }
  .choices.setting-control :global(.choice) {
    justify-content: center;
    padding-inline: 0.5rem;
    text-align: center;
    line-height: 1.2;
  }
  /* On a phone, under the words at the row's full width, as in Settings. */
  @media (width < 40rem) {
    .choices.setting-control {
      flex-basis: 100%;
    }
  }
</style>
