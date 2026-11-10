<!--
  One source's own settings (SPEC section 36, decision 0163): in Edit for
  someone with one source, and on a person's source's own page. A source
  that isn't working says so first, with Find new address (decision 0106),
  which moves it at once. Then its settings, a grouped list as in Settings: a
  YouTube channel's Shorts and live streams (both off, decision 0144), and
  pausing. What kind of source it is, how often it's checked and opening on
  the website are no longer settings (decision 0183): nine turtles reads the
  first from the feed, checks every feed on its own rhythm, and opens every
  article here.

  The values belong to the form around it, which saves them with the rest.
-->
<script lang="ts">
  import Dated from "./Dated.svelte";
  import FailingLine from "./FailingLine.svelte";
  import Icon from "./Icon.svelte";
  import type { Sick } from "./health";
  import type { Feed } from "./shapes";
  import { pausedSince } from "./times";

  let {
    feed,
    paused = $bindable(),
    shorts = $bindable(),
    liveStreams = $bindable(),
    onMoved,
  }: {
    feed: Feed;
    paused: boolean;
    shorts: boolean;
    liveStreams: boolean;
    /** Find new address moved it (decision 0106). */
    onMoved: (feed: Sick) => void;
  } = $props();

  const id = $props.id();
</script>

<!-- Only while it isn't working, as Everyone you follow would list it: one quiet line and Find new address. -->
<FailingLine {feed} label="Find new address" {onMoved} />

<div class="flex min-w-0 flex-col gap-2">
  <!-- Each setting's name with a short description straight under it, as in Settings (S1, decision 0120). No heading: Pause is often its only row. -->
  <div class="inset-group" role="group" aria-label="Settings">
    {#if feed.sortsVideos}
      <!-- A YouTube channel (decision 0144): both off by default, sorted by lists YouTube keeps for each channel. -->
      <label class="inset-row check-row setting">
        <input type="checkbox" bind:checked={shorts} aria-describedby="{id}-shorts-hint" />
        <span class="setting-words">
          <span class="setting-name">Include Shorts</span>
          <span id="{id}-shorts-hint" class="setting-hint">YouTube's short, upright videos. Sorted by YouTube's own lists, so one may slip through now and then.</span>
        </span>
        <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size="tick" /></span>
      </label>
      <label class="inset-row check-row setting">
        <input type="checkbox" bind:checked={liveStreams} aria-describedby="{id}-live-hint" />
        <span class="setting-words">
          <span class="setting-name">Include live streams</span>
          <span id="{id}-live-hint" class="setting-hint">Streams, and their recordings once they end.</span>
        </span>
        <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size="tick" /></span>
      </label>
    {/if}
    <label class="inset-row check-row setting">
      <input type="checkbox" bind:checked={paused} aria-describedby="{id}-pause-hint" />
      <span class="setting-words">
        <span class="setting-name">Pause for a while</span>
        <span id="{id}-pause-hint" class="setting-hint"
          >Their new articles wait until you untick this.{#if feed.pausedAt != null}
            <Dated text={pausedSince(feed.pausedAt)} />{/if}</span
        >
      </span>
      <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size="tick" /></span>
    </label>
  </div>
</div>
