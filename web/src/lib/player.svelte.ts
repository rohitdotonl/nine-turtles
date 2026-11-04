// The one podcast player (SPEC section 35, decision 0113): a single audio
// element for the whole app, so an episode keeps playing while the reader
// moves through other articles, with the "now playing" bar at the foot of
// the app. It plays the publisher's own file from the publisher's own
// address: nothing goes through nine turtles.
//
// Where the reader is gets saved every 15 seconds while playing, on pause,
// on seeking and on leaving the page, on this device at once and on the
// server behind (podcasts.ts). An episode saved within 30 seconds of its
// end is finished and marked read; one that plays to its end stops there,
// with a quiet line saying so: you play the episode you opened (Up Next was
// removed in step 5 of the owner's review).
//
// Signing out empties the player and
// forgets this device's places (`forgetListening`), so the next reader on
// this browser never hears or resumes the last one's episode. The lock screen and headphones get
// the title, the podcast's name and its picture, and can play, pause and
// skip (the Media Session API, where the browser has it).

import type { Article } from "./shapes";
import { markRead } from "./saving";
import {
  BACK_SECONDS,
  FORWARD_SECONDS,
  SAVE_EVERY_MS,
  SPEEDS,
  devicePlace,
  finished,
  forgetPlaces,
  resumeFrom,
  savePlace,
  serverPlace,
  type Episode,
} from "./podcasts";
import { deviceText, setDeviceText } from "./device";

/** The episode loaded in the player: its article (as the list shows it) and its audio. */
export type Playing = { article: Article; episode: Episode };

const SPEED_KEY = "nine-turtles.speed";

function storedSpeed(): number {
  const value = Number(deviceText(SPEED_KEY));
  return (SPEEDS as readonly number[]).includes(value) ? value : 1;
}

export const player = $state({
  /** The episode in the player, playing or paused; none until one is played. */
  current: undefined as Playing | undefined,
  playing: false,
  /** Waiting for the publisher's file to start (or to carry on). */
  waiting: false,
  position: 0,
  /** How long it plays: from the file once it's known, else the feed's word. */
  duration: null as number | null,
  /** The speed, on this device: 1, 1.25, 1.5 or 2. */
  rate: storedSpeed(),
  /** A quiet line for screen readers and the bar: "Finished.", or a problem. */
  said: "",
  /** The episode whose own player is on screen now, if any: on a phone the Now playing bar steps aside for it. */
  inView: undefined as number | undefined,
});

let audio: HTMLAudioElement | undefined;
let lastSaved = 0;
/** The position to start from once the file says how long it is. */
let startAt = 0;
/** The episode's number, kept apart from the state so the audio's own events can tell it's still the same. */
let loadedId: number | undefined;

function element(): HTMLAudioElement {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = "metadata";
  // The file is the publisher's, fetched by the browser from the publisher; the page's
  // "no-referrer" rule means nine turtles' address isn't sent with it.
  audio.addEventListener("loadedmetadata", () => {
    if (!audio) return;
    if (Number.isFinite(audio.duration) && audio.duration > 0) player.duration = audio.duration;
    if (startAt > 0 && (player.duration === null || startAt < player.duration)) audio.currentTime = startAt;
    startAt = 0;
    audio.playbackRate = player.rate;
    showPosition();
  });
  audio.addEventListener("durationchange", () => {
    if (audio && Number.isFinite(audio.duration) && audio.duration > 0) player.duration = audio.duration;
  });
  audio.addEventListener("timeupdate", () => {
    if (!audio) return;
    player.position = audio.currentTime;
    if (player.playing && Date.now() - lastSaved >= SAVE_EVERY_MS) save();
  });
  audio.addEventListener("play", () => {
    player.playing = true;
    sessionState("playing");
  });
  audio.addEventListener("playing", () => (player.waiting = false));
  audio.addEventListener("waiting", () => (player.waiting = true));
  audio.addEventListener("pause", () => {
    player.playing = false;
    player.waiting = false;
    sessionState("paused");
    save();
  });
  audio.addEventListener("seeked", () => {
    if (!audio) return;
    player.position = audio.currentTime;
    showPosition();
    save();
  });
  audio.addEventListener("ended", ended);
  audio.addEventListener("error", () => {
    player.playing = false;
    player.waiting = false;
    if (player.current) player.said = "This episode couldn't be played. Open the original to listen on the publisher's site.";
  });
  return audio;
}

/** Saves where the reader is in the episode loaded, if any. */
function save() {
  const current = player.current;
  // Not before the file says how long it is: until then it's at its start, which isn't where the reader is.
  if (!current || !audio || loadedId !== current.article.id || audio.readyState === 0) return;
  lastSaved = Date.now();
  const done = finished(audio.currentTime, player.duration);
  savePlace(current.article.id, audio.currentTime, player.duration, done);
  if (done) markFinished(current.article);
}

/** A finished episode is read, however it got there (played, paused or moved to its last seconds). */
function markFinished(article: Article) {
  if (article.read) return;
  article.read = true;
  void markRead([article.id], true).catch(() => undefined);
}

/**
 * Nobody is signed in any more (signing out, or a session that ended): the
 * player stops and empties without saving, and this
 * device's places go, so the next reader starts from nothing (as offline
 * copies do, decision 0101).
 */
export function forgetListening(): void {
  loadedId = undefined;
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  player.current = undefined;
  player.playing = false;
  player.waiting = false;
  player.position = 0;
  player.duration = null;
  player.said = "";
  forgetPlaces();
  sessionState("none");
  const media = session();
  if (media) media.metadata = null;
}

/** Leaving the page, or putting it away: where the reader is gets saved. */
if (typeof addEventListener === "function") {
  addEventListener("pagehide", save);
  globalThis.document?.addEventListener("visibilitychange", () => {
    if (globalThis.document.visibilityState === "hidden") save();
  });
}

/** Whether `episode` is the one in the player. */
export function isLoaded(article: Article): boolean {
  return player.current?.article.id === article.id;
}

/**
 * Puts an episode in the player, ready at the place the reader stopped
 * (on any device). Nothing plays until `play`.
 */
export async function load(article: Article, episode: Episode): Promise<void> {
  if (isLoaded(article)) return;
  save();
  const sound = element();
  // Until the new file is in, nothing is saved: the old one's last moments aren't the new one's place.
  loadedId = undefined;
  sound.pause();
  player.current = { article, episode };
  player.playing = false;
  player.waiting = false;
  player.said = "";
  player.duration = episode.seconds;
  player.position = 0;
  const server = await serverPlace(article.id);
  if (!isLoaded(article)) return;
  startAt = resumeFrom(server, devicePlace(article.id));
  player.position = startAt;
  sound.src = episode.url;
  loadedId = article.id;
  sound.load();
  describe(article, episode);
}

/** Plays the episode (loading it first if another is in the player). Answers whether it started. */
export async function play(article: Article, episode: Episode): Promise<boolean> {
  await load(article, episode);
  if (!isLoaded(article)) return false;
  const sound = element();
  sound.playbackRate = player.rate;
  player.waiting = true;
  try {
    await sound.play();
    return true;
  } catch {
    // The browser may refuse to start without a press.
    player.waiting = false;
    return false;
  }
}

export function pause(): void {
  audio?.pause();
}

/** Play or pause the episode in the player. */
export function toggle(): void {
  const current = player.current;
  if (!current) return;
  if (player.playing) pause();
  else void play(current.article, current.episode);
}

/** Goes to `seconds` into the episode in the player. */
export function seek(seconds: number): void {
  if (!audio || !player.current) return;
  const end = player.duration ?? Number.POSITIVE_INFINITY;
  const to = Math.min(Math.max(0, seconds), end);
  if (audio.readyState === 0) {
    // Not loaded yet: it starts there once it is.
    startAt = to;
    player.position = to;
    return;
  }
  audio.currentTime = to;
  player.position = to;
}

export function back(): void {
  seek(player.position - BACK_SECONDS);
}

export function forward(): void {
  seek(player.position + FORWARD_SECONDS);
}

/** Sets the speed, on this device. */
export function setRate(rate: number): void {
  player.rate = rate;
  if (audio) audio.playbackRate = rate;
  setDeviceText(SPEED_KEY, String(rate));
}

/** Stops and empties the player (the bar's Close), keeping where the reader was. */
export function close(): void {
  save();
  audio?.pause();
  if (audio) {
    audio.removeAttribute("src");
    audio.load();
  }
  player.current = undefined;
  loadedId = undefined;
  player.playing = false;
  player.position = 0;
  player.duration = null;
  player.said = "";
  sessionState("none");
}

/** The end of an episode: finished (and read); nothing else starts by itself. */
function ended(): void {
  const current = player.current;
  if (!current) return;
  player.playing = false;
  player.position = player.duration ?? player.position;
  lastSaved = Date.now();
  savePlace(current.article.id, player.position, player.duration, true);
  markFinished(current.article);
  player.said = "Finished.";
  sessionState("none");
}

// ---- The lock screen and headphones (Media Session API) ------------------

function session(): MediaSession | undefined {
  return typeof navigator !== "undefined" && "mediaSession" in navigator ? navigator.mediaSession : undefined;
}

function sessionState(state: MediaSessionPlaybackState) {
  const media = session();
  if (media) media.playbackState = state;
}

function showPosition() {
  const media = session();
  if (!media?.setPositionState || !audio || player.duration === null) return;
  try {
    media.setPositionState({ duration: player.duration, position: Math.min(audio.currentTime, player.duration), playbackRate: audio.playbackRate || 1 });
  } catch {
    // A browser that disagrees about the numbers just shows less.
  }
}

/** Names the episode on the lock screen, with the podcast's name and picture, and answers its buttons. */
function describe(article: Article, episode: Episode) {
  const media = session();
  if (!media || typeof MediaMetadata === "undefined") return;
  media.metadata = new MediaMetadata({
    title: article.title || "Untitled",
    artist: article.feedTitle,
    artwork: episode.artwork ? [{ src: episode.artwork }] : [],
  });
  const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
    ["play", () => toggle()],
    ["pause", () => pause()],
    ["seekbackward", (details) => seek(player.position - (details.seekOffset ?? BACK_SECONDS))],
    ["seekforward", (details) => seek(player.position + (details.seekOffset ?? FORWARD_SECONDS))],
    ["seekto", (details) => details.seekTime !== undefined && seek(details.seekTime)],
    ["stop", () => close()],
  ];
  for (const [action, handler] of handlers) {
    try {
      media.setActionHandler(action, handler);
    } catch {
      // Not every browser knows every button.
    }
  }
}
