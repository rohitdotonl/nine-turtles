// Footnotes open where you are (decision 0247, SPEC section 7): a press on a
// footnote's number shows its note in a small card just under the line,
// instead of jumping to the end of the article and back. The notes stay at
// the end too. Links inside the article are cleaned to `#article-…`
// (server/src/feed/clean.rs), and the cleaning keeps no class names, so a
// footnote is known by its shape: a link inside a superscript to a place in
// the same article that isn't the link itself.

/** A footnote's number and its note, ready to show (already cleaned, as the article is). */
export type Footnote = { number: string; html: string };

/** Marks that only lead back to the text: the note's way back, not part of what it says. */
const WAY_BACK = /^[\s↩↪↑⤴⬑⏎^︎️]*$|^(back|return)$/i;

/** The footnote `link` points to, or undefined when it isn't one (an ordinary link to a place in the article). */
export function footnoteOf(link: HTMLAnchorElement, area: Element): Footnote | undefined {
  const anchor = link.getAttribute("href");
  if (!anchor?.startsWith("#article-") || !link.closest("sup")) return undefined;
  const note = document.getElementById(decodeURIComponent(anchor.slice(1)));
  if (!note || !area.contains(note) || note.contains(link)) return undefined;
  const copy = note.cloneNode(true) as Element;
  for (const back of copy.querySelectorAll('a[href^="#article-"]')) {
    if (WAY_BACK.test(back.textContent ?? "")) back.remove();
  }
  for (const named of copy.querySelectorAll("[id]")) named.removeAttribute("id");
  const number = link.textContent?.trim() ?? "";
  dropNumber(copy, number);
  if (!copy.textContent?.trim()) return undefined;
  return { number, html: copy.innerHTML };
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
