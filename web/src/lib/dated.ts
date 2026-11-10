// The dates inside the interface's sentences ("kept until 10 Dec", "Nothing
// new has arrived since 14:05.") take the face with a plain zero, as every
// <time> does (decision 0246, fonts.css → .dated). Only the date itself
// does: the rest of the sentence may hold an address, a title or a code,
// which keep the crossed zero that tells 0 from O.

import { MONTHS } from "./times";

const MONTH = `(?:${MONTHS.join("|")})`;

/** A date or time as times.ts writes them: "20 Oct", "Oct 20", "20 Oct 2025", "Oct 20, 2025", "14:05", "2:05 PM", with any space (a no-break one too). */
const DATE = new RegExp(`\\b(?:\\d{1,2}\\s${MONTH}(?:\\s\\d{4})?|${MONTH}\\s\\d{1,2}(?:,\\s\\d{4})?|\\d{1,2}:\\d{2}(?:\\s?[AP]M)?)\\b`, "g");

/** `text` cut into its dates and the words between them, in order. */
export function datedParts(text: string): { text: string; date: boolean }[] {
  const parts: { text: string; date: boolean }[] = [];
  let from = 0;
  for (const match of text.matchAll(DATE)) {
    if (match.index > from) parts.push({ text: text.slice(from, match.index), date: false });
    parts.push({ text: match[0], date: true });
    from = match.index + match[0].length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), date: false });
  return parts;
}
