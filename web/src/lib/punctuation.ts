// Proper punctuation (decision 0247): many feeds send a typewriter's marks,
// straight quotes, "--" for a dash and three dots for an ellipsis. When an
// English article is shown, they're set as a typesetter would: curly quotes
// and apostrophes, an em dash, an ellipsis. Only what's shown changes: the
// stored article, search and what an assistant reads keep the writer's own
// characters, and highlights compare punctuation either way (highlights.ts).
// Code, keys and preformatted text are left exactly as written.

/** Elements whose text is never touched: code and anything shown character for character. */
const AS_WRITTEN = "code, pre, kbd, samp, tt, var, script, style, textarea, svg, math";

/** A quote mark after one of these, or at the very start, opens; elsewhere it closes. */
const OPENS_AFTER = /[\s([{—–/-]/;

/**
 * `text` with its typewriter punctuation set properly. `before` is the
 * character just before it on the page (a space at the start), so a quote
 * mark at the start of a run of italics still knows which way it faces.
 */
export function typeset(text: string, before = " "): string {
  let out = "";
  let previous = before;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    const next = text[i + 1] ?? "";
    let set = c;
    if (c === "-" && next === "-" && text[i + 2] !== "-" && previous !== "-") {
      // Two hyphens are a dash; three or more are a rule someone drew, left alone.
      set = "—";
      i += 1;
    } else if (c === "." && text.startsWith("...", i) && text[i + 3] !== "." && previous !== ".") {
      set = "…";
      i += 2;
    } else if (c === '"') {
      set = OPENS_AFTER.test(previous) ? "“" : "”";
    } else if (c === "'") {
      // After a letter or a figure it's an apostrophe or a closing quote; before
      // a figure ('90s) an apostrophe too; elsewhere it opens a quotation.
      set = OPENS_AFTER.test(previous) && !/\p{N}/u.test(next) ? "‘" : "’";
    }
    out += set;
    previous = set[set.length - 1]!;
  }
  return out;
}

/** Whether an article in `language` (as the feed names it; none means English) gets English punctuation. */
export function setsEnglishPunctuation(language: string | null | undefined): boolean {
  return !language || /^en\b/i.test(language);
}

/** Where a new line of text starts: a quote mark just after one opens. */
const STARTS_LINE = /^(P|LI|DT|DD|H[1-6]|TD|TH|BLOCKQUOTE|FIGCAPTION|DIV|BR|SECTION|ASIDE|HEADER|FOOTER|TR|UL|OL|DL|TABLE|FIGURE|HR|DETAILS|SUMMARY)$/;

/** Sets the punctuation of every text in `root` that isn't code, in place. */
export function setPunctuation(root: Element): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node instanceof Element && node.matches(AS_WRITTEN) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  let before = " ";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node instanceof Element) {
      // A paragraph, item, cell or line break starts afresh, whatever ended the one before.
      if (STARTS_LINE.test(node.tagName)) before = " ";
      continue;
    }
    const text = node as Text;
    const set = typeset(text.data, before);
    if (set !== text.data) text.data = set;
    if (set.trim()) before = set[set.length - 1]!;
  }
}
