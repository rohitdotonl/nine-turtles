// Every number in the interface has a plain zero (decision 0311), but a web
// or email address inside a sentence ("Use example.com/feed0 instead?",
// "A link is on its way to sam@example.com.") keeps Atkinson's crossed zero,
// which tells 0 from O (fonts.css → .address). This finds those addresses.

/** An email address, or a web address with or without its https://: names with dots between them, ending in two letters or more, then any port and path. */
const ADDRESS = /^(?:https?:\/\/)?(?:[^\s@]+@)?(?:[\p{L}\p{N}_-]+\.)+\p{L}{2,}(?::\d+)?(?:[/?#]\S*)?$/u;

/** What a sentence puts after a word, which isn't part of the address: a full stop, a comma, a closing quote. */
const AFTER = /[.,;:!?)\]”’"']+$/;
/** `text` cut into its addresses and the words between them, in order. */
export function addressParts(text: string): { text: string; address: boolean }[] {
  const parts: { text: string; address: boolean }[] = [];
  let words = "";
  for (const piece of text.split(/(\s+)/)) {
    const after = piece.match(AFTER)?.[0] ?? "";
    const word = piece.slice(0, piece.length - after.length);
    if (!ADDRESS.test(word)) {
      words += piece;
      continue;
    }
    if (words) parts.push({ text: words, address: false });
    parts.push({ text: word, address: true });
    words = after;
  }
  if (words) parts.push({ text: words, address: false });
  return parts;
}
