// The list's note (SPEC section 8), as the reading area shows it while the
// list isn't on screen: an article on a phone, or the list hidden on a
// computer (decision 0229). The list keeps it; the reading area only draws it.

/** What was just done, with what Undo or Try again would do, and how it's put away. */
export type ListNote = {
  words: string;
  undo?: () => void;
  retry?: () => void;
  /** "Try again", or "Sign in" when being signed out is why (decision 0230). */
  retryWord?: string;
  close: () => void;
};
