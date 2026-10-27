<!--
  A podcast episode's player, under the article's byline (SPEC section 35,
  decision 0113). A calm, still panel in a faint tone of the text: back 15
  seconds, Play or Pause, forward 30, the speed (1×, 1.25×, 1.5×, 2×, one
  press each), then the position as a slider with the time played and the
  time left under it, in figures that keep their width. Nothing moves but the
  slider's own mark and the times; no waveform, no animation. The episode's
  show notes follow as the article's text.

  It plays the publisher's own file, from the publisher's own address, in
  the browser's own audio element (player.svelte.ts), as the second floor
  says an audio file the feed names plays. Playing
  carries on while the reader moves to other articles, in the bar at the
  foot of the app. It opens where the reader stopped, on any of their devices.

  Every control is a real button or slider, named for screen readers, at
  least 44px to press. The slider says the time in words ("12 minutes 3
  seconds of 45 minutes"). Space is left to scroll the article: the player
  takes no keys of its own beyond its controls' standard ones.

  When the episode is in Up Next, a quiet line says where, with Move up,
  Move down and Remove. Move up and Move down stay where the keyboard is at
  either end (they say they can't go further, rather than vanishing from
  under it); Remove leaves "Removed from Up Next." with Undo in its place,
  and the keyboard on Undo, which puts the episode back and the keyboard on
  Remove again.
-->
<script lang="ts">
  import { tick, untrack } from "svelte";
  import type { Article } from "./feeds";
  import { BACK_SECONDS, FORWARD_SECONDS, clock, devicePlace, left, length, nextSpeed, resumeFrom, serverPlace, speedLabel, spoken, type Episode } from "./podcasts";
  import { isLoaded, load, moveInUpNext, play, player, removeFromUpNext, seek, setRate, toggle, undoRemove } from "./player.svelte";

  let { article, episode }: { article: Article; episode: Episode } = $props();

  /** This episode is the one in the player (playing or paused). */
  let mine = $derived(player.current?.article.id === article.id);
  /** Before it's in the player: where the reader stopped, so the times say where Play will start. */
  let saved = $state(0);
  let position = $derived(mine ? player.position : saved);
  let duration = $derived(mine ? (player.duration ?? episode.seconds) : episode.seconds);
  let playing = $derived(mine && player.playing);

  $effect(() => {
    const id = article.id;
    saved = 0;
    untrack(() => {
      const device = devicePlace(id);
      saved = resumeFrom(undefined, device);
      void serverPlace(id).then((server) => {
        if (article.id === id) saved = resumeFrom(server, devicePlace(id));
      });
    });
  });

  let place = $derived(player.upNext ? player.upNext.indexOf(article.id) : -1);
  /** Taken off Up Next by hand just now (here or from the More menu): Undo puts it back. */
  let gone = $derived(place === -1 && player.removed?.id === article.id);
  let removeButton: HTMLButtonElement | undefined = $state();
  let undoButton: HTMLButtonElement | undefined = $state();

  // Another episode's Undo isn't offered here, nor kept once the reader has moved on to this one.
  $effect(() => {
    const id = article.id;
    untrack(() => {
      if (player.removed && player.removed.id !== id) player.removed = undefined;
    });
  });

  /** Move up or down; at either end the button stays (and keeps the keyboard), it just does nothing. */
  function move(step: -1 | 1) {
    const end = step === -1 ? place === 0 : place === (player.upNext?.length ?? 0) - 1;
    if (!end) void moveInUpNext(article.id, step);
  }

  async function remove() {
    if (!(await removeFromUpNext(article.id))) return;
    await tick();
    undoButton?.focus();
  }

  async function undo() {
    if (!(await undoRemove())) return;
    await tick();
    removeButton?.focus();
  }

  async function pressPlay() {
    if (mine) toggle();
    else await play(article, episode);
  }

  /** Moving through an episode that isn't in the player yet puts it there first, at that place. */
  async function goTo(seconds: number) {
    if (!isLoaded(article)) await load(article, episode);
    seek(seconds);
  }

  function slid(event: Event) {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    if (mine) seek(value);
    else {
      saved = value;
      void goTo(value);
    }
  }
</script>

<div class="episode" role="group" aria-label="Episode player">
  <div class="episode-controls">
    <button type="button" class="episode-button" aria-label="Back {BACK_SECONDS} seconds" title="Back {BACK_SECONDS} seconds" onclick={() => goTo(position - BACK_SECONDS)}>
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
        ><path d="M4.25 10a5.75 5.75 0 1 0 1.7-4.08" /><path d="M4 3.5v3h3" /><text x="10" y="12.4" text-anchor="middle" font-size="5.6" stroke="none" fill="currentColor" font-family="system-ui, sans-serif">15</text></svg
      >
    </button>
    <!-- The one round, filled mark, in the text color: Play or Pause, by its shape and its name. -->
    <button type="button" class="episode-play" aria-label={playing ? "Pause" : "Play"} title={playing ? "Pause" : "Play"} onclick={pressPlay}>
      {#if playing}
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20"><rect x="5.5" y="4.5" width="3" height="11" rx=".75" fill="currentColor" /><rect x="11.5" y="4.5" width="3" height="11" rx=".75" fill="currentColor" /></svg>
      {:else}
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" class="ml-[2px]"><path d="M6.5 4.6v10.8a.6.6 0 0 0 .9.5l8.4-5.4a.6.6 0 0 0 0-1L7.4 4.1a.6.6 0 0 0-.9.5z" fill="currentColor" /></svg>
      {/if}
    </button>
    <button type="button" class="episode-button" aria-label="Forward {FORWARD_SECONDS} seconds" title="Forward {FORWARD_SECONDS} seconds" onclick={() => goTo(position + FORWARD_SECONDS)}>
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
        ><path d="M15.75 10a5.75 5.75 0 1 1-1.7-4.08" /><path d="M16 3.5v3h-3" /><text x="10" y="12.4" text-anchor="middle" font-size="5.6" stroke="none" fill="currentColor" font-family="system-ui, sans-serif">30</text></svg
      >
    </button>
    <span class="episode-length">
      {#if episode.seconds}{length(episode.seconds)}<span class="sr-only"> long</span>{/if}
    </span>
    <button
      type="button"
      class="episode-speed"
      aria-label="Speed, {player.rate} times. Change speed"
      title="Speed"
      onclick={() => setRate(nextSpeed(player.rate))}>{speedLabel(player.rate)}</button
    >
  </div>
  <label class="sr-only" for="episode-position-{article.id}">Position</label>
  <input
    id="episode-position-{article.id}"
    type="range"
    class="episode-slider"
    min="0"
    max={duration ?? Math.max(position, 1)}
    step="1"
    value={Math.min(position, duration ?? position)}
    aria-valuetext={duration ? `${spoken(position)} of ${spoken(duration)}` : spoken(position)}
    disabled={!duration && !mine}
    onchange={slid}
    oninput={(event) => mine && seek(Number((event.currentTarget as HTMLInputElement).value))}
  />
  <div class="episode-times" aria-hidden="true">
    <span>{clock(position)}</span>
    <span>{duration ? left(position, duration) : ""}</span>
  </div>
  <p class="episode-note empty:hidden" role="status">{mine && player.waiting ? "Loading from the publisher…" : ""}</p>
  {#if mine && !player.waiting && player.said}
    <!-- Seen here; screen readers hear it once, from the Now playing bar's own line. -->
    <p class="episode-note">{player.said}</p>
  {/if}
  {#if place !== -1 && player.upNext}
    <!-- Where it waits in Up Next, and moving it, by real buttons rather than dragging (SPEC section 35). -->
    <div class="episode-queue">
      <span class="mr-auto">In Up Next, {place + 1} of {player.upNext.length}</span>
      <button type="button" class="btn-quiet btn-small" aria-disabled={place === 0} onclick={() => move(-1)}>Move up</button>
      <button type="button" class="btn-quiet btn-small" aria-disabled={place === player.upNext.length - 1} onclick={() => move(1)}>Move down</button>
      <button type="button" class="btn-quiet btn-small" bind:this={removeButton} onclick={remove}>Remove<span class="sr-only"> from Up Next</span></button>
    </div>
  {:else if gone}
    <div class="episode-queue">
      <span class="mr-auto">Removed from Up Next.</span>
      <button type="button" class="btn-quiet btn-small" bind:this={undoButton} onclick={undo}>Undo<span class="sr-only"> removing from Up Next</span></button>
    </div>
  {/if}
</div>

<style>
  /* A still panel in a faint tone of the text, like the video's box, 12px corners. */
  .episode {
    margin-top: 1.5em;
    padding: 0.75rem 1rem 0.875rem;
    border-radius: 12px;
    background-color: var(--tone);
    font-family: var(--font-sans);
    font-size: var(--text-small);
    color: var(--ink-2);
  }
  .episode-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .episode-button,
  .episode-speed {
    display: flex;
    min-width: 2.75rem;
    min-height: 2.75rem;
    align-items: center;
    justify-content: center;
    border-radius: 0.375rem;
    color: var(--ink-2);
    cursor: pointer;
  }
  .episode-button:hover,
  .episode-speed:hover {
    background-color: color-mix(in srgb, var(--ink) 8%, transparent);
  }
  .episode-speed {
    padding-inline: 0.5rem;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .episode-play {
    display: flex;
    width: 3rem;
    height: 3rem;
    flex: none;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background-color: var(--ink);
    color: var(--paper);
    cursor: pointer;
  }
  .episode-length {
    margin-left: auto;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  /* The native slider, in the text color: never the accent, which marks only what's yours to look at. */
  .episode-slider {
    display: block;
    width: 100%;
    min-height: 2.75rem;
    margin-top: 0.25rem;
    accent-color: var(--ink);
    cursor: pointer;
  }
  .episode-slider:disabled {
    cursor: default;
  }
  .episode-times {
    display: flex;
    justify-content: space-between;
    margin-top: -0.375rem;
    color: var(--muted);
    font-size: var(--text-meta);
    font-variant-numeric: tabular-nums;
  }
  .episode-note {
    margin-top: 0.5rem;
    color: var(--ink-2);
  }
  .episode-queue {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid color-mix(in srgb, var(--ink) 9%, transparent);
  }
  .episode-queue button[aria-disabled="true"] {
    opacity: 0.5;
    cursor: default;
  }
  @media (forced-colors: active) {
    .episode {
      border: 1px solid CanvasText;
    }
    .episode-play {
      background-color: ButtonText;
      color: ButtonFace;
    }
  }
</style>
