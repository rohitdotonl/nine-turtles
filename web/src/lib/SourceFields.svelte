<!--
  One source's own settings (SPEC section 36, decision 0163): in a
  publication's Edit, under its name, and on a person's source's own page.
  A source that isn't working says so first, with Find new address (decision
  0106), which moves it at once. Then what kind of source it is (read from the
  feed, and the reader corrects it), then the settings a grouped list as in
  Settings: how often it's checked, opening on the website, a
  YouTube channel's Shorts and live streams (both off, decision 0144), and
  pausing.

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
    place = $bindable(),
    check = $bindable(),
    openOnSite = $bindable(),
    paused = $bindable(),
    shorts = $bindable(),
    liveStreams = $bindable(),
    onMoved,
  }: {
    feed: Feed;
    place: PlaceKind;
    check: Check;
    openOnSite: boolean;
    paused: boolean;
    shorts: boolean;
    liveStreams: boolean;
    /** Find new address moved it (decision 0106). */
    onMoved: (feed: Sick) => void;
  } = $props();

  const CHECK_CHOICES: { value: Check; label: string }[] = [
    { value: "automatic", label: "Automatic" },
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
        <p id="{id}-check" class="setting-name">Check for new articles</p>
        <p id="{id}-check-hint" class="setting-hint">
          {check === "daily" ? "No more often than once a day." : "As often as it usually posts."}
        </p>
      </div>
      <div role="group" aria-labelledby="{id}-check" aria-describedby="{id}-check-hint" class="choices setting-control" style="--columns: 2">
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
