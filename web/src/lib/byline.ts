// An article's byline (SPEC section 7): who wrote it, besides the source it came from.

/**
 * The author, unless they're who the byline already names (Hal Brennan, once).
 * A name spelled a letter or two differently is the same person ("Ana Rodrigues
 * in Ana Rodriguez" says the name once, decision 0298): only names of six
 * letters or more, so two short different names never merge.
 */
export function authorBesides(author: string | null | undefined, source: string): string | undefined {
  const name = author?.trim();
  if (!name) return undefined;
  const a = letters(name);
  const b = letters(source);
  if (a === b) return undefined;
  return Math.min(a.length, b.length) >= 6 && apart(a, b) <= 2 ? undefined : name;
}

/** A name's letters and digits only, lowercase, accents dropped: "Zoë O'Hara" is "zoeohara". */
function letters(name: string): string {
  return name.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/** How many letters must change, be added or go to turn one name into the other (stops counting past 2). */
function apart(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let previous = Array.from({ length: b.length + 1 }, (_, at) => at);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    if (Math.min(...row) > 2) return 3;
    previous = row;
  }
  return previous[b.length];
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
