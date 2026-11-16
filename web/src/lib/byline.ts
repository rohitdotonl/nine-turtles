// An article's byline (SPEC section 7): who wrote it, besides the source it came from.

/** The author, unless they're who the byline already names (Hal Brennan, once). */
export function authorBesides(author: string | null | undefined, source: string): string | undefined {
  const name = author?.trim();
  return name && name.toLowerCase() !== source.trim().toLowerCase() ? name : undefined;
}

/**
 * How long a title is, for its size (decision 0294): "short" titles are set
 * large, "long" ones smaller with looser lines, so a title of a hundred
 * letters never fills the first screen. Counted in characters, as written.
 */
export function titleLength(title: string): "short" | "medium" | "long" {
  const length = [...title.trim()].length;
  return length < 45 ? "short" : length < 85 ? "medium" : "long";
}
