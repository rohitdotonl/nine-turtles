<!--
  A YouTube video, in YouTube's own player (the publisher floor; SPEC section
  7, decision 0071). Until Play is pressed it is only a quiet box in the
  page's tone: nothing loads from YouTube, so YouTube learns nothing about an
  article you only glanced at. Pressing Play swaps the box for YouTube's
  privacy-enhanced player, in the same place and size (nothing else moves),
  which starts at once and takes the keyboard, so Space and its own keys
  work straight away. Tab leaves it.
-->
<script lang="ts">
  import { playerAddress } from "./youtube";

  let { video, title }: { video: string; title: string } = $props();

  let playing = $state(false);
  let frame: HTMLIFrameElement | undefined = $state();

  $effect(() => {
    if (playing) frame?.focus();
  });
</script>

<div class="video">
  {#if playing}
    <!--
      YouTube's player refuses to play without knowing which site shows it, so
      it alone is told nine turtles' address (only that, never the article's).
      The sandbox lets it run its own player and open YouTube in a new tab, nothing more.
    -->
    <iframe
      bind:this={frame}
      src={playerAddress(video)}
      title="YouTube video: {title}"
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      allowfullscreen
      referrerpolicy="strict-origin"
      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
    ></iframe>
  {:else}
    <button type="button" class="video-play" aria-label="Play video: {title}" aria-describedby="video-note" onclick={() => (playing = true)}>
      <span class="video-mark" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 20 20"><path d="M7 4.8v10.4a.6.6 0 0 0 .9.5l8.2-5.2a.6.6 0 0 0 0-1L7.9 4.3a.6.6 0 0 0-.9.5z" fill="currentColor" /></svg>
      </span>
      <span aria-hidden="true">Play video</span>
    </button>
  {/if}
</div>
<p id="video-note" class="video-note" lang="en">
  {playing ? "Playing in YouTube's own player." : "Plays in YouTube's own player. Nothing loads until you press Play."}
</p>

<style>
  .video {
    margin-top: 1.75em;
    aspect-ratio: 16 / 9;
    width: 100%;
  }
  .video > :global(*) {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    border-radius: 8px;
  }
  /*
    The box before Play: the page's own faint tone, a round mark in the text
    color with the page's color inside, and the word under it, so it reads as
    a button by its shape and its word, never by color.
  */
  .video-play {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    background-color: var(--tone);
    color: var(--ink);
    font-family: var(--font-sans);
    font-size: var(--text-ui);
    cursor: pointer;
  }
  .video-play:hover {
    background-color: color-mix(in srgb, var(--ink) 10%, transparent);
  }
  .video-mark {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 999px;
    background-color: var(--ink);
    color: var(--paper);
  }
  /* The triangle looks centred a little right of the middle, as a play mark does. */
  .video-mark svg {
    margin-left: 3px;
  }
  .video-note {
    margin-top: 0.5rem;
    font-family: var(--font-sans);
    font-size: var(--text-small);
    line-height: 1.4;
    text-wrap: pretty;
    color: var(--ink-2);
  }
  @media (forced-colors: active) {
    .video-play {
      border: 1px solid ButtonText;
    }
    .video-mark {
      background-color: ButtonText;
      color: ButtonFace;
    }
  }
</style>
