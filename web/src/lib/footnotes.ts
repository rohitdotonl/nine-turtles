// Footnotes open where you are (decision 0247, SPEC section 7): a press on a
// footnote's number shows its note in a small card just under the line,
// instead of jumping to the end of the article and back. The notes stay at
// the end too. Links inside the article are cleaned to `#article-…`
// (server/src/feed/clean.rs), and the cleaning keeps no class names, so a
// footnote is known by its shape: a link to another place in the same
// article that is a superscript, holds one, or is only a short number or
// mark ("1", "[2]", "*"). Its note is the place it points to, or, when that
// is a word or the note's own number, the paragraph or item around it.

/** A footnote's number and its note, ready to show (already cleaned, as the article is). */
export type Footnote = { number: string; html: string };

/** Marks that only lead back to the text: the note's way back, not part of what it says. */
const WAY_BACK = /^[\s↩↪↑⤴⬑⏎^︎️]*$|^(back|return)$/i;

/** A link that is only a footnote's number or mark. */
const MARKER = /^\[?(\d{1,3}|[*†‡§])\]?$/;

/** What a note can be, when the place a footnote points to is only a word in it. */
const BLOCK = "p, li, dd, div, aside, section, blockquote, td";

/** The footnote `link` points to, or undefined when it isn't one (an ordinary link to a place in the article). */
export function footnoteOf(link: HTMLAnchorElement, area: Element): Footnote | undefined {
  const anchor = link.getAttribute("href");
  const number = link.textContent?.trim() ?? "";
  if (!anchor?.startsWith("#article-")) return undefined;
  if (!link.closest("sup") && !link.querySelector("sup") && !MARKER.test(number)) return undefined;
  const place = document.getElementById(decodeURIComponent(anchor.slice(1)));
  const note = place && getComputedStyle(place).display.startsWith("inline") ? place.parentElement?.closest(BLOCK) : place;
  if (!note || !area.contains(note) || note.contains(link)) return undefined;
  const copy = note.cloneNode(true) as Element;
  // The note's way back: a ↩ or "back", or any link back to this very number.
  for (const back of copy.querySelectorAll('a[href^="#article-"]')) {
    if (WAY_BACK.test(back.textContent ?? "") || (link.id && back.getAttribute("href") === `#${link.id}`)) back.remove();
  }
  for (const named of copy.querySelectorAll("[id]")) named.removeAttribute("id");
  dropNumber(copy, number);
  if (!copy.textContent?.trim()) return undefined;
  return { number, html: copy.innerHTML };
}

/**
 * Follows the links to places inside the article in `area`: a footnote's
 * number calls `open` with its note; any other (a note's way back) scrolls
 * to its place and moves the keyboard there, rather than opening a new tab.
 * Answers the way to stop.
 */
export function followAnchors(area: HTMLElement, open: (note: Footnote, link: HTMLAnchorElement) => void): () => void {
  const follow = (event: MouseEvent) => {
    const link = event.target instanceof Element ? event.target.closest("a") : null;
    const anchor = link?.getAttribute("href");
    if (!link || !anchor?.startsWith("#article-")) return;
    event.preventDefault();
    const note = footnoteOf(link, area);
    if (note) return open(note, link);
    const place = document.getElementById(decodeURIComponent(anchor.slice(1)));
    if (!place || !area.contains(place)) return;
    place.setAttribute("tabindex", "-1");
    place.scrollIntoView({ block: "start" });
    place.focus({ preventScroll: true });
  };
  area.addEventListener("click", follow);
  return () => area.removeEventListener("click", follow);
}

/** Takes the number off the front of a note written as "1. …" or "[1] …": the card shows it once, on its own. */
function dropNumber(note: Element, number: string): void {
  const walker = document.createTreeWalker(note, NodeFilter.SHOW_TEXT);
  let first = walker.nextNode() as Text | null;
  while (first && !first.data.trim()) first = walker.nextNode() as Text | null;
  if (!first || !number) return;
  const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  first.data = first.data.replace(new RegExp(`^\\s*\\[?${escaped}[.):\\]]?\\s+`), "");
}
