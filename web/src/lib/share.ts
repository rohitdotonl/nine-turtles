// Adding a feed from somewhere else (SPEC section 3, decision 0104): a
// phone's share menu, Apple's Shortcuts app, or a bookmark in a computer's
// browser opens /add-feed with the page's address in it. Share menus put
// the address in `url`, or inside `text` with words around it, or (rarely)
// in `title`; this finds it.

/** The longest address taken from a shared link: no real one is longer. */
const LONGEST = 2048;

/** The first web address in some text, without the full stop or bracket that often follows one in a sentence. */
export function firstWebAddress(text: string): string {
  const found = text.match(/https?:\/\/[^\s<>"'`]+/i)?.[0] ?? "";
  return found.replace(/[.,;:!?)\]}»”’]+$/u, "").slice(0, LONGEST);
}

/**
 * The address a shared link carries: `url` when it has one, otherwise the
 * first web address in `text`, then in `title`. Empty when there's none.
 */
export function sharedAddress(search: string): string {
  const params = new URLSearchParams(search);
  const url = (params.get("url") ?? "").trim();
  if (url) return url.slice(0, LONGEST);
  return firstWebAddress(params.get("text") ?? "") || firstWebAddress(params.get("title") ?? "");
}

/**
 * The address a bookmark in a computer's browser can hold ("bookmarklet":
 * a bookmark that runs a line of JavaScript): pressed on any page, it opens
 * this nine turtles' Add a feed with that page's address. `void` keeps the
 * browser from showing the address as a page of text before it goes.
 */
export function bookmarklet(origin: string): string {
  return `javascript:void(location.href='${origin}/add?url='+encodeURIComponent(location.href))`;
}

/**
 * The ready-made Apple Shortcut for iPhone and iPad (decision 0177): made
 * once on the owner's iPhone and shared through iCloud, since Apple lets no
 * one else make that link. It opens app.nineturtles.app/add?url=<the page>.
 */
export const SHORTCUT_LINK = "";
