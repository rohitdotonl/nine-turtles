// Writing back (SPEC section 37, decision 0147): Write back on every article
// opens the reader's own email app, with the writer's address and "Re: the
// title" filled in. nine turtles never sends or reads that email: it only
// makes the `mailto:` link the email app opens.
//
// The address is the one the reader typed for the person, if they did (kept
// on every place of theirs); else the one the article's own place gives (a
// feed's author, a newsletter's sender); else any other place's.

import { sendChange } from "./http";
import { placesOf } from "./people";
import type { Feed } from "./shapes";

/** Where to write to the person `feed` is a place of, or undefined while nine turtles doesn't know. */
export function addressFor(feed: Feed, feeds: Feed[]): string | undefined {
  const places = placesOf(feed, feeds);
  return places.find((place) => place.writeTo)?.writeTo ?? feed.email ?? places.find((place) => place.email)?.email ?? undefined;
}

/** "Re: " and the title, once: a title that already starts with "Re:" keeps its own. */
export function replySubject(title: string): string {
  const plain = title.trim();
  if (!plain) return "";
  return /^re:/i.test(plain) ? plain : `Re: ${plain}`;
}

/** The link that opens the reader's email app, writing to `address` about the article `title`. */
export function writeBackLink(address: string, title: string): string {
  const to = address.split("@").map(encodeURIComponent).join("@");
  const subject = replySubject(title);
  return subject ? `mailto:${to}?subject=${encodeURIComponent(subject)}` : `mailto:${to}`;
}

/**
 * Whether `text` looks like one email address, at least as strictly as the
 * server checks it (`write_back::address`), so the email app never opens to
 * an address the server then refuses: one @, something before it, a
 * website's name after it, and no spaces or commas.
 */
export function looksLikeAddress(text: string): boolean {
  const address = text.trim().replace(/^mailto:/i, "");
  const [local = "", domain = "", ...more] = address.split("@");
  return (
    more.length === 0 &&
    address.length <= 254 &&
    local.length <= 64 &&
    /^[^\s@<>()[\]\\,;:".][^\s@<>()[\]\\,;:"]*$/.test(local) &&
    !local.endsWith(".") &&
    /^[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?(\.[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?)+$/u.test(domain)
  );
}

/** Why an address wasn't kept, in the reader's words; undefined once it was. */
export async function keepAddress(feed: number, address: string): Promise<string | undefined> {
  const { refusal } = await sendChange(`/api/feeds/${feed}/write-to`, { address: address.trim() }, ["not-an-address"]);
  switch (refusal) {
    case undefined:
      return undefined;
    case "not-an-address":
      return "That doesn't look like an email address. Check it and try again.";
    case "gone":
      return "You don't follow them any more, so there's nowhere to keep it.";
    case "trouble":
      return "That couldn't be saved. Try again in a moment.";
  }
}
