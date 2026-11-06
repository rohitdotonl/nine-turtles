// What email makes possible for a reader's account (SPEC sections 1 and 18,
// decisions 0088, 0096 and 0122): "Forgot?", which emails a link that signs in,
// and the page that link opens (where a new password may be chosen); the page an
// older password link opens,
// the page a confirmation link opens (a new account's address, or a changed
// one), changing one's email in Settings, and deleting one's account.
// Every link carries a ticket after the # in its address (#ticket=…), the part
// no browser sends to a server, so it never reaches a log; it's sent to the server
// once and then taken out of the address bar.

import { PASSWORD_MINIMUM, errorOf } from "./readers";
import { isRecord } from "./http";
import { duration } from "./session";
import { api } from "./updates.svelte";
import { UNREACHABLE } from "./messages";

/** The pages an emailed link opens. */
export const RESET_PAGE = "/reset-password";
export const CONFIRM_PAGE = "/confirm-email";
export const SIGN_IN_LINK_PAGE = "/sign-in-link";

/** The ticket after the # in a link's address, or "" if there's none. */
export function ticketFrom(hash: string): string {
  return new URLSearchParams(hash.replace(/^#/, "")).get("ticket")?.trim() ?? "";
}

async function send(path: string, body: unknown): Promise<Response | undefined> {
  try {
    return await api(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return undefined;
  }
}

/** After a link is sent, "Send again" waits this long; the server sends one link of a kind a minute anyway. */
export const RESEND_AFTER_SECONDS = 60;

/** The webmail a few big providers' addresses read in, by the part after the @. */
const INBOXES: { name: string; url: string; domains: string[] }[] = [
  { name: "Gmail", url: "https://mail.google.com/", domains: ["gmail.com", "googlemail.com"] },
  {
    name: "Outlook",
    url: "https://outlook.live.com/mail/",
    domains: [
      "outlook.com",
      "outlook.co.uk",
      "hotmail.com",
      "hotmail.co.uk",
      "hotmail.fr",
      "hotmail.de",
      "live.com",
      "live.co.uk",
      "msn.com",
    ],
  },
  { name: "iCloud Mail", url: "https://www.icloud.com/mail/", domains: ["icloud.com", "me.com", "mac.com"] },
  { name: "Proton Mail", url: "https://mail.proton.me/", domains: ["proton.me", "protonmail.com", "protonmail.ch", "pm.me"] },
];

/**
 * Where the reader of `email` can open their inbox, when its address says
 * (decision 0195), or nothing: offered as a link to press, never opened by itself.
 */
export function inboxFor(email: string): { name: string; url: string } | undefined {
  const domain = email.trim().toLowerCase().split("@").pop() ?? "";
  const inbox = INBOXES.find((inbox) => inbox.domains.includes(domain));
  return inbox && { name: inbox.name, url: inbox.url };
}

export type AskResult = "asked" | "email" | "no-email" | "unreachable";

/** How long a sign-in link works, in minutes (the server's `SIGN_IN_LIFETIME`). */
export const SIGN_IN_LINK_MINUTES = 15;

/**
 * "Forgot?" on the sign-in page (decision 0122): asks for a link that signs in,
 * after which the reader may choose a new password. The server answers the same
 * whether or not the address has an account.
 */
export async function askForLink(email: string): Promise<AskResult> {
  const response = await send("/api/sign-in/link", { email: email.trim() });
  if (!response) return "unreachable";
  if (response.ok) return "asked";
  const error = await errorOf(response);
  return error === "email" || error === "no-email" ? error : "unreachable";
}

/** The one answer asking for a link gives, whoever asks (shown under "Check your email"). */
export function explainAsked(result: AskResult, email: string): string {
  switch (result) {
    case "asked":
      return `If ${email.trim()} has an account here, a link is on its way. It works once, within ${SIGN_IN_LINK_MINUTES} minutes.`;
    case "email":
      return "That doesn't look like an email address.";
    case "no-email":
      return "This nine turtles can't send email yet. Ask whoever runs it to set a new password for you.";
    case "unreachable":
      return UNREACHABLE;
  }
}

export type LinkSignIn = { ok: true; passwordTicket: string } | { ok: false; reason: "expired" | "unreachable" };

/**
 * Signs this device in from a sign-in link. The answer carries a ticket for choosing
 * a new password straight after, if the reader wishes ("" when there's none).
 */
export async function signInByLink(ticket: string): Promise<LinkSignIn> {
  const response = await send("/api/sign-in/link/use", { ticket });
  if (!response) return { ok: false, reason: "unreachable" };
  if (response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const passwordTicket = isRecord(body) && typeof body.password_ticket === "string" ? body.password_ticket : "";
    return { ok: true, passwordTicket };
  }
  return { ok: false, reason: (await errorOf(response)) === "expired" ? "expired" : "unreachable" };
}

export type LinkResult = "ok" | "expired" | "already" | "too-many" | "password-short" | "password-long" | "unreachable";

function linkResult(error: unknown): LinkResult {
  return error === "expired" ||
    error === "already" ||
    error === "too-many" ||
    error === "password-short" ||
    error === "password-long"
    ? error
    : "unreachable";
}

/** Sets a new password from a password link; on success this device is signed in, every other one out. */
export async function resetPassword(ticket: string, password: string): Promise<LinkResult> {
  const response = await send("/api/password/reset", { ticket, password });
  if (!response) return "unreachable";
  if (response.ok) return "ok";
  return linkResult(await errorOf(response));
}

export type Confirmed = { email: string };

/** Follows a confirmation link: the reader's email changes to the one it went to. */
export async function confirmEmail(ticket: string): Promise<Confirmed | Exclude<LinkResult, "ok">> {
  const response = await send("/api/email/confirm", { ticket });
  if (!response) return "unreachable";
  if (response.ok) {
    const body: unknown = await response.json().catch(() => null);
    return { email: isRecord(body) && typeof body.email === "string" ? body.email : "" };
  }
  const result = linkResult(await errorOf(response));
  return result === "ok" ? "unreachable" : result;
}

/** What a link's page says when it didn't work. Plain and calm. */
export function explainLink(result: Exclude<LinkResult, "ok">, page: "reset" | "confirm" | "sign-in"): string {
  switch (result) {
    case "expired":
      return page === "confirm"
        ? "This link has expired or was already used. Change your email again in Settings for a new one."
        : "This link has expired or was already used. Ask for a new one from the sign-in page.";
    case "already":
      return "That email already has an account. Sign in instead.";
    case "too-many":
      return "Many people have signed up in the last hour. Try this link again in an hour.";
    case "password-short":
      return `Choose a password of at least ${PASSWORD_MINIMUM} characters.`;
    case "password-long":
      return "That password is too long.";
    case "unreachable":
      return UNREACHABLE;
  }
}

export type ChangeResult =
  | { ok: true; sentTo: string }
  | { ok: false; reason: "email" | "same" | "password-needed" | "wrong-password" | "too-many" | "no-email" | "unreachable" }
  | { ok: false; reason: "wait"; waitSeconds: number };

/** Asks to move to a new email: a link goes there, and nothing changes until it's followed. */
export async function changeEmail(email: string, password: string): Promise<ChangeResult> {
  const response = await send("/api/people/me/email/change", { email: email.trim(), password });
  if (!response) return { ok: false, reason: "unreachable" };
  if (response.ok) return { ok: true, sentTo: email.trim() };
  const body: unknown = await response.json().catch(() => null);
  const error = isRecord(body) ? body.error : undefined;
  if (error === "wait" && isRecord(body) && typeof body.wait_seconds === "number") {
    return { ok: false, reason: "wait", waitSeconds: body.wait_seconds };
  }
  switch (error) {
    case "email":
    case "same":
    case "password-needed":
    case "wrong-password":
    case "too-many":
    case "no-email":
      return { ok: false, reason: error };
    default:
      return { ok: false, reason: "unreachable" };
  }
}

export function explainChange(result: ChangeResult): string {
  if (result.ok) {
    return `A link is on its way to ${result.sentTo}. Open it within 24 hours to use that address; until then, your email stays as it is.`;
  }
  switch (result.reason) {
    case "email":
      return "That doesn't look like an email address.";
    case "same":
      return "That's already your email.";
    case "password-needed":
      return "Type your password first.";
    case "wrong-password":
      return "That isn't your password.";
    case "wait":
      return `Too many wrong tries. Try again in ${duration(result.waitSeconds)}.`;
    case "too-many":
      return "Enough links have gone out for now. Try again in an hour.";
    case "no-email":
      return "This nine turtles can't send email yet, so your email can't be changed here.";
    case "unreachable":
      return UNREACHABLE;
  }
}

/**
 * What a change made with the reader's own password answered (decision 0200):
 * a new password, deleting the account, deleting the data.
 */
export type ConfirmResult =
  | { ok: true }
  | {
      ok: false;
      reason: "password-needed" | "wrong-password" | "password-short" | "password-long" | "plan" | "unreachable";
    }
  | { ok: false; reason: "wait"; waitSeconds: number };

async function confirmed(path: string, body: unknown): Promise<ConfirmResult> {
  const response = await send(path, body);
  if (!response) return { ok: false, reason: "unreachable" };
  if (response.ok) return { ok: true };
  const answer: unknown = await response.json().catch(() => null);
  const error = isRecord(answer) ? answer.error : undefined;
  if (error === "wait" && isRecord(answer) && typeof answer.wait_seconds === "number") {
    return { ok: false, reason: "wait", waitSeconds: answer.wait_seconds };
  }
  switch (error) {
    case "password-needed":
    case "wrong-password":
    case "password-short":
    case "password-long":
    case "plan":
      return { ok: false, reason: error };
    default:
      return { ok: false, reason: "unreachable" };
  }
}

/** Settings › Account › Change password…: the current password, then the new one. */
export function changePassword(current: string, password: string): Promise<ConfirmResult> {
  return confirmed("/api/people/me/password", { current, password });
}

/** Deletes the signed-in reader's account and everything theirs, for good, once their password is typed. */
export function deleteAccount(password: string): Promise<ConfirmResult> {
  return confirmed("/api/people/me/delete", { password });
}

/** Empties the signed-in reader's account, for good, keeping them signed in (decision 0117), once their password is typed. */
export function deleteData(password: string): Promise<ConfirmResult> {
  return confirmed("/api/people/me/data/delete", { password });
}

/** What to say when a change made with the reader's password didn't happen; `failed` says what was kept. */
export function explainConfirm(result: Exclude<ConfirmResult, { ok: true }>, failed: string): string {
  switch (result.reason) {
    case "password-needed":
      return "Type your password first.";
    case "wrong-password":
      return "That isn't your password.";
    case "wait":
      return `Too many wrong tries. Try again in ${duration(result.waitSeconds)}.`;
    case "password-short":
      return `Choose a new password of at least ${PASSWORD_MINIMUM} characters.`;
    case "password-long":
      return "That new password is too long.";
    case "unreachable":
      return UNREACHABLE;
    case "plan":
      return failed;
  }
}
