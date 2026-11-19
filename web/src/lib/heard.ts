// How an article is heard by a screen reader, once its text is shown.
//
// Its own links open in a new tab (cleaned so by nine turtles), and each says
// so, as every link out of nine turtles does (the note is ArticleView's).
//
// Its tables that only lay it out (accessibility round 2): some feeds
// carry their email's HTML, where a byline or a logo sits in a table inside a
// table; a screen reader would read it out as data ("table, 2 rows, 3
// columns"). Those tables are marked role="presentation", so it reads only
// their words, as emailed newsletters already are (newsletter.rs flattens them
// on arrival). A table with headings or a caption is data and stays; so does
// any other table, so a real table is never lost. Only the role changes:
// nothing moves on the page.

/** What decides it, read from one table. */
export type TableShape = {
  /** It has a heading cell, a header row or a caption: data. */
  headed: boolean;
  /** A table sits inside one of its cells. */
  holdsTable: boolean;
  /** It sits inside another table's cell. */
  inCell: boolean;
  /** Its widest row's cells. */
  columns: number;
};

/** Whether a table only lays the page out: one holding or held by another table, or of a single column, with no headings. */
export function isLayout(shape: TableShape): boolean {
  if (shape.headed) return false;
  return shape.holdsTable || shape.inCell || shape.columns <= 1;
}

function shapeOf(table: HTMLTableElement): TableShape {
  return {
    headed: Boolean(table.caption || table.tHead || table.querySelector(":scope > tbody > tr > th, :scope > tr > th")),
    holdsTable: table.querySelector("td table, th table") !== null,
    inCell: Boolean(table.parentElement?.closest("td, th")),
    columns: Math.max(0, ...[...table.rows].map((row) => row.cells.length)),
  };
}

/** Marks the layout tables in an article's text, leaving its data tables as they are. */
export function markLayoutTables(text: HTMLElement): void {
  for (const table of text.querySelectorAll("table")) {
    if (table.hasAttribute("role")) continue;
    if (isLayout(shapeOf(table))) table.setAttribute("role", "presentation");
  }
}

/** Marks an article's text for a screen reader: links out say they open a new tab; layout tables read as words. */
export function markForScreenReaders(text: HTMLElement): void {
  for (const link of text.querySelectorAll('a[target="_blank"]')) link.setAttribute("aria-describedby", "new-tab-note");
  markLayoutTables(text);
}
