<!--
  A YouTube video, in YouTube's own player (the publisher floor; SPEC
  sections 7 and 38, decisions 0072, 0144 and 0324). Until Play is pressed it
  is only a box drawn in ink on the page, with a round Play mark and its word
  (the title is the page's own, just above): nothing loads from YouTube, so
  YouTube learns nothing about an article you only glanced at. A Short's box is tall
  (9 : 16), any other video's wide (16 : 9).

  Pressing Play swaps the box for YouTube's privacy-enhanced player, in the
  same place and size (nothing else moves); until that player has loaded, the
  box stays over it, filled charcoal at once so the step to the player is dark to dark, saying "Starting the video…" once that takes half a second (decision 0230), and
  "Still starting… YouTube can be slow to answer." after five, its dots breathing (decision 0287). The player
  starts at once and takes the keyboard, so Space and its own keys work straight away. Tab leaves it.

  It picks up where you stopped, on any device: while it plays the player
  tells this page its time, which is kept as a podcast episode's place is
  (`podcasts.ts`), and the box then says "Resume from 4:00". When the video
  ends the player closes back to the still box, so YouTube's grid of other
  videos never shows, and the place is forgotten. Nothing plays by itself.

  It plays at the speed last chosen in a video on this device: YouTube's
  player remembers captions by itself, but not speed (decision 0156).

  Under it, two words, each a disclosure button with the sidebar folders'
  chevron (decision 0324): Chapters (when the description lists them) and
  Description (when there is one). Both start closed; one opens at a time,
  and this device remembers which was left open. The chapters are a
  contents page, each a button that plays the video from there, the one
  playing in semibold. The description itself is the article's text
  (ArticleView), shown only while Description is open.
-->
<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import SlowWait from "./SlowWait.svelte";
  import Icon from "./Icon.svelte";
  import { clock, devicePlace, resumeFrom, savePlace, SAVE_EVERY_MS, serverPlace } from "./podcasts";
  import { deviceText, setDeviceText } from "./device";
  import { chapterAt, PLAYER_ORIGIN, playerAddress, playerNews, toPlayer, VIDEO_OPEN_KEY, VIDEO_SPEED_KEY, videoSpeed, type Chapter, type VideoOpen } from "./youtube";

  let {
    id,
    video,
    title,
    tall = false,
    chapters = [],
    description = false,
    open = $bindable(null),
  }: {
    /** The article's number, whose place is kept. */
    id: number;
    video: string;
    title: string;
    /** A Short: a tall box. */
    tall?: boolean;
    chapters?: Chapter[];
    /** Whether the video has a description, which ArticleView shows while `open` is "description". */
    description?: boolean;
    /** What's open under the video: its chapters, its description, or neither. */
    open?: VideoOpen;
  } = $props();

  /** What's open, only if this video has it. */
  let shown: VideoOpen = $derived(open === "chapters" && chapters.length > 0 ? "chapters" : open === "description" && description ? "description" : null);

  /** Opens one of the two (closing the other), or closes it if it's open; this device remembers. */
  function toggle(which: "chapters" | "description") {
    open = shown === which ? null : which;
    setDeviceText(VIDEO_OPEN_KEY, open);
  }

  let playing = $state(false);
  /** YouTube's player has loaded in the frame: until then the box stays over it, saying "Starting the video…" (decision 0230). */
  let started = $state(false);
  let frame: HTMLIFrameElement | undefined = $state();
  let box: HTMLButtonElement | undefined = $state();
  /** Where the player starts: where you stopped, or a chapter you pressed. */
  let start = $state(0);
  /** Where you stopped last time, for "Resume from 4:00"; 0 to start at the beginning. */
  let resume = $state((() => resumeFrom(undefined, devicePlace(id)))());
  void serverPlace((() => id)()).then((server) => {
    if (!playing) resume = resumeFrom(server, devicePlace(id));
  });

  /** What the player last said: its time (which marks the chapter playing) and length. */
  let time = $state(0);
  let duration: number | null = null;
  let heard = $state(false);
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
    started = false;
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

  /** The chapter playing, once the player has said where it is. */
  let current = $derived(playing && heard ? chapterAt(chapters, time) : undefined);

  /** Where the video is, in seconds, once it plays here; null before (a note starts with it, SPEC section 42). */
  export function now(): number | null {
    return playing && heard ? time : null;
  }

  /** A chapter pressed, or a time in a note: the player moves there, or starts there. */
  export function jump(at: number) {
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
      onload={() => ((started = true), send(toPlayer("listening")))}
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      allowfullscreen
      referrerpolicy="strict-origin"
      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
    ></iframe>
    {#if !started}
      <!-- The box stays, in the player's place and size, until YouTube's player has loaded; after half a second it says so. -->
      <div class="video-play video-starting">
        <p class="min-h-6"><SlowWait words="Starting the video" again="Still starting" why="YouTube can be slow to answer." /></p>
      </div>
    {/if}
  {:else}
    <!-- Named by its visible words first, so voice control finds it by what it says. -->
    <button
      bind:this={box}
      type="button"
      class="video-play"
      aria-label={resume > 0 ? `Resume from ${clock(resume)}: ${title}` : `Play video: ${title}`}
      onclick={() => play()}
    >
      <span class="video-word" aria-hidden="true">
        <span class="video-mark">
          <!-- Its balance point (a third in from its flat side) at the circle's centre, as the eye centres a triangle. -->
          <svg width="18" height="18" viewBox="0 0 20 20"><path d="M7 4.8v10.4a.6.6 0 0 0 .9.5l8.2-5.2a.6.6 0 0 0 0-1L7.9 4.3a.6.6 0 0 0-.9.5z" fill="currentColor" /></svg>
        </span>
        {resume > 0 ? `Resume from ${clock(resume)}` : "Play video"}
      </span>
    </button>
  {/if}
</div>
{#if chapters.length > 0 || description}
  <!-- Two words under the video, each opening its own part in place (decision 0324). -->
  <div class="video-parts">
    {#if chapters.length > 0}
      <button type="button" class="video-part" aria-expanded={shown === "chapters"} aria-controls="video-chapters" onclick={() => toggle("chapters")}>
        Chapters <span class="video-count">{chapters.length}</span><Icon name={shown === "chapters" ? "chevron-up" : "chevron-down"} />
      </button>
    {/if}
    {#if description}
      <button type="button" class="video-part" aria-expanded={shown === "description"} aria-controls="article-text" onclick={() => toggle("description")}>
        Description<Icon name={shown === "description" ? "chevron-up" : "chevron-down"} />
      </button>
    {/if}
  </div>
{/if}
{#if chapters.length > 0}
  <!-- The chapters, as the description lists them, like a book's contents: each plays the video from there. -->
  <ol id="video-chapters" class="chapters" aria-label="Chapters" hidden={shown !== "chapters"}>
    {#each chapters as chapter (chapter.at)}
      <li>
        <button type="button" class="chapter" aria-current={current === chapter ? "time" : undefined} onclick={() => jump(chapter.at)}>
          <span>{chapter.title}</span>
          <span class="chapter-time">{clock(chapter.at)}</span>
        </button>
      </li>
    {/each}
  </ol>
{/if}

<style>
  /* The shape is the box's and the player's own, so large text can make the box taller rather than cut its words. */
  .video {
    position: relative;
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
    border-radius: var(--radius-hold);
  }
  iframe {
    border: 0;
  }
  /*
    The box before Play (decision 0324, after 0072 and 0298): drawn in ink
    on the page, as Write back is, with a round ink mark and the word in it,
    so it reads as a button by its shape and its word, never by color.
    Pressed, it fills charcoal at once (each theme's --video-starting), so
    the step to YouTube's dark player is dark to dark, never a flash; its
    light words keep at least 7 : 1 on it.
  */
  .video-play {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border: 1.5px solid var(--ink);
    background-color: var(--paper);
    color: var(--ink);
    font-family: var(--font-sans);
    font-size: var(--text-ui);
    cursor: pointer;
  }
  /* Over the loading player, the same box, filled charcoal and not a button any more. */
  .video-starting {
    position: absolute;
    inset: 0;
    cursor: default;
    border-color: var(--video-starting);
    background-color: var(--video-starting);
    color: #f2f2ee;
  }
  button.video-play:hover {
    background-color: var(--fill);
  }
  .video-word {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .video-mark {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 999px;
    background-color: var(--ink);
    color: var(--paper);
  }
  /*
    The two words under the video (decision 0324): the interface's face,
    each a 44px disclosure with the folders' chevron; the open one is
    semibold and its chevron points up, so it's never told by color.
  */
  .video-parts {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    margin-top: 0.75rem;
  }
  .video-part {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    min-height: 2.75rem;
    padding-inline: 0.75rem;
    font-family: var(--font-sans);
    font-size: var(--text-ui);
    color: var(--ink);
    cursor: pointer;
  }
  .video-part[aria-expanded="true"] {
    font-weight: 600;
  }
  .video-part :global(svg),
  .video-count {
    color: var(--muted);
  }
  .video-count {
    font-weight: 400;
    font-size: var(--text-meta);
    font-variant-numeric: tabular-nums;
  }
  .video-part:hover {
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 4px;
  }
  /*
    The chapters (decision 0324): a contents page in the reading face, one
    column, the name first and its time quiet at the end (a plain zero);
    the one playing is semibold; the name underlines under the pointer.
  */
  .chapters {
    margin: 0.5rem 0 0;
    padding: 0;
    list-style: none;
    font-family: var(--reading-font);
    font-size: 0.85em;
  }
  .chapter {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    min-height: 2.75rem;
    width: 100%;
    padding-block: 0.5rem;
    text-align: left;
    color: var(--ink);
    cursor: pointer;
  }
  .chapter[aria-current] > :first-child {
    font-weight: 600;
  }
  .chapter-time {
    flex: none;
    font-family: var(--font-sans);
    font-size: var(--text-meta);
    font-variant-numeric: tabular-nums;
    color: var(--muted);
  }
  .chapter:hover > :first-child {
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 4px;
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
