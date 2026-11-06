// The readers of this nine turtles, and how new ones join (SPEC sections 1
// and 18, decisions 0087 and 0154). The owner sees everyone's email and when
// they joined (never what they read) and sets their own email. Sign-up is
// always open, and confirms the address by an emailed link first; the
// sign-up page itself uses `signUp`.

import { api } from "./updates.svelte";
import { isRecord } from "./http";
import { duration } from "./session";
import { UNREACHABLE, tooManyTries } from "./messages";

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

export type SignUpResult =
  /** `sentTo`: a link went there to finish; without it, the account was made and this device signed in. */
  | { ok: true; sentTo?: string }
  | { ok: false; reason: "email" | "password-short" | "password-long" | "already" | "too-many" | "unreachable" };

/**
 * The answers to "How did you hear about nine turtles?" (decision 0155), in
 * the order the sign-up page lists them, each with the value the server
 * keeps. Choosing none is "Rather not say", and nothing is kept.
 */
export const HEARD_ABOUT = [
  { value: "blog", words: "A blog" },
  { value: "friend", words: "A friend" },
  { value: "search", words: "A search" },
  { value: "ai", words: "An AI assistant" },
  { value: "reddit", words: "Reddit" },
  { value: "other", words: "Somewhere else" },
] as const;

export type HeardAbout = (typeof HEARD_ABOUT)[number]["value"];

export async function signUp(email: string, password: string, heardAbout?: HeardAbout): Promise<SignUpResult> {
  let response: Response;
  try {
    response = await api("/api/sign-up", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, heard_about: heardAbout ?? null }),
    });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  if (response.status === 202) {
    const body: unknown = await response.json().catch(() => null);
    return { ok: true, sentTo: isRecord(body) && typeof body.sent_to === "string" ? body.sent_to : email };
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
      return "Many people have signed up in the last hour. Try again in an hour.";
    case "unreachable":
      return UNREACHABLE;
  }
}

/** The page a sign-up's emailed link opens. */
export const FINISH_SIGN_UP_PAGE = "/finish-sign-up";

export type FinishResult =
  | { ok: true }
  | { ok: false; reason: "wrong-password" | "password-needed" | "expired" | "already" | "too-many" | "unreachable" }
  | { ok: false; reason: "wait"; waitSeconds: number };

/**
 * What a sign-up's link can do here, asked as the page opens without using it up (decision 0193):
 * finish with one press in the browser that signed up, ask the password anywhere else, or nothing,
 * when it has run out.
 */
export type LinkHere = "same-browser" | "password" | "expired" | "unreachable";

export async function checkSignUpLink(ticket: string): Promise<LinkHere> {
  let response: Response;
  try {
    response = await api("/api/sign-up/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticket }),
    });
  } catch {
    return "unreachable";
  }
  if (response.status === 410) return "expired";
  if (!response.ok) return "unreachable";
  const body: unknown = await response.json().catch(() => null);
  return isRecord(body) && body.same_browser === true ? "same-browser" : "password";
}

/**
 * Follows a sign-up's link: the account is made and this device signed in. With the password chosen
 * at sign-up, or, in the browser that signed up, with none ("" , decision 0193).
 */
export async function finishSignUp(ticket: string, password: string): Promise<FinishResult> {
  let response: Response;
  try {
    response = await api("/api/sign-up/finish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticket, password }),
    });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  if (response.ok) return { ok: true };
  const body: unknown = await response.json().catch(() => null);
  const error = isRecord(body) ? body.error : undefined;
  if (error === "wait") {
    return { ok: false, reason: "wait", waitSeconds: isRecord(body) && typeof body.wait_seconds === "number" ? body.wait_seconds : 60 };
  }
  return error === "wrong-password" || error === "password-needed" || error === "expired" || error === "already" || error === "too-many"
    ? { ok: false, reason: error }
    : { ok: false, reason: "unreachable" };
}

/** What the page a sign-up's link opens says when it didn't work. Plain and calm. */
export function explainFinish(result: Exclude<FinishResult, { ok: true }>): string {
  switch (result.reason) {
    case "wrong-password":
      return "That isn't the password you chose when you signed up.";
    case "password-needed":
      return "Type the password you chose when you signed up.";
    case "wait":
      return tooManyTries(duration(result.waitSeconds));
    case "expired":
      return "This link has expired or was already used. Sign up again for a new one.";
    case "already":
      return "That email already has an account. Sign in instead.";
    case "too-many":
      return "Many people have signed up in the last hour. Try this link again in an hour.";
    case "unreachable":
      return UNREACHABLE;
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
