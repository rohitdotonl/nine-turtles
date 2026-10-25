// What email makes possible for a reader's account (SPEC sections 1 and 18,
// decision 0088): "Forgot your password?", the page a password link opens,
// the page a confirmation link opens (a new account's address, or a changed
// one), changing one's email in Settings, and deleting one's account.
// Every link carries a ticket after the # in its address (#ticket=…), the part
// no browser sends to a server, so it never reaches a log; it's sent to the server
// once and then taken out of the address bar.

import { PASSWORD_MINIMUM, errorOf, isRecord } from "./readers";
import { duration } from "./session";
import { api } from "./updates.svelte";

/** The two pages an emailed link opens. */
export const RESET_PAGE = "/reset-password";
export const CONFIRM_PAGE = "/confirm-email";

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

export type ForgotResult = "asked" | "email" | "no-email" | "unreachable";

/** Asks for a password link. The server answers the same whether or not the address has an account. */
export async function forgotPassword(email: string): Promise<ForgotResult> {
  const response = await send("/api/password/forgot", { email: email.trim() });
  if (!response) return "unreachable";
  if (response.ok) return "asked";
  const error = await errorOf(response);
  return error === "email" || error === "no-email" ? error : "unreachable";
}

/** The one answer "Forgot your password?" gives, whoever asks. */
export function explainForgot(result: ForgotResult, email: string): string {
  switch (result) {
    case "asked":
      return `If ${email.trim()} has an account here, a link to choose a new password is on its way. It works for an hour.`;
    case "email":
      return "That doesn't look like an email address.";
    case "no-email":
      return "This nine turtles can't send email yet. Ask whoever runs it to set a new password for you.";
    case "unreachable":
      return "nine turtles can't be reached right now. Try again in a moment.";
  }
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

export type Confirmed = { done: "signed-up" | "changed"; email: string };

/** Follows a confirmation link: a new account is made (and this device signed in), or an email changes. */
export async function confirmEmail(ticket: string): Promise<Confirmed | Exclude<LinkResult, "ok">> {
  const response = await send("/api/email/confirm", { ticket });
  if (!response) return "unreachable";
  if (response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const done = isRecord(body) && body.done === "changed" ? "changed" : "signed-up";
    return { done, email: isRecord(body) && typeof body.email === "string" ? body.email : "" };
  }
  const result = linkResult(await errorOf(response));
  return result === "ok" ? "unreachable" : result;
}

/** What a link's page says when it didn't work. Plain and calm. */
export function explainLink(result: Exclude<LinkResult, "ok">, page: "reset" | "confirm"): string {
  switch (result) {
    case "expired":
      return page === "reset"
        ? "This link has expired or was already used. Ask for a new one from the sign-in page."
        : "This link has expired or was already used. Sign in, or sign up again for a new link.";
    case "already":
      return "That email already has an account. Sign in instead.";
    case "too-many":
      return "Many people have signed up in the last hour. Try this link again later.";
    case "password-short":
      return `Choose a password of at least ${PASSWORD_MINIMUM} characters.`;
    case "password-long":
      return "That password is too long.";
    case "unreachable":
      return "nine turtles can't be reached right now. Try again in a moment.";
  }
}

export type ChangeResult =
  | { ok: true; sentTo: string }
  | { ok: false; reason: "email" | "same" | "wrong-password" | "too-many" | "no-email" | "unreachable" }
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
    case "wrong-password":
      return "That isn't your password.";
    case "wait":
      return `Too many wrong tries. Try again in ${duration(result.waitSeconds)}.`;
    case "too-many":
      return "Enough links have gone out for now. Try again in an hour.";
    case "no-email":
      return "This nine turtles can't send email yet, so your email can't be changed here.";
    case "unreachable":
      return "nine turtles can't be reached right now. Try again in a moment.";
  }
}

/** Deletes the signed-in reader's account and everything theirs, for good. */
export async function deleteAccount(): Promise<boolean> {
  const response = await send("/api/people/me/delete", {});
  return response?.ok === true;
}
