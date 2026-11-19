/**
 * What didn't arrive inside an article says so (decision 0260).
 *
 * A picture that fails to load is swapped for a short note in the
 * interface's quiet type (the offline copy's `.offline-image` style): what
 * the picture showed, when the writer said, and a link to the original,
 * where it may still be. A frame the writer embedded reaches the page as an
 * empty link to it (the server's `feed/embeds.rs`), which becomes a note
 * naming the site, with a link to it. A table wider than the column scrolls
 * sideways and says so under it, and is reachable by the keyboard to scroll.
 * The words are written here, never stored, so search and rules never see them.
 */

/** The class of the line under a wide table, so it's found again and never doubled. */
const WIDE_NOTE = "wide-note";

/** A quiet note in the interface's words, in English whatever the article's language. */
function note(): HTMLElement {
  const note = document.createElement("span");
  note.className = "offline-image";
  note.setAttribute("lang", "en");
  return note;
}

/**
 * A link out of a note, drawn as every link out of nine turtles is: its words
 * and the open arrow (`arrow`, the Icon the article view keeps for this), and
 * "Opens in a new tab" for screen readers (the view's `new-tab-note`).
 */
function out(address: string, words: string, arrow: Element | null | undefined): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = address;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-describedby", "new-tab-note");
  link.append(words);
  if (arrow) link.append(arrow.cloneNode(true));
  return link;
}

/** The note that takes a broken picture's place; `original` is the article's own address, if it has one. */
export function missingNote(image: HTMLImageElement, original: string | null | undefined, arrow?: Element | null): HTMLElement {
  const missing = note();
  const alt = image.alt.trim();
  // A picture with no words of the writer's can join the ones beside it (`joinRun`).
  if (!alt) missing.dataset.pictures = "1";
  missing.append(alt ? "A picture didn't load: " : "A picture didn't load.");
  if (alt) {
    const what = document.createElement("i");
    // The writer's own words for it, in their language and direction.
    what.setAttribute("dir", "auto");
    what.textContent = alt;
    missing.append(what, ".");
  }
  // A picture inside a link already sits in one: no link inside a link.
  if (original && !image.closest("a")) missing.append(" ", out(original, "See it on the original", arrow));
  return missing;
}

/** Swaps a picture that failed to load (with its `<picture>`, if it's in one) for its note, joined to the notes beside it. */
export function markMissing(image: HTMLImageElement, original: string | null | undefined, arrow?: Element | null): void {
  const missing = missingNote(image, original, arrow);
  (image.closest("picture") ?? image).replaceWith(missing);
  joinRun(missing);
}

/** What a note stands for in the article: itself, or the paragraph (or link) holding nothing else. */
function unitOf(missing: HTMLElement): Element {
  let unit: Element = missing;
  const words = missing.textContent?.trim();
  while (unit.parentElement && !unit.parentElement.classList.contains("article-text") && unit.parentElement.textContent?.trim() === words) unit = unit.parentElement;
  return unit;
}

/** The note without the writer's words next to `missing` that way, with nothing but space between, if there is one. */
function besideIt(missing: HTMLElement, step: -1 | 1): HTMLElement | undefined {
  let node = step < 0 ? unitOf(missing).previousSibling : unitOf(missing).nextSibling;
  while (node && node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) node = step < 0 ? node.previousSibling : node.nextSibling;
  if (!(node instanceof Element)) return undefined;
  const found = node.matches(".offline-image[data-pictures]") ? node : node.querySelector(".offline-image[data-pictures]");
  return found instanceof HTMLElement && unitOf(found) === node ? found : undefined;
}

/**
 * Pictures that didn't load one after another, with nothing between, say so once (decision 0318):
 * "11 pictures didn't load. See them on the original", not eleven lines the same. Pictures fail
 * in any order, so a note joins the one before it and the one after it.
 */
function joinRun(missing: HTMLElement): void {
  if (missing.dataset.pictures === undefined) return;
  let first = missing;
  for (const step of [-1, 1] as const) {
    const other = besideIt(first, step);
    if (!other) continue;
    const [kept, gone] = step < 0 ? [other, first] : [first, other];
    kept.dataset.pictures = String(Number(kept.dataset.pictures) + Number(gone.dataset.pictures));
    unitOf(gone).remove();
    first = kept;
  }
  const count = Number(first.dataset.pictures);
  if (count < 2) return;
  first.firstChild!.textContent = `${count} pictures didn't load.`;
  const link = first.querySelector("a");
  if (link?.firstChild) link.firstChild.textContent = "See them on the original";
}

/**
 * Writes the note into an embedded frame's empty link: "Something from
 * openstreetmap.org is embedded here. Open it". A link of that class that
 * has words of its own is the writer's, and stays as it is.
 */
export function markEmbedded(link: HTMLAnchorElement, arrow?: Element | null): void {
  if (link.childNodes.length > 0) return;
  const embedded = note();
  embedded.append(`Something from ${link.hostname.replace(/^www\./, "")} is embedded here. `, out(link.href, "Open it", arrow));
  link.replaceWith(embedded);
}

/** "Scroll the table sideways to see all 14 columns.", or "Swipe" on a touch screen. */
export function wideWords(columns: number, touch: boolean): string {
  const all = columns > 1 ? `all ${columns} columns` : "all of it";
  return `${touch ? "Swipe" : "Scroll"} the table sideways to see ${all}.`;
}

/**
 * Marks a table wider than its column: it can be reached by the keyboard to
 * scroll, and a quiet line under it says there's more to the side. A table
 * that fits again (the window grew) loses both.
 */
export function markWide(table: HTMLTableElement, touch: boolean): void {
  const wide = table.scrollWidth > table.clientWidth + 1;
  const next = table.nextElementSibling;
  const noted = next instanceof HTMLElement && next.classList.contains(WIDE_NOTE) ? next : undefined;
  if (!wide) {
    noted?.remove();
    if (table.dataset.wide !== undefined) {
      delete table.dataset.wide;
      table.removeAttribute("tabindex");
    }
    return;
  }
  table.dataset.wide = "";
  table.setAttribute("tabindex", "0");
  const columns = Math.max(0, ...[...table.rows].map((row) => row.cells.length));
  const words = wideWords(columns, touch);
  if (noted) {
    if (noted.textContent !== words) noted.textContent = words;
    return;
  }
  const note = document.createElement("span");
  note.className = `offline-image ${WIDE_NOTE}`;
  note.setAttribute("lang", "en");
  note.textContent = words;
  table.after(note);
}
