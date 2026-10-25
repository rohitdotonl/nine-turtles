/**
 * YouTube videos play in YouTube's own player (the publisher floor, SPEC
 * section 7, decision 0071). An article whose link is a YouTube video gets a
 * Play button above its text; nothing loads from YouTube until it's pressed.
 * The same rules as the server's `youtube_video` (server/src/feed.rs).
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

/**
 * YouTube's privacy-enhanced player for a video: it sets no tracking cookie
 * until the video plays. Opened by a press, so it starts at once; related
 * videos come from the same channel only.
 */
export function playerAddress(video: string): string {
  return `https://www.youtube-nocookie.com/embed/${video}?autoplay=1&rel=0`;
}
