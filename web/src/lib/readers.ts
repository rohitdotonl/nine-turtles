// The readers of this nine turtles, and how new ones join (SPEC sections 1
// and 18, decisions 0087 and 0115). The owner sees everyone's email and when
// they joined (never what they read) and sets their own email. Sign-up is
// always open; the sign-up page itself uses `signUp`.

import { api } from "./updates.svelte";

export type Person = { id: number; email: string | null; owner: boolean; createdAt: number };

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

export type EmailResult =
  | { ok: true }
  | { ok: false; reason: "email" | "already" | "wrong-password" | "unreachable" }
  | { ok: false; reason: "wait"; waitSeconds: number };

/**
 * The owner's own email, to sign in with and to get "Forgot your password?"
 * links at. Their current password goes with it (decision 0088), so a
 * device left signed in can't send those links somewhere else.
 */
export async function setOwnEmail(email: string, password: string): Promise<EmailResult> {
  let response: Response;
  try {
    response = await api("/api/people/me/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  if (response.ok) return { ok: true };
  const body: unknown = await response.json().catch(() => null);
  const error = isRecord(body) ? body.error : undefined;
  if (error === "wait" && isRecord(body) && typeof body.wait_seconds === "number") {
    return { ok: false, reason: "wait", waitSeconds: body.wait_seconds };
  }
  return error === "email" || error === "already" || error === "wrong-password"
    ? { ok: false, reason: error }
    : { ok: false, reason: "unreachable" };
}

export type SignUpResult =
  | { ok: true }
  | { ok: false; reason: "email" | "password-short" | "password-long" | "already" | "too-many" | "unreachable" };

export async function signUp(email: string, password: string): Promise<SignUpResult> {
  let response: Response;
  try {
    response = await api("/api/sign-up", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  if (response.ok) return { ok: true };
  const error = await errorOf(response);
  switch (error) {
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
/**
 * A bare address, as the server checks it: one @ with something on each
 * side, at most 254 characters, and nothing that could put a name before it
 * (no spaces, control characters, `<` `>`, quotes, commas, semicolons,
 * colons, brackets or backslashes).
 */
export function plausibleEmail(text: string): boolean {
  const parts = text.split("@");
  return (
    text.length <= 254 &&
    parts.length === 2 &&
    parts[0] !== "" &&
    parts[1] !== "" &&
    !/[\s\p{Cc}<>",;:()[\]\\]/u.test(text)
  );
}

export async function errorOf(response: Response): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null);
  return isRecord(body) ? body.error : undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
