/**
 * YouTube videos play in YouTube's own player (the publisher floor, SPEC
 * section 7, decision 0072). An article whose link is a YouTube video gets a
 * Play button above its text; nothing loads from YouTube until it's pressed.
 * The same rules as the server's `youtube_video` (server/src/feed/clean.rs).
 * Also the video page's chapters and folding, and talking to the player once
 * it plays (SPEC section 38, decision 0144).
 */

/** The video a YouTube address shows, as its 11-character ID, or `undefined`. */
export function youtubeVideo(address: string | null | undefined): string | undefined {
  if (!address) return undefined;
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  const [first, second] = url.pathname.split("/").slice(1);
  let id: string | null | undefined;
  if (host === "youtu.be") id = first;
  else if (host === "youtube.com" && first === "watch") id = url.searchParams.get("v");
  else if ((host === "youtube.com" || host === "youtube-nocookie.com") && ["shorts", "live", "embed", "v"].includes(first ?? "")) id = second;
  // An embedded playlist (`embed/videoseries?list=…`) isn't one video.
  return id && id !== "videoseries" && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : undefined;
}

/** Where YouTube's privacy-enhanced player lives: the one frame nine turtles allows. */
export const PLAYER_ORIGIN = "https://www.youtube-nocookie.com";

/**
 * YouTube's privacy-enhanced player for a video: it sets no tracking cookie
 * until the video plays. Opened by a press, so it starts at once (from
 * `start` seconds, where you stopped or a chapter you pressed); related
 * videos come from the same channel only. It tells this page its time and
 * when it ends (`enablejsapi`, decision 0144), so nine turtles keeps your
 * place and closes it at the end.
 */
export function playerAddress(video: string, start = 0, origin = ""): string {
  const from = Math.floor(start) > 0 ? `&start=${Math.floor(start)}` : "";
  const page = origin ? `&origin=${encodeURIComponent(origin)}` : "";
  return `${PLAYER_ORIGIN}/embed/${video}?autoplay=1&rel=0&enablejsapi=1${from}${page}`;
}

/** What YouTube's player said in a message to the page: its time, its length, its speed, and whether it's playing, paused or ended. */
export type PlayerNews = { time?: number; duration?: number; rate?: number; state?: "playing" | "paused" | "ended" };

const STATES: Record<number, PlayerNews["state"]> = { 0: "ended", 1: "playing", 2: "paused" };

/** Reads one of the player's messages (JSON text); undefined for anything else. */
export function playerNews(data: unknown): PlayerNews | undefined {
  let message: unknown;
  try {
    message = typeof data === "string" ? JSON.parse(data) : undefined;
  } catch {
    return undefined;
  }
  if (typeof message !== "object" || message === null) return undefined;
  const { event, info } = message as { event?: unknown; info?: unknown };
  if (event === "onStateChange" && typeof info === "number") return { state: STATES[info] };
  if (event === "onPlaybackRateChange") return typeof info === "number" && isVideoSpeed(info) ? { rate: info } : {};
  if ((event !== "infoDelivery" && event !== "initialDelivery") || typeof info !== "object" || info === null) return undefined;
  const { currentTime, duration, playbackRate, playerState } = info as Record<string, unknown>;
  return {
    ...(typeof currentTime === "number" ? { time: currentTime } : {}),
    ...(typeof duration === "number" && duration > 0 ? { duration } : {}),
    ...(typeof playbackRate === "number" && isVideoSpeed(playbackRate) ? { rate: playbackRate } : {}),
    ...(typeof playerState === "number" && STATES[playerState] ? { state: STATES[playerState] } : {}),
  };
}

/**
 * YouTube's player doesn't carry a chosen speed from one video to the next
 * (tried in real browsers, decision 0156), though it does remember
 * captions. So this device remembers the speed last chosen in it, apart
 * from a podcast's, and gives it to each video as it starts.
 */
export const VIDEO_SPEED_KEY = "nine-turtles.video-speed";

/** A speed YouTube's player can play at: from a quarter to four times. */
function isVideoSpeed(rate: number): boolean {
  return Number.isFinite(rate) && rate >= 0.25 && rate <= 4;
}

/** The video speed this device keeps (its text), or 1 when none or nothing usable is kept. */
export function videoSpeed(kept: string | null): number {
  const rate = Number(kept);
  return kept !== null && isVideoSpeed(rate) ? rate : 1;
}

/** A message to the player: start listening to it, or a command such as seeking. */
export function toPlayer(event: "listening" | "command", func?: string, args: unknown[] = []): string {
  return JSON.stringify(event === "listening" ? { event, id: 1, channel: "widget" } : { event, func, args, id: 1, channel: "widget" });
}

/** What Add a feed asks about a YouTube video's or playlist's address (decision 0144). */
export function question(asks: "video" | "playlist", maker: string): string {
  return asks === "video"
    ? `Follow ${maker}?`
    : `This playlist is by ${maker}. Follow only the playlist, or every video?`;
}

/** One chapter of a video: where it starts, in seconds, and its name. */
export type Chapter = { at: number; title: string };

/** "4:12" or "1:02:03" as seconds; undefined if it isn't a time. */
function seconds(time: string): number | undefined {
  const parts = time.split(":").map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) return undefined;
  if (parts.slice(1).some((part) => part > 59)) return undefined;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

const TIME = String.raw`\(?\[?((?:\d{1,2}:)?\d{1,2}:\d{2})\]?\)?`;
const LEADING = new RegExp(String.raw`^\s*(?:[-•*]\s*)?${TIME}\s*(?:[-–—:|.]\s*)?(.+?)\s*$`);
const TRAILING = new RegExp(String.raw`^\s*(?:[-•*]\s*)?(.+?)\s*(?:[-–—:|]\s*)?${TIME}\s*$`);

/** A video description's text, line by line, from its cleaned HTML. */
function lines(html: string): string[] {
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div|h\d)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
  return text.split("\n");
}

/**
 * The chapters a video's description lists, as YouTube reads them: lines
 * that start (or end) with a time, such as "4:12 Finding a site's feed". At
 * least two, each later than the one before; otherwise none, so a stray
 * time in a sentence is never a chapter.
 */
export function chapters(html: string | null | undefined): Chapter[] {
  if (!html) return [];
  const found: Chapter[] = [];
  for (const line of lines(html)) {
    const leading = LEADING.exec(line);
    const trailing = leading ? undefined : TRAILING.exec(line);
    const [time, title] = leading ? [leading[1], leading[2]] : trailing ? [trailing[2], trailing[1]] : [];
    const at = time ? seconds(time) : undefined;
    if (at === undefined || !title) continue;
    const last = found.at(-1);
    if (last && at <= last.at) return [];
    found.push({ at, title });
  }
  return found.length >= 2 ? found : [];
}

/** The most of a description shown before it's folded: one paragraph, if the rest would add more than this many characters. */
const FOLD_AFTER = 280;

/**
 * Whether a video's description is long enough to fold behind "Show the
 * full description": more than one paragraph, the rest of them longer than
 * `FOLD_AFTER` characters.
 */
export function foldable(html: string | null | undefined): boolean {
  if (!html) return false;
  const paragraphs = html.split(/<\/p>/i).filter((part) => part.replace(/<[^>]*>/g, "").trim());
  if (paragraphs.length < 2) return false;
  const rest = paragraphs.slice(1).join("").replace(/<[^>]*>/g, "").trim();
  return rest.length > FOLD_AFTER;
}
