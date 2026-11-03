<!--
  One source's own settings (SPEC section 36, decision 0160): in a
  publication's Edit, under its name, and on a person's source's own page.
  A source that isn't working says so first, with Find new address (decision
  0106), which moves it at once. Then what kind of source it is (read from the
  feed, and the reader corrects it), then the settings a grouped list as in
  Settings: reading mode, how often it's checked, opening on the website, a
  YouTube channel's Shorts and live streams (both off, decision 0144), and
  pausing; then a shortcut to add a rule for it (SPEC section 27).

  The values belong to the form around it, which saves them with the rest.
-->
<script lang="ts">
  import FailingLine from "./FailingLine.svelte";
  import Icon from "./Icon.svelte";
  import type { Sick } from "./health";
  import { PLACE_NAMES } from "./people";
  import { PLACE_KINDS, type Check, type Feed, type PlaceKind } from "./shapes";
  import { pausedSince } from "./times";
  import { feedFrequency } from "./feeds";

  let {
    feed,
    river = false,
    place = $bindable(),
    flows = $bindable(),
    check = $bindable(),
    openOnSite = $bindable(),
    paused = $bindable(),
    shorts = $bindable(),
    liveStreams = $bindable(),
    onAddRule,
    onMoved,
  }: {
    feed: Feed;
    /** The whole app is in river mode, so every source flows past whatever this one says. */
    river?: boolean;
    place: PlaceKind;
    flows: boolean;
    check: Check;
    openOnSite: boolean;
    paused: boolean;
    shorts: boolean;
    liveStreams: boolean;
    /** "Add a rule…": Settings, with a new rule for it (SPEC section 27). */
    onAddRule: () => void;
    /** Find new address moved it (decision 0106). */
    onMoved: (feed: Sick) => void;
  } = $props();

  const MODE_CHOICES = [
    { value: false, label: "Inbox" },
    { value: true, label: "River" },
  ];
  const CHECK_CHOICES: { value: Check; label: string }[] = [
    { value: "automatic", label: "Automatic" },
    { value: "hourly", label: "Hourly" },
    { value: "daily", label: "Daily" },
  ];
  const id = $props.id();
  /** How often it posts, in plain words (decision 0105), once the server says. */
  let frequency: string | undefined = $state();
  feedFrequency((() => feed.id)()).then((words) => (frequency = words));
</script>

<!-- Only while it isn't working, as the feed health page would list it: one quiet line and Find new address. -->
<FailingLine {feed} label="Find new address" {onMoved} />

<label class="flex flex-col gap-1.5">
  <span class="text-small text-ink-2">Kind of source</span>
  <select bind:value={place} class="field" aria-describedby="{id}-place-help">
    {#each PLACE_KINDS as kind (kind)}
      <option value={kind}>{PLACE_NAMES[kind]}</option>
    {/each}
  </select>
  <span id="{id}-place-help" class="field-help mt-0">nine turtles reads it from the source; change it if it's wrong.</span>
</label>
<!-- How often it posts (decision 0105): plain rounded words, its line kept from the start so nothing moves. -->
<p class="field-help mt-0">{frequency ? `${frequency}.` : " "}</p>

<div class="flex min-w-0 flex-col gap-1.5">
  <span class="text-small text-ink-2" id="{id}-settings">Settings</span>
  <!-- Each setting's name with a short description straight under it, as in Settings (S1, decision 0120). -->
  <div class="inset-group" role="group" aria-labelledby="{id}-settings">
    <div class="inset-row setting has-control">
      <div class="setting-words setting-label">
        <p id="{id}-mode" class="setting-name">Reading mode</p>
        <p id="{id}-mode-hint" class="setting-hint">
          {river ? "The whole app is in river mode for now (Settings › Reading)." : flows ? "Its articles skip Unread and show no dot." : "New articles go to Unread."}
        </p>
      </div>
      <div role="group" aria-labelledby="{id}-mode" aria-describedby="{id}-mode-hint" class="choices setting-control" style="--columns: 2">
        {#each MODE_CHOICES as choice (choice.label)}
          <label class="choice">
            <input type="radio" name="{id}-mode" value={choice.value} bind:group={flows} />
            {choice.label}
          </label>
        {/each}
      </div>
    </div>
    <div class="inset-row setting has-control">
      <div class="setting-words setting-label">
        <p id="{id}-check" class="setting-name">Check for new articles</p>
        <p id="{id}-check-hint" class="setting-hint">
          {check === "hourly" ? "No more often than once an hour." : check === "daily" ? "No more often than once a day." : "As often as it usually posts."}
        </p>
      </div>
      <div role="group" aria-labelledby="{id}-check" aria-describedby="{id}-check-hint" class="choices setting-control" style="--columns: 3">
        {#each CHECK_CHOICES as choice (choice.value)}
          <label class="choice">
            <input type="radio" name="{id}-check" value={choice.value} bind:group={check} />
            {choice.label}
          </label>
        {/each}
      </div>
    </div>
    <label class="inset-row check-row setting">
      <input type="checkbox" bind:checked={openOnSite} aria-describedby="{id}-site-hint" />
      <span class="setting-words">
        <span class="setting-name">Open articles on the website</span>
        <span id="{id}-site-hint" class="setting-hint">Opens the publisher's page instead of the text here.</span>
      </span>
      <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size={14} /></span>
    </label>
    {#if feed.sortsVideos}
      <!-- A YouTube channel (decision 0144): both off by default, sorted by lists YouTube keeps for each channel. -->
      <label class="inset-row check-row setting">
        <input type="checkbox" bind:checked={shorts} aria-describedby="{id}-shorts-hint" />
        <span class="setting-words">
          <span class="setting-name">Include Shorts</span>
          <span id="{id}-shorts-hint" class="setting-hint">YouTube's short, upright videos. Sorted by YouTube's own lists, so one may slip through now and then.</span>
        </span>
        <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size={14} /></span>
      </label>
      <label class="inset-row check-row setting">
        <input type="checkbox" bind:checked={liveStreams} aria-describedby="{id}-live-hint" />
        <span class="setting-words">
          <span class="setting-name">Include live streams</span>
          <span id="{id}-live-hint" class="setting-hint">Streams, and their recordings once they end.</span>
        </span>
        <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size={14} /></span>
      </label>
    {/if}
    <label class="inset-row check-row setting">
      <input type="checkbox" bind:checked={paused} aria-describedby="{id}-pause-hint" />
      <span class="setting-words">
        <span class="setting-name">Pause for a while</span>
        <span id="{id}-pause-hint" class="setting-hint"
          >New articles skip Unread until you untick it; then its newest three come back.{#if feed.pausedAt != null}
            {pausedSince(feed.pausedAt)}{/if}</span
        >
      </span>
      <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size={14} /></span>
    </label>
  </div>
  <!-- A shortcut to Settings › Rules, already set to this source. -->
  <p class="mt-1.5 text-small">
    <button type="button" class="text-link" onclick={onAddRule}>Add a rule…</button>
  </p>
</div>

<style>
  /* The same rows as Settings.svelte's (keep the two alike, decision 0120): each choice shares its control evenly, but is never narrower than its own word. */
  .choices.setting-control {
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
