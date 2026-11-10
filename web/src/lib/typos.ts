/**
 * Slips in what the reader types, and their one obvious repair (decision
 * 0234): a mistyped web address in Add (SPEC section 3) and a mistyped
 * email provider on sign-up, sign-in and Change email (SPEC sections 1 and
 * 18). Everything is worked out here on the device, nothing is looked up or
 * visited, and nothing is ever changed by itself: the repair is offered as a
 * button the reader presses.
 */
import { mailProvider } from "./accounts";
import { NOT_AN_ADDRESS } from "./messages";

/** The providers whose names are checked for slips. Anything else is left alone. */
const PROVIDERS = ["gmail.com", "outlook.com", "hotmail.com", "icloud.com", "yahoo.com", "proton.me"];

/** Real providers one slip away from one above: never "corrected" into it. */
const ALSO_REAL = ["mail.com", "ymail.com", "email.com", "gmx.com", "aol.com", "cloud.com"];

/** A US keyboard's rows, to know which keys sit beside each other. */
const ROWS = ["1234567890-", "qwertyuiop", "asdfghjkl;", "zxcvbnm,./"];

/** The keys touching `key` on a keyboard: beside it, and the two above and below. */
function besideKeys(key: string): string {
  const row = ROWS.findIndex((each) => each.includes(key));
  if (row < 0) return "";
  const column = ROWS[row]!.indexOf(key);
  const near = (r: number, columns: number[]) => columns.map((c) => ROWS[r]?.[c] ?? "").join("");
  return near(row, [column - 1, column + 1]) + near(row - 1, [column, column + 1]) + near(row + 1, [column - 1, column]);
}

/**
 * Whether `typed` is `meant` with one slip: a letter missing, doubled or
 * added, two letters swapped, or one key hit for the key beside it.
 */
function oneSlip(typed: string, meant: string): boolean {
  if (typed === meant) return false;
  if (typed.length === meant.length) {
    const differ = [...meant].map((_, i) => i).filter((i) => typed[i] !== meant[i]);
    if (differ.length === 1) return besideKeys(meant[differ[0]!]!).includes(typed[differ[0]!]!);
    const [a, b] = differ;
    return differ.length === 2 && b === a! + 1 && typed[a!] === meant[b] && typed[b] === meant[a!];
  }
  const [longer, shorter] = typed.length > meant.length ? [typed, meant] : [meant, typed];
  if (longer.length !== shorter.length + 1) return false;
  return [...longer].some((_, i) => longer.slice(0, i) + longer.slice(i + 1) === shorter);
}

/**
 * The address the reader probably meant, when the part after the @ is a
 * well-known provider with one slip (a letter, a dot, a space, a wrong
 * ending such as ".con" or ".co"), or nothing. The part before the @ is
 * never touched, and unknown providers are left alone.
 */
export function emailFix(typed: string): string | undefined {
  const text = typed.trim();
  const at = text.lastIndexOf("@");
  if (at < 1 || text.indexOf("@") !== at) return undefined;
  const domain = text.slice(at + 1).toLowerCase();
  const cleaned = domain.replace(/\s+/g, "").replace(/\.+$/, "");
  if (cleaned === "" || ALSO_REAL.includes(cleaned) || mailProvider(cleaned)) {
    return cleaned !== domain && PROVIDERS.includes(cleaned) ? `${text.slice(0, at)}@${cleaned}` : undefined;
  }
  // ".comm" and ".co" are one slip from ".com" too, as is "gmailcom" from "gmail.com".
  const meant = PROVIDERS.filter((provider) => oneSlip(cleaned, provider));
  return meant.length === 1 ? `${text.slice(0, at)}@${meant[0]}` : undefined;
}

/** Endings no site has, each one slip from the one meant. Real ones (.co, .cm, .om) are left alone. */
const ENDINGS: Record<string, string> = {
  con: "com",
  cmo: "com",
  ocm: "com",
  comm: "com",
  cpm: "com",
  vom: "com",
  xom: "com",
  ogr: "org",
  orgg: "org",
  prg: "org",
  nte: "net",
};

/** The quotes and brackets a paste brings along, each opening one with its closing one. */
const PAIRS: Record<string, string> = { '"': '"', "'": "'", "“": "”", "‘": "’", "<": ">", "(": ")", "[": "]", "{": "}" };

/**
 * `text` without the quotes or brackets wrapped around it. An address never
 * starts with one, so an opening one goes; a closing one only with its
 * opening one, as "Foo_(bar)" or "?x=[1]" may end in one.
 */
function unwrapped(text: string): string {
  const opened: string[] = [];
  let rest = text;
  while (rest[0] && PAIRS[rest[0]]) {
    opened.push(PAIRS[rest[0]]!);
    rest = rest.slice(1).trim();
  }
  while (rest.length > 0 && rest[rest.length - 1] === opened[opened.length - 1]) {
    opened.pop();
    rest = rest.slice(0, -1).trim();
  }
  return rest;
}

/** Servers people are followed on by a handle (`@name@server`), not a website: no site to offer. */
const HANDLE_SERVER = /(^|\.)(mastodon|mstdn)\.|\.social$/i;

export type AddressFix = {
  /** The address as it was probably meant. */
  address: string;
  /** What the reader typed was an email address: the fix is the website after its @. */
  email?: boolean;
  /** The one slip was a comma, semicolon or space where a dot goes. */
  dot?: boolean;
};

/**
 * The web address the reader probably meant, when what they typed has one
 * obvious repair (decision 0234), or nothing. Only the parts nine turtles can
 * be sure of are repaired: the "https://" at the start, the site's name and
 * its ending. Nothing is visited to guess.
 */
export function addressFix(typed: string): AddressFix | undefined {
  const text = typed.trim();
  const bare = unwrapped(text.replace(/[.,;:]+$/, "")).replace(/[.,;:\\]+$/, "");
  let rest = bare;
  // An email address pasted in: their website is the part after the @, unless that's an email provider.
  const email = /^[^\s@/:]+@([^\s@/:]+\.[^\s@/:]+)$/.exec(rest.replace(/^mailto:/i, ""));
  if (email) {
    const site = email[1]!.toLowerCase();
    return mailProvider(site) || PROVIDERS.includes(site) || ALSO_REAL.includes(site) || HANDLE_SERVER.test(site) ? undefined : { address: site, email: true };
  }
  // "htps://", "https;//", "http//", "https:/": the start of an address, mistyped.
  let start = "";
  const scheme = /^(h{1,2}t{1,2}p{1,2}(s?))[:;]?\/{0,3}/i.exec(rest);
  if (scheme && /[:;/]/.test(scheme[0])) {
    start = scheme[2] ? "https://" : "http://";
    rest = rest.slice(scheme[0].length);
  } else if (/^[a-z]+:\/\//i.test(rest)) {
    return undefined;
  }
  const cut = rest.search(/[/?#]/);
  const [host, path] = cut < 0 ? [rest, ""] : [rest.slice(0, cut), rest.slice(cut)];
  if (host.includes("[") || host.includes("@")) return undefined;
  let name = host.replace(/\s*([.,;])\s*/g, "$1").replace(/[,;]/g, ".");
  if (/\s/.test(name)) {
    // A space for the dot only when it's the one place a dot could go.
    if (name.includes(".") || name.trim().split(/\s+/).length !== 2) return undefined;
    name = name.trim().replace(/\s+/, ".");
  }
  name = name.replace(/\.{2,}/g, ".").replace(/^\.+|\.+$/g, "");
  const port = /:\d+$/.exec(name)?.[0] ?? "";
  const labels = name.slice(0, name.length - port.length).split(".");
  const ending = ENDINGS[labels[labels.length - 1]!.toLowerCase()];
  if (labels.length > 1 && ending) labels[labels.length - 1] = ending;
  const address = start + labels.join(".") + port + path;
  if (labels.length < 2 || labels.some((label) => !/^[\p{L}\p{N}-]+$/u.test(label))) return undefined;
  // Capitals change nothing in an address's start or its site's name.
  const typedAs = text.toLowerCase();
  if ([typedAs, typedAs.replace(/^https:\/\//, "")].includes(address.toLowerCase())) return undefined;
  // A dot where a comma, semicolon or space was is all that changed.
  const dot = bare === text && start === "" && /[,;\s]/.test(host) && host.replace(/\s*[,;\s]\s*/g, ".") === labels.join(".") + port;
  return { address, ...(dot ? { dot } : {}) };
}

/** What Add says about an address with one obvious repair; Use, beside it, makes it. */
export function addressSlip(fix: AddressFix): string {
  if (fix.email) return `That's an email address. Did you mean their website, ${fix.address}?`;
  return `${NOT_AN_ADDRESS} Did you mean ${fix.address}${fix.dot ? ", with a dot" : ""}?`;
}

/** How long a fix must have been on screen to count as seen: a press after that sends what was typed. */
const SEEN_MS = 1000;

/**
 * When the button under an email field pauses, once, to offer a fix instead of
 * sending (decision 0234). Not when the fix has been on screen for a moment
 * already (it appeared on leaving the field, and the reader went on), and
 * never twice for one email: a second press sends it as typed.
 */
export function slipPause() {
  let shown = "";
  let at = 0;
  let paused = "";
  return {
    /** The fix for `email` appeared on leaving the field. */
    shown(email: string) {
      if (shown !== email.trim()) [shown, at] = [email.trim(), Date.now()];
    },
    /** Whether this press, with a fix for `email`, pauses rather than sends. */
    pauses(email: string): boolean {
      const typed = email.trim();
      if (paused === typed || (shown === typed && Date.now() - at >= SEEN_MS)) return false;
      paused = typed;
      return true;
    },
  };
}
