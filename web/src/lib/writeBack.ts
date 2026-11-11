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
import type { Article, Feed } from "./shapes";
import { deviceText, setDeviceText } from "./device";
import { date } from "./times";

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

/** The longest an untitled post's opening words run in the subject, so it reads as a subject. */
const LONGEST_OPENING = 60;

/**
 * Which post the email is about: its title; else, for a post with no title
 * (a note), its opening words, cut at a word with "…"; else, for one with no
 * words at all (a picture), the day it was posted. Never empty, so the writer
 * can always tell which post it's about.
 */
export function aboutLine(article: Pick<Article, "title" | "opening" | "at">): string {
  if (article.title.trim()) return article.title;
  const words = article.opening?.replace(/\s+/g, " ").trim();
  if (!words) return `Your post of ${date(article.at)}`;
  // Counted in whole characters, so an emoji is never cut in half (a half can't be written into the link).
  const letters = Array.from(words);
  if (letters.length <= LONGEST_OPENING) return words;
  const cut = letters.slice(0, LONGEST_OPENING + 1).join("");
  const atWord = cut.lastIndexOf(" ");
  return `${(atWord > 0 ? cut.slice(0, atWord) : letters.slice(0, LONGEST_OPENING).join("")).replace(/[\s.,;:!?…-]+$/, "")}…`;
}

/** "Re: " and the title, once: a title that already starts with "Re:" keeps its own. */
export function replySubject(title: string): string {
  const plain = title.trim();
  if (!plain) return "";
  return /^re:/i.test(plain) ? plain : `Re: ${plain}`;
}

/**
 * The most the quotes may take once written into the link (spaces and other
 * letters grow there): some email apps, on Windows most, refuse a link much
 * longer than 2,000 characters.
 */
const LONGEST_QUOTES = 1500;

const linkSize = (text: string) => encodeURIComponent(text).length;

/** A quote as a person writes one in a letter, in curly quotes (decision 0257): "> " at each line's start reads as code to most people, and Gmail shows it as it is. */
const asQuote = (text: string) => `“${text.trim().split(/\n+/).map((line) => line.trim()).join("\n")}”`;

/** The first words of `text` that fit in `room`, ending "…"; empty when not even one does. */
function shortened(text: string, room: number): string {
  const words = text.trim().split(/(?<=\s)/);
  let kept = "";
  for (const word of words) {
    if (linkSize(asQuote(`${kept}${word}`.trimEnd() + "…")) > room) break;
    kept += word;
  }
  return kept.trim() ? asQuote(`${kept.trimEnd()}…`) : "";
}

/**
 * How the email starts when the reader highlighted or chose words (decision
 * 0205): each quote in curly quotes, as a person quotes in a letter (decision 0257), a
 * blank line after each, then room to write. Quotes that would make the link
 * too long are left out; when even the first is too long, its first words are
 * kept, ending "…", so the email never starts empty under a line saying it
 * starts with them.
 */
export function quotedBody(quotes: string[]): string {
  const kept: string[] = [];
  let size = 0;
  for (const quote of quotes) {
    if (!quote.trim()) continue;
    let lines = asQuote(quote);
    if (size + linkSize(lines) > LONGEST_QUOTES) {
      if (kept.length) break;
      lines = shortened(quote, LONGEST_QUOTES);
      if (!lines) break;
    }
    kept.push(lines);
    size += linkSize(lines) + linkSize("\n\n");
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
 * Where the reader writes email on this device (decision 0257): their own
 * email app (a `mailto:` link), or Gmail or Outlook.com in the browser, for a
 * computer whose email lives there and so has no email app to open. Chosen
 * under Write back once it's pressed, and kept on this device only: a phone
 * and a computer often differ.
 */
export type MailPlace = "app" | "gmail" | "outlook";

const MAIL_KEY = "nine-turtles.write-back-in";

export function mailPlace(): MailPlace {
  const kept = deviceText(MAIL_KEY);
  return kept === "gmail" || kept === "outlook" ? kept : "app";
}

export function keepMailPlace(place: MailPlace): void {
  setDeviceText(MAIL_KEY, place === "app" ? null : place);
}

/** Each place by its name, as the line under Write back says it. */
export const MAIL_NAMES: Record<MailPlace, string> = { app: "your email app", gmail: "Gmail", outlook: "Outlook.com" };

/** The new email, filled in as `writeBackLink` fills it: the page that starts one in Gmail or Outlook.com, else the `mailto:` link. */
export function composeLink(place: MailPlace, address: string, title: string, quotes: string[] = []): string {
  if (place === "app") return writeBackLink(address, title, quotes);
  const fields =
    place === "gmail"
      ? { base: "https://mail.google.com/mail/?view=cm&fs=1", to: "to", subject: "su" }
      : { base: "https://outlook.live.com/mail/0/deeplink/compose?", to: "to", subject: "subject" };
  const parts = [`${fields.to}=${encodeURIComponent(address)}`];
  const subject = replySubject(title);
  if (subject) parts.push(`${fields.subject}=${encodeURIComponent(subject)}`);
  const body = quotedBody(quotes);
  if (body) parts.push(`body=${encodeURIComponent(body)}`);
  return `${fields.base}${fields.base.endsWith("?") ? "" : "&"}${parts.join("&")}`;
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
export async function lookOnTheirSite(feed: number): Promise<SiteGave> {
  return siteGave(await sendChange(`/api/feeds/${feed}/look-for-address`, {}, []));
}

/**
 * Ask them for a feed (decision 0212): the address a site with no feed gives,
 * looked for the same way, on its home page and one contact or about page,
 * only because the reader pressed Write to. Nothing is kept: they don't follow it.
 */
export async function lookOnSite(site: string): Promise<SiteGave> {
  return siteGave(await sendChange("/api/sites/look-for-address", { site }, []));
}

type SiteGave = { address?: string; looked: boolean };

function siteGave({ answer }: { answer?: Record<string, unknown> }): SiteGave {
  const address = answer?.address;
  return {
    address: typeof address === "string" && looksLikeAddress(address) ? address : undefined,
    looked: answer?.looked === true,
  };
}

/** The email asking the writer of the site `name` ("june.example") for a feed: a short, plain request the reader can change. */
export function askForFeedLink(address: string, name: string): string {
  const to = address.split("@").map(encodeURIComponent).join("@");
  const subject = `A feed for ${name}?`;
  const body = `Hello,\n\nI'd like to follow ${name} in my feed reader, but couldn't find a feed for it (RSS or Atom). Would you add one?\n\nThank you.\n`;
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
      return "The address couldn't be saved. Try again in a moment.";
  }
}
