// A picture for someone or something followed, beside the byline and on their page (prototype).

const SMALL_WORDS = new Set(["the", "a", "an", "de", "la", "le"]);

/** Their initials: two for a person (first and last name), one for a publication. */
export function initialsOf(name: string, person: boolean): string {
  const words = name
    .replace(/\.(com|org|net|io|blog|dev|co|app|me)\b/gi, "")
    .split(/[\s\-–—_|:·]+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+/u, ""))
    .filter((word) => word.length > 0);
  const kept = words.length > 1 ? words.filter((word, index) => index > 0 || !SMALL_WORDS.has(word.toLowerCase())) : words;
  const first = (word: string | undefined) => (word ? Array.from(word)[0].toLocaleUpperCase() : "");
  if (!person || kept.length < 2) return first(kept[0]) || "?";
  return first(kept[0]) + first(kept[kept.length - 1]);
}

/** The site's own icons, largest first: the one a phone's home screen uses, then the browser tab's. */
export function iconsOf(siteUrl: string | null | undefined): string[] {
  if (!siteUrl) return [];
  try {
    const { origin, protocol } = new URL(siteUrl);
    if (protocol !== "https:" && protocol !== "http:") return [];
    return [`${origin}/apple-touch-icon.png`, `${origin}/favicon.ico`];
  } catch {
    return [];
  }
}

export type PortraitStyle = "initials" | "favicon";

/** Prototype only: which fallback to show, chosen with ?portrait=initials or ?portrait=favicon and remembered. */
export function portraitStyle(): PortraitStyle {
  try {
    const asked = new URLSearchParams(location.search).get("portrait");
    if (asked === "initials" || asked === "favicon") localStorage.setItem("nt-portrait", asked);
    return localStorage.getItem("nt-portrait") === "favicon" ? "favicon" : "initials";
  } catch {
    return "initials";
  }
}
