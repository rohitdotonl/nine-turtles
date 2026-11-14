// The list's note (SPEC section 8), as the reading area shows it while the
// list isn't on screen: an article on a phone, or the list hidden on a
// computer (decision 0229). The list keeps it; the reading area only draws it.
// Write back's "Opening your email app…" takes the same shape (SPEC section 37).

/** What was just done, with what Undo or Try again would do, and how it's put away. */
export type ListNote = {
  words: string;
  undo?: () => void;
  retry?: () => void;
  /** "Try again", or "Sign in" when being signed out is why (decision 0230). */
  retryWord?: string;
  /** That button opens more of the note instead of putting it away (Write back's "Didn't open?"): the keyboard stays in the note. */
  retryOpens?: boolean;
  /** Something failed: oxblood, with the alert icon (BRAND.md → "Messages"). */
  refusal?: boolean;
  /** Other ways on, before Try again: Write back's "Write in Gmail" (SPEC section 37). */
  also?: { word: string; press: () => void }[];
  close: () => void;
};
