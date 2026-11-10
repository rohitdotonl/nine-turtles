// Each open article has an address of its own (decision 0233), so the
// browser's habits work on it: Command-click, Ctrl-click or a middle click on
// a row opens it in a new tab, and the row's menu offers Open in a new tab and
// Copy link on a computer, Share on a phone. Copy link and Share give the
// original's address, the publisher's, as the article's own More does: a
// nine turtles address only opens for the reader who has it.

import type { MenuItem } from "./MoreMenu.svelte";
import type { Article } from "./shapes";

/** Phones get the system's share sheet; computers get Copy link (SPEC section 21). */
export const sharing =
  typeof navigator !== "undefined" && typeof navigator.share === "function" && matchMedia("(hover: none) and (pointer: coarse)").matches;

/** Opens one of nine turtles' addresses in a new tab. */
function openInNewTab(address: string) {
  window.open(address, "_blank", "noopener");
}

/**
 * On a row (`use:opensElsewhere`): Command-click or Ctrl-click, or a middle
 * click, opens `address()` in a new tab, as on a link; a plain click is the row's own.
 */
export function opensElsewhere(row: HTMLElement, address: () => string) {
  const away = (event: MouseEvent) => {
    const to = address();
    if (!to || (event.type === "click" ? !(event.metaKey || event.ctrlKey) : event.button !== 1)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openInNewTab(to);
  };
  row.addEventListener("click", away, true);
  row.addEventListener("auxclick", away);
  return {
    destroy() {
      row.removeEventListener("click", away, true);
      row.removeEventListener("auxclick", away);
    },
  };
}

/** Puts the original's address on the clipboard; what to say then. */
export async function copyOriginal(link: string): Promise<string> {
  try {
    await navigator.clipboard.writeText(link);
    return "Link copied.";
  } catch {
    return "The link couldn't be copied. Use View original and copy it from there.";
  }
}

/** The system's share sheet with the original's address; closing it without sharing is fine. */
export async function shareOriginal(article: Article) {
  if (!article.link) return;
  try {
    await navigator.share({ url: article.link, title: article.title });
  } catch {
    // Closed without sharing.
  }
}

/** A row menu's ways out (decision 0233): Open in a new tab and Copy link, or on a phone Share. */
export function linkItems(article: Article, address: string, say: (message: string) => void): MenuItem[] {
  const link = article.link;
  if (sharing) return link ? [{ label: "Share", onSelect: () => void shareOriginal(article) }] : [];
  return [
    { label: "Open in a new tab", onSelect: () => openInNewTab(address) },
    ...(link ? [{ label: "Copy link", onSelect: () => void copyOriginal(link).then(say) }] : []),
  ];
}
