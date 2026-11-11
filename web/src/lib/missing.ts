/**
 * What didn't arrive inside an article says so (decision 0255).
 *
 * A picture that fails to load is swapped for a short note in the
 * interface's quiet type (the offline copy's `.offline-image` style): what
 * the picture showed, when the writer said, and a link to the original,
 * where it may still be. A table wider than the column scrolls sideways and
 * says so under it, and is reachable by the keyboard to scroll. (A frame the
 * writer embedded is noted by the server, as it is cleaned: feed/embeds.rs.)
 */

/** The class of the line under a wide table, so it's found again and never doubled. */
const WIDE_NOTE = "wide-note";

/** The note that takes a broken picture's place; `original` is the article's own address, if it has one. */
export function missingNote(image: HTMLImageElement, original: string | null | undefined): HTMLElement {
  const note = document.createElement("span");
  note.className = "offline-image";
  note.setAttribute("lang", "en");
  const alt = image.alt.trim();
  note.append(alt ? "A picture didn’t load: " : "A picture didn’t load.");
  if (alt) {
    const what = document.createElement("i");
    // The writer's own words for it, in their language and direction.
    what.setAttribute("dir", "auto");
    what.textContent = alt;
    note.append(what, ".");
  }
  // A picture inside a link already sits in one: no link inside a link.
  if (original && !image.closest("a")) {
    const link = document.createElement("a");
    link.href = original;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "See it on the original ↗";
    note.append(" ", link);
  }
  return note;
}

/** Swaps a picture that failed to load (with its `<picture>`, if it's in one) for its note. */
export function markMissing(image: HTMLImageElement, original: string | null | undefined): void {
  (image.closest("picture") ?? image).replaceWith(missingNote(image, original));
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
