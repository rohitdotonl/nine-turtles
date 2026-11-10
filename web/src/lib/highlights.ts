// Where the reader's highlights sit in an article's text (SPEC section 42),
// and how they're drawn there. A highlight keeps the words themselves and a
// little text either side, never a position: the publisher may change the
// article, and the words are found again wherever they now are. Spaces and
// line breaks are left out when comparing, so a quote taken across two
// paragraphs is found however the page lays it out. Words no longer in the
// article are simply not drawn; the list at the article's end still has them.

import type { Quote } from "./notes.svelte";

/** How much text either side of a quote is kept (server/src/notes.rs → AROUND). */
const AROUND = 64;

/** Text without its spaces and line breaks, as quotes are compared. */
export function squeezed(text: string): string {
  return text.replace(/\s+/g, "");
}

/** Text with each run of spaces and line breaks as one space, trimmed: as a quote is kept. */
export function tidy(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Where `quote` starts in `text` (both squeezed), or undefined when it isn't
 * there: of several places, the one whose text either side is most like
 * `before` and `after`, else the first.
 */
export function locate(text: string, quote: string, before: string, after: string): number | undefined {
  if (!quote) return undefined;
  let best: number | undefined;
  let bestScore = -1;
  for (let at = text.indexOf(quote); at !== -1; at = text.indexOf(quote, at + 1)) {
    let score = 0;
    while (score < before.length && text[at - 1 - score] === before[before.length - 1 - score]) score++;
    for (let i = 0; i < after.length && text[at + quote.length + i] === after[i]; i++) score++;
    if (score > bestScore) [best, bestScore] = [at, score];
  }
  return best;
}

/** One character of the article's text that isn't a space: which text node it's in, and where. */
type Place = { node: Text; offset: number };

/** The article's text, squeezed, and where each of its characters is on the page. */
function mapOf(root: Element): { text: string; places: Place[] } {
  const places: Place[] = [];
  let text = "";
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const data = (node as Text).data;
    for (let offset = 0; offset < data.length; offset++) {
      if (/\s/.test(data[offset]!)) continue;
      text += data[offset];
      places.push({ node: node as Text, offset });
    }
  }
  return { text, places };
}

/** The words chosen in the article, with a little of the text either side; undefined when nothing in it is chosen. */
export function quoteOf(root: Element, range: Range): Quote | undefined {
  if (range.collapsed || !root.contains(range.commonAncestorContainer)) return undefined;
  const quote = tidy(range.toString());
  if (!quote) return undefined;
  const before = document.createRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);
  const after = document.createRange();
  after.selectNodeContents(root);
  after.setStart(range.endContainer, range.endOffset);
  return { quote, before: tidy(before.toString()).slice(-AROUND), after: tidy(after.toString()).slice(0, AROUND) };
}

/**
 * Draws a highlight: its words in the article are wrapped in `<mark
 * class="highlight">`, a piece in each text node they cross (never around
 * the spaces between paragraphs). Answers whether its words were found.
 */
export function paint(root: Element, highlight: Quote & { id: number; note: string | null }): boolean {
  const { text, places } = mapOf(root);
  const quote = squeezed(highlight.quote);
  const at = locate(text, quote, squeezed(highlight.before), squeezed(highlight.after));
  if (at === undefined) return false;
  // The text nodes it crosses, each with the part of it that's highlighted.
  const pieces: { node: Text; from: number; to: number }[] = [];
  for (const place of places.slice(at, at + quote.length)) {
    const piece = pieces[pieces.length - 1];
    if (piece?.node === place.node) piece.to = place.offset + 1;
    else pieces.push({ node: place.node, from: place.offset, to: place.offset + 1 });
  }
  let mark: HTMLElement | undefined;
  for (const { node, from, to } of pieces) {
    const middle = node.splitText(from);
    middle.splitText(to - from);
    mark = document.createElement("mark");
    mark.className = "highlight";
    mark.dataset.highlight = String(highlight.id);
    middle.replaceWith(mark);
    mark.append(middle);
  }
  // A highlight with a note ends in a small page, the Notes icon (Icon.svelte → note).
  if (highlight.note && mark) {
    const icon = document.createElement("span");
    icon.className = "highlight-icon";
    icon.dataset.highlight = String(highlight.id);
    icon.innerHTML = NOTE_ICON;
    mark.after(icon);
  }
  return true;
}

// At the icon size beside a word, with its line 1.5px whatever the size (DESIGN.md → "The system").
const NOTE_ICON = `<svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path vector-effect="non-scaling-stroke" d="M4.75 3.25h7.5l3 3v10.5h-10.5z"/><path vector-effect="non-scaling-stroke" d="M7.5 10h5M7.5 13h3.5"/></svg>`;

/** Takes every highlight off the text, leaving it as the publisher's feed gave it. */
export function unpaint(root: Element): void {
  for (const icon of root.querySelectorAll(".highlight-icon")) icon.remove();
  for (const mark of root.querySelectorAll("mark.highlight")) mark.replaceWith(...mark.childNodes);
  root.normalize();
}

/** A time at a note's start, or anywhere in it ("12:34", "1:02:03"), in seconds. */
const TIME = /\b(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\b/g;

/** A note in pieces: its words, and the times in it, which take a video or episode back there. */
export function withTimes(note: string): ({ text: string } | { text: string; seconds: number })[] {
  const pieces: ({ text: string } | { text: string; seconds: number })[] = [];
  let from = 0;
  for (const match of note.matchAll(TIME)) {
    const [whole, hours, minutes = "0", seconds = "0"] = match;
    if (Number(seconds) > 59 || (hours !== undefined && Number(minutes) > 59)) continue;
    if (match.index > from) pieces.push({ text: note.slice(from, match.index) });
    pieces.push({ text: whole, seconds: Number(hours ?? 0) * 3600 + Number(minutes) * 60 + Number(seconds) });
    from = match.index + whole.length;
  }
  if (from < note.length) pieces.push({ text: note.slice(from) });
  return pieces;
}
