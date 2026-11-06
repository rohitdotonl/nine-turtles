// Writing back (SPEC section 37, decision 0147): Write back on every article
// opens the reader's own email app, with the writer's address and "Re: the
// title" filled in. nine turtles never sends or reads that email: it only
// makes the `mailto:` link the email app opens.
//
// The address is the one the reader typed for the person, if they did (kept
// on every place of theirs); else the one the article's own place gives (a
// feed's author, a newsletter's sender); else any other place's.
//
// Only people are written back to: a publication is something you read or
// watch (decision 0192), so it has no Write back anywhere.

import { sendChange } from "./http";
import { placesOf } from "./people";
import type { Feed } from "./shapes";

/** Write back is offered for a person only, never a publication (decision 0192). */
export function writesBack(feed: Pick<Feed, "kind"> | undefined): boolean {
  return feed !== undefined && feed.kind !== "publication";
}

/** Where to write to the person `feed` is a place of, or undefined while nine turtles doesn't know. */
export function addressFor(feed: Feed, feeds: Feed[]): string | undefined {
  const places = placesOf(feed, feeds);
  return places.find((place) => place.writeTo)?.writeTo ?? feed.email ?? places.find((place) => place.email)?.email ?? undefined;
}

/**
 * The writer's website, for finding their address there: the site their feed
 * names, else the home page of the article's own. Undefined when there's
 * neither (a newsletter, often), or it isn't a web page.
 */
export function siteOf(feed: Pick<Feed, "siteUrl"> | undefined, articleLink: string | null | undefined): string | undefined {
  const site = webPage(feed?.siteUrl);
  if (site) return site.href;
  const article = webPage(articleLink);
  return article && `${article.origin}/`;
}

function webPage(address: string | null | undefined): URL | undefined {
  if (!address) return undefined;
  try {
    const url = new URL(address);
    return url.protocol === "http:" || url.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

/** "Re: " and the title, once: a title that already starts with "Re:" keeps its own. */
export function replySubject(title: string): string {
  const plain = title.trim();
  if (!plain) return "";
  return /^re:/i.test(plain) ? plain : `Re: ${plain}`;
}

/** The most of the reader's highlights an email starts with: some email apps refuse a longer link. */
const LONGEST_QUOTES = 1500;

/**
 * How the email starts when the reader highlighted words (decision 0205): each
 * quote on lines of its own beginning "> ", as email apps quote, a blank line
 * after each, then room to write. Quotes past 1,500 characters are left out.
 */
export function quotedBody(quotes: string[]): string {
  const kept: string[] = [];
  let size = 0;
  for (const quote of quotes) {
    if (!quote.trim()) continue;
    const lines = quote.trim().split(/\n+/).map((line) => `> ${line.trim()}`).join("\n");
    if (size + lines.length > LONGEST_QUOTES) continue;
    kept.push(lines);
    size += lines.length;
  }
  return kept.length ? `${kept.join("\n\n")}\n\n` : "";
}

/** The link that opens the reader's email app, writing to `address` about the article `title`, starting with any `quotes`. */
export function writeBackLink(address: string, title: string, quotes: string[] = []): string {
  const to = address.split("@").map(encodeURIComponent).join("@");
  const parts: string[] = [];
  const subject = replySubject(title);
  if (subject) parts.push(`subject=${encodeURIComponent(subject)}`);
  const body = quotedBody(quotes);
  if (body) parts.push(`body=${encodeURIComponent(body)}`);
  return parts.length ? `mailto:${to}?${parts.join("&")}` : `mailto:${to}`;
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

/**
 * The address the writer's own site gives, if it gives one (decision 0168):
 * nine turtles' server looks once on their home page and one contact or
 * about page, only because the reader pressed Write back, and never twice for
 * the same writer. `looked` is false when it couldn't look just now (their
 * site didn't answer, it's already looking, or nine turtles can't be reached).
 */
export async function lookOnTheirSite(feed: number): Promise<{ address?: string; looked: boolean }> {
  const { answer } = await sendChange(`/api/feeds/${feed}/look-for-address`, {}, []);
  const address = answer?.address;
  return {
    address: typeof address === "string" && looksLikeAddress(address) ? address : undefined,
    looked: answer?.looked === true,
  };
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
