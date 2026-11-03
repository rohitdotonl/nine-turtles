<!--
  A YouTube video, in YouTube's own player (the publisher floor; SPEC
  sections 7 and 38, decisions 0072 and 0144). Until Play is pressed it is
  only a quiet box in the page's tone with the video's title set large in it,
  like a book's title page: nothing loads from YouTube, so YouTube learns
  nothing about an article you only glanced at. A Short's box is tall
  (9 : 16), any other video's wide (16 : 9).

  Pressing Play swaps the box for YouTube's privacy-enhanced player, in the
  same place and size (nothing else moves), which starts at once and takes
  the keyboard, so Space and its own keys work straight away. Tab leaves it.

  It picks up where you stopped, on any device: while it plays the player
  tells this page its time, which is kept as a podcast episode's place is
  (`podcasts.ts`), and the box then says "Resume from 4:00". When the video
  ends the player closes back to the still box, so YouTube's grid of other
  videos never shows, and the place is forgotten. Nothing plays by itself.

  Under it, the chapters its description lists (decision 0144), each a
  button: pressed, the video plays from there.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { clock, devicePlace, resumeFrom, savePlace, SAVE_EVERY_MS, serverPlace, spoken } from "./podcasts";
  import { PLAYER_ORIGIN, playerAddress, playerNews, toPlayer, type Chapter } from "./youtube";

  let {
    id,
    video,
    title,
    tall = false,
    chapters = [],
  }: {
    /** The article's number, whose place is kept. */
    id: number;
    video: string;
    title: string;
    /** A Short: a tall box. */
    tall?: boolean;
    chapters?: Chapter[];
  } = $props();

  let playing = $state(false);
  let frame: HTMLIFrameElement | undefined = $state();
  /** Where the player starts: where you stopped, or a chapter you pressed. */
  let start = $state(0);
  /** Where you stopped last time, for "Resume from 4:00"; 0 to start at the beginning. */
  let resume = $state((() => resumeFrom(undefined, devicePlace(id)))());
  void serverPlace((() => id)()).then((server) => {
    if (!playing) resume = resumeFrom(server, devicePlace(id));
  });

  /** What the player last said: its time and length. */
  let time = 0;
  let duration: number | null = null;
  let heard = false;
  let lastSaved = 0;

  function play(from = resume) {
    start = from;
    time = from;
    heard = false;
    playing = true;
  }

  function send(message: string) {
    frame?.contentWindow?.postMessage(message, PLAYER_ORIGIN);
  }

  function keep(done = false) {
    if (!heard) return;
    lastSaved = Date.now();
    savePlace(id, done ? (duration ?? time) : time, duration, done);
  }

  /** A chapter pressed: the player moves there, or starts there. */
  function jump(at: number) {
    if (playing && heard) {
      send(toPlayer("command", "seekTo", [at, true]));
      send(toPlayer("command", "playVideo"));
      frame?.focus();
    } else play(at);
  }

  function listen(event: MessageEvent) {
    if (event.origin !== PLAYER_ORIGIN || !frame || event.source !== frame.contentWindow) return;
    const news = playerNews(event.data);
    if (!news) return;
    heard = true;
    if (news.time !== undefined) time = news.time;
    if (news.duration !== undefined) duration = news.duration;
    if (news.state === "ended") {
      // The video ends when it ends: back to the still box, from the start next time.
      keep(true);
      resume = 0;
      playing = false;
    } else if (news.state === "paused" || (news.state === "playing" && Date.now() - lastSaved >= SAVE_EVERY_MS)) {
      keep();
    }
  }

  $effect(() => {
    if (!playing || !frame) return;
    frame.focus();
    window.addEventListener("message", listen);
    // The player answers only once it's ready: ask it to talk as it loads, and again until it does.
    const asking = window.setInterval(() => (heard ? window.clearInterval(asking) : send(toPlayer("listening"))), 250);
    return () => {
      window.clearInterval(asking);
      window.removeEventListener("message", listen);
    };
  });

  // Leaving the video while it plays keeps where you are.
  onDestroy(() => {
    if (playing) keep();
  });
</script>

<div class={["video", tall && "tall"]}>
  {#if playing}
    <!--
      YouTube's player refuses to play without knowing which site shows it, so
      it alone is told nine turtles' address (only that, never the article's).
      The sandbox lets it run its own player and open YouTube in a new tab, nothing more.
    -->
    <iframe
      bind:this={frame}
      src={playerAddress(video, start, location.origin)}
      title="YouTube video: {title}"
      onload={() => send(toPlayer("listening"))}
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      allowfullscreen
      referrerpolicy="strict-origin"
      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
    ></iframe>
  {:else}
    <button
      type="button"
      class="video-play"
      aria-label={resume > 0 ? `Resume video from ${spoken(resume)}: ${title}` : `Play video: ${title}`}
      onclick={() => play()}
    >
      <span class="video-title" aria-hidden="true">{title}</span>
      <span class="video-word" aria-hidden="true">
        <span class="video-mark">
          <svg width="16" height="16" viewBox="0 0 20 20"><path d="M7 4.8v10.4a.6.6 0 0 0 .9.5l8.2-5.2a.6.6 0 0 0 0-1L7.9 4.3a.6.6 0 0 0-.9.5z" fill="currentColor" /></svg>
        </span>
        {resume > 0 ? `Resume from ${clock(resume)}` : "Play video"}
      </span>
    </button>
  {/if}
</div>
{#if chapters.length > 0}
  <!-- The chapters, as the description lists them: each plays the video from there. -->
  <ol class="chapters" aria-label="Chapters">
    {#each chapters as chapter (chapter.at)}
      <li>
        <button type="button" class="chapter" aria-label="Play from {spoken(chapter.at)}: {chapter.title}" onclick={() => jump(chapter.at)}>
          <span class="chapter-time">{clock(chapter.at)}</span>
          <span>{chapter.title}</span>
        </button>
      </li>
    {/each}
  </ol>
{/if}

<style>
  .video {
    margin-top: 1.75em;
    aspect-ratio: 16 / 9;
    width: 100%;
  }
  /* A Short stands up, no wider than a phone's screen, so its whole height fits on a computer too. */
  .video.tall {
    aspect-ratio: 9 / 16;
    width: min(100%, 20rem);
  }
  .video > :global(*) {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    border-radius: 8px;
  }
  /*
    The box before Play: the page's own faint tone, the title set large in
    the reading face, then a round mark in the text color and the word, so
    it reads as a button by its shape and its word, never by color.
  */
  .video-play {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 1rem 1.5rem;
    background-color: var(--tone);
    color: var(--ink);
    font-family: var(--font-sans);
    font-size: var(--text-ui);
    cursor: pointer;
    overflow: hidden;
  }
  .video-play:hover {
    background-color: color-mix(in srgb, var(--ink) 10%, transparent);
  }
  .video-title {
    max-width: 22ch;
    font-family: var(--font-serif);
    font-size: clamp(1.1rem, 3.4vw, 1.5rem);
    font-weight: 600;
    line-height: 1.2;
    text-align: center;
    text-wrap: balance;
    overflow-wrap: break-word;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    overflow: hidden;
  }
  .video-word {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }
  .video-mark {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 999px;
    background-color: var(--ink);
    color: var(--paper);
  }
  /* The triangle looks centred a little right of the middle, as a play mark does. */
  .video-mark svg {
    margin-left: 2px;
  }
  .chapters {
    margin: 1rem 0 0;
    padding: 0;
    list-style: none;
    font-family: var(--font-sans);
    font-size: var(--text-ui);
  }
  .chapter {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 2.75rem;
    width: 100%;
    text-align: left;
    color: var(--ink);
    cursor: pointer;
  }
  .chapter-time {
    min-width: 3.5em;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
  }
  .chapter:hover .chapter-time {
    text-decoration-thickness: 2px;
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
