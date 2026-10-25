// Talking to the server about signing in (SPEC section 1). The sign-in
// cookie itself is invisible to this code: the browser keeps it.

import { api } from "./updates.svelte";

/** Signed in: the version for Status, whether this is the owner (who alone sees Settings › Readers), and the reader's email. */
export type Session = { signedIn: true; version: string; owner: boolean; email: string | null } | { signedIn: false };

export type SignInResult =
  | { ok: true }
  | { ok: false; reason: "wrong-password" | "password-missing" | "password-invalid" | "unreachable" }
  | { ok: false; reason: "wait"; waitSeconds: number };

export async function currentSession(): Promise<Session> {
  const response = await api("/api/session", { cache: "no-store" });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
  const body: unknown = await response.json();
  if (isRecord(body) && body.signed_in === true && typeof body.version === "string") {
    return {
      signedIn: true,
      version: body.version,
      owner: body.owner === true,
      email: typeof body.email === "string" ? body.email : null,
    };
  }
  return { signedIn: false };
}

/** With an email, for the reader who has it; with none (""), the owner's password-only sign-in, as before. */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  let response: Response;
  try {
    response = await api("/api/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
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
  if (error === "wrong-password" || error === "password-missing" || error === "password-invalid") {
    return { ok: false, reason: error };
  }
  return { ok: false, reason: "unreachable" };
}

export async function signOut(): Promise<void> {
  const response = await api("/api/sign-out", { method: "POST" });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
}

/**
 * What the sign-in page says after a try that didn't work. Plain and calm.
 * With an email it never says which of the two was wrong, as the server doesn't.
 */
export function explain(result: Exclude<SignInResult, { ok: true }>, withEmail = false): string {
  switch (result.reason) {
    case "wrong-password":
      return withEmail ? "That email and password don't match." : "That isn't the password.";
    case "wait":
      return `Too many wrong tries. Try again in ${duration(result.waitSeconds)}.`;
    case "password-missing":
      return "No password has been set yet. The setup guide explains how to set one.";
    case "password-invalid":
      return "The password setting isn't valid. Run nine-turtles set-password again and paste the whole line.";
    case "unreachable":
      return "nine turtles can't be reached right now. Try again in a moment.";
  }
}

export function duration(seconds: number): string {
  if (seconds < 60) return seconds === 1 ? "1 second" : `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
