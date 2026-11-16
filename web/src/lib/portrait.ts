// A picture of someone or something followed (SPEC section 36, decision 0283), beside an article's byline and at
// the top of their page: the one the reader chose, else the one their feed names, else their site's own icon, else
// their initials.

import type { Feed } from "./shapes";

const SMALL_WORDS = new Set(["the", "a", "an"]);

/** Their initials, when no picture loads: two for a person (first and last name), one for a publication. */
export function initialsOf(name: string, person: boolean): string {
  const words = name
    .replace(/\.(com|org|net|io|blog|dev|co|app|me)\b/gi, "")
    .split(/[\s\-–—_|:·]+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+/u, ""))
    .filter((word) => word.length > 0);
  // Words that start with a letter, when there are any ("Blog 2" is "B"), without a leading "The".
  const lettered = words.filter((word) => /^\p{L}/u.test(word));
  const named = lettered.length > 0 ? lettered : words;
  const kept = named.length > 1 ? named.filter((word, index) => index > 0 || !SMALL_WORDS.has(word.toLowerCase())) : named;
  const first = (word: string | undefined) => (word ? (Array.from(word)[0] ?? "").toLocaleUpperCase() : "");
  if (!person || kept.length < 2) return first(kept[0]) || "?";
  return first(kept[0]) + first(kept[kept.length - 1]);
}

/** A site's own icons, largest first: the one a phone's home screen uses, then the browser tab's. */
export function iconsOf(siteUrl: string | null | undefined): string[] {
  if (!siteUrl) return [];
  try {
    const { origin, protocol, hostname } = new URL(siteUrl);
    if (protocol !== "https:" && protocol !== "http:") return [];
    // A YouTube channel's site is YouTube's: its icon is YouTube's own logo, and nothing loads from YouTube unasked (decision 0072).
    if (/(^|\.)(youtube\.com|youtu\.be)$/.test(hostname)) return [];
    return [`${origin}/apple-touch-icon.png`, `${origin}/favicon.ico`];
  } catch {
    return [];
  }
}

/** Where their chosen picture is kept: its address names its version, so a browser keeps it until it changes. */
export function chosenPicture(places: Feed[]): string | undefined {
  const chosen = places.filter((place) => place.pictureChosen).sort((a, b) => (b.pictureChosen ?? 0) - (a.pictureChosen ?? 0))[0];
  return chosen ? `/api/feeds/${chosen.id}/picture?v=${chosen.pictureChosen}` : undefined;
}

/** Every picture worth trying, in order, each once: the chosen one, the feeds' own, then each site's icons. */
export function picturesOf(places: Feed[], siteUrl?: string | null): string[] {
  const all = [
    chosenPicture(places),
    ...places.map((place) => place.pictureUrl),
    ...iconsOf(siteUrl),
    ...places.flatMap((place) => iconsOf(place.siteUrl)),
  ].filter((each): each is string => !!each);
  return [...new Set(all)];
}

/** Narrower than this (in the picture's own pixels) and it would blur filling the circle: it sits small inside it. */
export const CRISP = 96;

/** The side of a chosen picture, in pixels: sharp at the page's 72px on a screen three times as dense. */
export const SIDE = 256;

/**
 * A chosen picture, made small before it's sent: its middle square, `SIDE` pixels on each side, as a JPEG on
 * white (a picture with see-through parts gets a white ground). Undefined when the browser can't read it.
 */
export async function madeSmall(file: Blob): Promise<Blob | undefined> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return undefined;
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(SIDE, side);
  const context = canvas.getContext("2d");
  if (!context || side === 0) return undefined;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? undefined), "image/jpeg", 0.88));
}
