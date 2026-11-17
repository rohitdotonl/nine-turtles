// The pauses in an article (decision 0298): what isn't the writer's words but
// a breath between them, marked with a class so the stylesheet can give it
// room (article-text.css). Only classes and aria-hidden change: the text
// itself stays exactly as the feed gave it, so highlights and the place you
// stopped (which count letters) never move.

/** A line that is only a run of dashes, stars or the like: a section break typed by hand ("------", "* * *"). */
const TYPED_BREAK = /^\s*(?:[-*_=~•·◆♦⁂]\s*){3,}$/u;

/** Whether a paragraph's words are only a typed section break. */
export function typedBreak(words: string): boolean {
  return TYPED_BREAK.test(words);
}

/** Picture-only blocks: a paragraph or link holding pictures and nothing to read. */
function picturesOnly(block: Element): boolean {
  return block.querySelector("img, picture, video") !== null && !block.textContent?.trim();
}

/** The article's last block worth ending on: skips empty paragraphs and typed breaks. */
function lastBlock(body: Element): Element | undefined {
  // A block with fewer than two letters (a "🔗" permalink, a lone "#") isn't where the writing ends.
  const blocks = [...body.children].filter(
    (block) =>
      block.tagName !== "HR" &&
      !block.classList.contains("section-break") &&
      ((block.textContent?.match(/\p{L}/gu) ?? []).length >= 2 || picturesOnly(block)),
  );
  let last = blocks.at(-1);
  // A wrapper's last block, so the mark follows the words rather than closing a box.
  while (last && last.tagName === "DIV" && last.lastElementChild) last = last.lastElementChild;
  if (last && /^(UL|OL)$/.test(last.tagName)) last = last.lastElementChild ?? last;
  if (last?.tagName === "BLOCKQUOTE") last = last.lastElementChild ?? last;
  return last ?? undefined;
}

/**
 * Marks the article's pauses: typed section breaks (drawn as the short rule),
 * picture-only paragraphs (given a picture's room) and, when `ending`, the
 * text, when the writer ends on words or a picture, for the end mark (◆).
 */
export function markPauses(body: Element, ending: boolean) {
  for (const paragraph of body.querySelectorAll("p")) {
    if (typedBreak(paragraph.textContent ?? "") && !paragraph.querySelector("img")) {
      paragraph.classList.add("section-break");
      paragraph.setAttribute("aria-hidden", "true");
    } else if (picturesOnly(paragraph)) paragraph.classList.add("picture");
  }
  if (!ending) return;
  const last = lastBlock(body);
  if (!last) return;
  // The mark takes a line of its own under the text, centred on the column even when the last words are a list's or a
  // quotation's (decision 0302); after code or a table, which scroll sideways inside themselves, there's no mark.
  if (!/^(PRE|TABLE)$/.test(last.tagName)) body.classList.add("ends");
}
