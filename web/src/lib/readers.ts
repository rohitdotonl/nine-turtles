// The readers of this nine turtles, and how new ones join (SPEC sections 1
// and 18, decision 0087). The owner sees everyone's email and when they
// joined (never what they read), sets their own email, and chooses whether
// anyone may sign up: Closed, with an invite link, or Open, which needs
// nine turtles to send confirmation emails (decision 0088). The sign-up page
// itself uses `signUp`.

import { api } from "./updates.svelte";

export type Person = { id: number; email: string | null; owner: boolean; createdAt: number };

export type SignUpMode = "closed" | "invite" | "open";

/** `openAvailable`: nine turtles can send email, so Open may be chosen. */
export type SignUpSettings = { mode: SignUpMode; inviteMadeAt: number | null; openAvailable: boolean };

/** The shortest password a new reader may choose. */
export const PASSWORD_MINIMUM = 12;

export async function listPeople(): Promise<Person[]> {
  const response = await api("/api/people", { cache: "no-store" });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
  const body: unknown = await response.json();
  const people = isRecord(body) && Array.isArray(body.people) ? body.people : [];
  return people.filter(isRecord).map((person) => ({
    id: Number(person.id),
    email: typeof person.email === "string" ? person.email : null,
    owner: person.owner === true,
    createdAt: Number(person.created_at),
  }));
}

export async function signUpSettings(): Promise<SignUpSettings> {
  const response = await api("/api/sign-up/settings", { cache: "no-store" });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
  const body: unknown = await response.json();
  return {
    mode: isRecord(body) && (body.sign_up === "invite" || body.sign_up === "open") ? body.sign_up : "closed",
    inviteMadeAt: isRecord(body) && typeof body.invite_made_at === "number" ? body.invite_made_at : null,
    openAvailable: isRecord(body) && body.open_available === true,
  };
}

/** Closed (which also forgets the invite link), Invite link, or Open (only while email can be sent). */
export async function switchSignUp(mode: SignUpMode): Promise<void> {
  const response = await api("/api/sign-up/switch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sign_up: mode }),
  });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
}

/** Makes a new invite link's ticket (the old link stops working) and returns it, this once. */
export async function makeInvite(): Promise<string> {
  const response = await api("/api/sign-up/invite", { method: "POST" });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
  const body: unknown = await response.json();
  if (isRecord(body) && typeof body.invite === "string") return body.invite;
  throw new Error("nine turtles sent no invite");
}

/**
 * The link to send: this site's own address, its sign-up page and the
 * ticket. The ticket goes after # (the address's fragment), which browsers
 * never send to any server, so it never ends up in a log.
 */
export function inviteLink(origin: string, ticket: string): string {
  return `${origin.replace(/\/+$/, "")}/sign-up#invite=${encodeURIComponent(ticket)}`;
}

/** The ticket in a sign-up page's fragment (`location.hash`), or "" if there's none. */
export function inviteFrom(hash: string): string {
  return new URLSearchParams(hash.replace(/^#/, "")).get("invite")?.trim() ?? "";
}

export type EmailResult = "ok" | "email" | "already" | "unreachable";

/** The owner's own email, to sign in with. */
export async function setOwnEmail(email: string): Promise<EmailResult> {
  let response: Response;
  try {
    response = await api("/api/people/me/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch {
    return "unreachable";
  }
  if (response.ok) return "ok";
  const error = await errorOf(response);
  return error === "email" || error === "already" ? error : "unreachable";
}

/** `confirm`: sign-up is Open, so a link went to this address (the account is made when it's followed). */
export type SignUpResult =
  | { ok: true; confirm?: string }
  | { ok: false; reason: "closed" | "email" | "password-short" | "password-long" | "already" | "too-many" | "unreachable" };

export async function signUp(email: string, password: string, invite: string): Promise<SignUpResult> {
  let response: Response;
  try {
    response = await api("/api/sign-up", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, invite }),
    });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  if (response.status === 202) return { ok: true, confirm: email };
  if (response.ok) return { ok: true };
  const error = await errorOf(response);
  switch (error) {
    case "closed":
    case "email":
    case "password-short":
    case "password-long":
    case "already":
    case "too-many":
      return { ok: false, reason: error };
    default:
      return { ok: false, reason: "unreachable" };
  }
}

/** What the sign-up page says after a try that didn't work. Plain and calm. */
export function explainSignUp(result: Exclude<SignUpResult, { ok: true }>): string {
  switch (result.reason) {
    case "closed":
      return "Sign-up isn't open. Ask whoever runs this nine turtles for a new invite link.";
    case "email":
      return "That doesn't look like an email address.";
    case "password-short":
      return `Choose a password of at least ${PASSWORD_MINIMUM} characters.`;
    case "password-long":
      return "That password is too long.";
    case "already":
      return "That email already has an account. Sign in instead.";
    case "too-many":
      return "Many people have signed up in the last hour. Try again later.";
    case "unreachable":
      return "nine turtles can't be reached right now. Try again in a moment.";
  }
}

/** One @ with something on each side, no spaces, at most 254 characters (as the server checks). */
export function plausibleEmail(text: string): boolean {
  const parts = text.split("@");
  return text.length <= 254 && parts.length === 2 && parts[0] !== "" && parts[1] !== "" && !/[\s\p{Cc}]/u.test(text);
}

export async function errorOf(response: Response): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null);
  return isRecord(body) ? body.error : undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
