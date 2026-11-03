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

  It plays at the speed last chosen in a video on this device: YouTube's
  player remembers captions by itself, but not speed (decision 0156).

  Under it, the chapters its description lists (decision 0144), each a
  button: pressed, the video plays from there.
-->
<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { clock, devicePlace, resumeFrom, savePlace, SAVE_EVERY_MS, serverPlace } from "./podcasts";
  import { deviceText, setDeviceText } from "./device";
  import { PLAYER_ORIGIN, playerAddress, playerNews, toPlayer, VIDEO_SPEED_KEY, videoSpeed, type Chapter } from "./youtube";

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
  let box: HTMLButtonElement | undefined = $state();
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
  /** The player's last state: its regular time updates don't repeat it. */
  let playerState: "playing" | "paused" | "ended" | undefined;
  /** The speed this video should play at, and whether the player has taken it: until then, the player's own 1× is not a choice. */
  let speed = 1;
  let speedTaken = true;

  function play(from = resume) {
    start = from;
    time = from;
    heard = false;
    playerState = undefined;
    speed = videoSpeed(deviceText(VIDEO_SPEED_KEY));
    speedTaken = speed === 1;
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

  function giveSpeed() {
    send(toPlayer("command", "setPlaybackRate", [speed]));
  }

  /** The player's speed: until it has taken this device's, ask again; after, a change is the reader's, kept for the next video. */
  function heardSpeed(rate: number) {
    if (!speedTaken) {
      if (rate === speed) speedTaken = true;
      else giveSpeed();
    } else if (rate !== speed) {
      speed = rate;
      setDeviceText(VIDEO_SPEED_KEY, rate === 1 ? null : String(rate));
    }
  }

  function listen(event: MessageEvent) {
    if (event.origin !== PLAYER_ORIGIN || !frame || event.source !== frame.contentWindow) return;
    const news = playerNews(event.data);
    if (!news) return;
    if (!heard) {
      send(toPlayer("command", "addEventListener", ["onPlaybackRateChange"]));
      if (!speedTaken) giveSpeed();
    }
    heard = true;
    if (news.rate !== undefined) heardSpeed(news.rate);
    if (news.time !== undefined) time = news.time;
    if (news.duration !== undefined) duration = news.duration;
    const changed = news.state !== undefined && news.state !== playerState;
    if (news.state) playerState = news.state;
    // An advert before the video plays at its own speed: give the video this device's once it starts.
    if (changed && playerState === "playing" && !speedTaken) giveSpeed();
    if (playerState === "ended") {
      // The video ends when it ends: back to the still box, from the start next time, with the keyboard on it.
      keep(true);
      resume = 0;
      playing = false;
      playerState = undefined;
      void tick().then(() => box?.focus());
    } else if ((changed && playerState === "paused") || (playerState === "playing" && Date.now() - lastSaved >= SAVE_EVERY_MS)) {
      keep();
    }
  }

  $effect(() => {
    if (!playing || !frame) return;
    frame.focus();
    window.addEventListener("message", listen);
    // The player answers only once it's ready: ask it to talk as it loads, and again until it does (for ten seconds at most).
    let asked = 0;
    const asking = window.setInterval(() => (heard || ++asked > 40 ? window.clearInterval(asking) : send(toPlayer("listening"))), 250);
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
    <!-- Named by its visible words first, so voice control finds it by what it says. -->
    <button
      bind:this={box}
      type="button"
      class="video-play"
      aria-label={resume > 0 ? `Resume from ${clock(resume)}: ${title}` : `Play video: ${title}`}
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
        <button type="button" class="chapter" onclick={() => jump(chapter.at)}>
          <span class="chapter-time">{clock(chapter.at)}</span>
          <span>{chapter.title}</span>
        </button>
      </li>
    {/each}
  </ol>
{/if}

<style>
  /* The shape is the box's and the player's own, so large text can make the box taller rather than cut its words. */
  .video {
    margin-top: 1.75em;
    width: 100%;
    --shape: 16 / 9;
  }
  /* A Short stands up, no wider than a phone's screen, so its whole height fits on a computer too. */
  .video.tall {
    width: min(100%, 20rem);
    --shape: 9 / 16;
  }
  .video > :global(*) {
    display: block;
    width: 100%;
    aspect-ratio: var(--shape);
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
  }
  .video-play:hover {
    background-color: color-mix(in srgb, var(--ink) 10%, transparent);
  }
  .video-title {
    max-width: 22ch;
    font-family: var(--font-serif);
    font-size: var(--text-large);
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
