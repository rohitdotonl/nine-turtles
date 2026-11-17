// An article's byline (SPEC section 7): who wrote it, besides the source it came from.

/** The author, unless they're who the byline already names (Hal Brennan, once). */
export function authorBesides(author: string | null | undefined, source: string): string | undefined {
  const name = author?.trim();
  return name && name.toLowerCase() !== source.trim().toLowerCase() ? name : undefined;
}

/**
 * How long a title is, for its size (decision 0294): "short" titles are set
 * large, "long" ones smaller with looser lines, so a title of a hundred
 * letters never fills the first screen. Counted in characters, the wide
 * ones of Chinese, Japanese and Korean twice.
 */
/** Han, kana, Hangul and full-width forms. */
const WIDE = /[\u1100-\u11ff\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]|[\u{20000}-\u{2fa1f}]/u;

export function titleLength(title: string): "short" | "medium" | "long" {
  // A Chinese, Japanese or Korean character is about two Latin letters wide, so it counts double.
  const length = [...title.trim()].reduce((sum, character) => sum + (WIDE.test(character) ? 2 : 1), 0);
  return length < 45 ? "short" : length < 85 ? "medium" : "long";
}
