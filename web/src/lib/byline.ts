// An article's byline (SPEC section 7): who wrote it, besides the source it came from.

/** The author, unless they're who the byline already names (Hal Brennan, once). */
export function authorBesides(author: string | null | undefined, source: string): string | undefined {
  const name = author?.trim();
  return name && name.toLowerCase() !== source.trim().toLowerCase() ? name : undefined;
}
