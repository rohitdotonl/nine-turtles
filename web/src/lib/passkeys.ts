// Passkeys (SPEC sections 1 and 18, decision 0109): signing in with a
// fingerprint, face or device PIN instead of a password, and the reader's
// passkeys in Settings › Passkeys. The browser's own WebAuthn does the work
// (navigator.credentials); nine turtles' server sends each challenge as JSON,
// with the binary parts written as base64url, and these helpers turn them
// into what the browser takes, and the browser's answer back into JSON.

import { duration } from "./session";
import { api } from "./updates.svelte";
import { isRecord } from "./http";

/** One of the reader's passkeys. `name` is null for "Passkey added <the day>". */
export type PasskeyRow = { id: number; name: string | null; createdAt: number; lastUsedAt: number | null };

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** "27 October 2026", in this device's time zone. */
export function day(seconds: number): string {
  return DATE.format(new Date(seconds * 1000));
}

/** What a passkey is called: the reader's name for it, or "Passkey added 27 October 2026". */
export function passkeyName(passkey: PasskeyRow): string {
  return passkey.name ?? `Passkey added ${day(passkey.createdAt)}`;
}

/** The muted line under a passkey's name: "Added 27 October 2026 · Last used today" (or "· Not used yet"). */
export function passkeyDates(passkey: PasskeyRow, now: Date = new Date()): string {
  const used = passkey.lastUsedAt === null ? "Not used yet" : `Last used ${dayOrToday(passkey.lastUsedAt, now)}`;
  return `Added ${dayOrToday(passkey.createdAt, now)} · ${used}`;
}

function dayOrToday(seconds: number, now: Date): string {
  const when = new Date(seconds * 1000);
  const today =
    when.getFullYear() === now.getFullYear() && when.getMonth() === now.getMonth() && when.getDate() === now.getDate();
  return today ? "today" : day(seconds);
}

/** Bytes as base64url, without padding, as WebAuthn's JSON writes them. */
export function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let text = "";
  for (const byte of view) text += String.fromCharCode(byte);
  return btoa(text).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** base64url (with or without padding) back to bytes. */
export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const plain = text.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(plain + "=".repeat((4 - (plain.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/**
 * Whether passkeys work on this page: the browser has WebAuthn, and this is
 * the address the server's passkeys belong to (`origin`, from the session;
 * "http://localhost" means any port). Elsewhere, such as the Render address,
 * a passkey couldn't be used, so nothing about passkeys is shown.
 */
export function passkeysHere(origin: string | null, here: { origin: string; protocol: string; hostname: string }, hasWebAuthn: boolean): boolean {
  if (!origin || !hasWebAuthn) return false;
  if (origin === "http://localhost") return here.protocol === "http:" && here.hostname === "localhost";
  return here.origin === origin;
}

/** Whether this browser has WebAuthn at all. */
export function browserHasPasskeys(): boolean {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential === "function" && !!navigator.credentials;
}

type Json = Record<string, unknown>;

/** A list of credential descriptors with their ids as bytes. */
function descriptors(list: unknown): PublicKeyCredentialDescriptor[] | undefined {
  if (!Array.isArray(list)) return undefined;
  return list.filter(isRecord).map((item) => ({
    type: "public-key",
    id: fromBase64Url(String(item.id)),
    ...(Array.isArray(item.transports) ? { transports: item.transports as AuthenticatorTransport[] } : {}),
  }));
}

/** The server's challenge to make a passkey, as the browser takes it. */
export function creationOptions(json: unknown): PublicKeyCredentialCreationOptions {
  const options = isRecord(json) && isRecord(json.publicKey) ? json.publicKey : {};
  const user = isRecord(options.user) ? options.user : {};
  return {
    ...(options as unknown as PublicKeyCredentialCreationOptions),
    challenge: fromBase64Url(String(options.challenge)),
    user: { ...(user as unknown as PublicKeyCredentialUserEntity), id: fromBase64Url(String(user.id)) },
    excludeCredentials: descriptors(options.excludeCredentials) ?? [],
  };
}

/** The server's challenge to sign in, as the browser takes it. */
export function requestOptions(json: unknown): PublicKeyCredentialRequestOptions {
  const options = isRecord(json) && isRecord(json.publicKey) ? json.publicKey : {};
  return {
    ...(options as unknown as PublicKeyCredentialRequestOptions),
    challenge: fromBase64Url(String(options.challenge)),
    allowCredentials: descriptors(options.allowCredentials) ?? [],
  };
}

/** The browser's answer, as JSON for the server. */
export function credentialJson(credential: PublicKeyCredential): Json {
  const response = credential.response;
  const answer: Json = { clientDataJSON: toBase64Url(response.clientDataJSON) };
  if ("attestationObject" in response) {
    answer.attestationObject = toBase64Url((response as AuthenticatorAttestationResponse).attestationObject);
  }
  if ("signature" in response) {
    const assertion = response as AuthenticatorAssertionResponse;
    answer.authenticatorData = toBase64Url(assertion.authenticatorData);
    answer.signature = toBase64Url(assertion.signature);
    if (assertion.userHandle) answer.userHandle = toBase64Url(assertion.userHandle);
  }
  return {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    response: answer,
    extensions: credential.getClientExtensionResults?.() ?? {},
  };
}

async function post(path: string, body: unknown): Promise<Response> {
  return api(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function errorOf(response: Response): Promise<{ error: string; waitSeconds: number }> {
  const body: unknown = await response.json().catch(() => null);
  return {
    error: isRecord(body) && typeof body.error === "string" ? body.error : "",
    waitSeconds: isRecord(body) && typeof body.wait_seconds === "number" ? body.wait_seconds : 0,
  };
}

export async function listPasskeys(): Promise<PasskeyRow[]> {
  const response = await api("/api/passkeys", { cache: "no-store" });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
  const body: unknown = await response.json();
  const rows = isRecord(body) && Array.isArray(body.passkeys) ? body.passkeys : [];
  return rows.filter(isRecord).map(row);
}

function row(passkey: Json): PasskeyRow {
  return {
    id: Number(passkey.id),
    name: typeof passkey.name === "string" ? passkey.name : null,
    createdAt: Number(passkey.created_at),
    lastUsedAt: typeof passkey.last_used_at === "number" ? passkey.last_used_at : null,
  };
}

export type AddResult =
  | { ok: true; passkey: PasskeyRow }
  | { ok: false; reason: "password-needed" | "wrong-password" | "cancelled" | "already" | "too-many" | "refused" | "expired" | "off" | "unreachable" }
  | { ok: false; reason: "wait"; waitSeconds: number };

/** Adds a passkey: the reader's password first, then the browser makes one. */
export async function addPasskey(password: string): Promise<AddResult> {
  let started: Response;
  try {
    started = await post("/api/passkeys/add", { password });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  if (!started.ok) {
    const { error, waitSeconds } = await errorOf(started);
    if (error === "wait") return { ok: false, reason: "wait", waitSeconds };
    if (error === "password-needed" || error === "wrong-password" || error === "too-many" || error === "off") {
      return { ok: false, reason: error };
    }
    return { ok: false, reason: "unreachable" };
  }
  const body: unknown = await started.json();
  if (!isRecord(body)) return { ok: false, reason: "unreachable" };
  let credential: Credential | null;
  try {
    credential = await navigator.credentials.create({ publicKey: creationOptions(body.options) });
  } catch (problem) {
    // This device already holds a passkey for this reader.
    if (problem instanceof DOMException && problem.name === "InvalidStateError") return { ok: false, reason: "already" };
    return { ok: false, reason: "cancelled" };
  }
  if (!(credential instanceof PublicKeyCredential)) return { ok: false, reason: "cancelled" };
  let finished: Response;
  try {
    finished = await post("/api/passkeys/add/finish", { ceremony: body.ceremony, credential: credentialJson(credential) });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  if (finished.ok) return { ok: true, passkey: row((await finished.json()) as Json) };
  const { error } = await errorOf(finished);
  return error === "already" || error === "refused" || error === "expired"
    ? { ok: false, reason: error }
    : { ok: false, reason: "unreachable" };
}

/** What Settings says when adding a passkey didn't work. */
export function explainAdd(result: Exclude<AddResult, { ok: true }>): string {
  switch (result.reason) {
    case "password-needed":
      return "Type your password first, to add a passkey.";
    case "wrong-password":
      return "That isn't your password.";
    case "wait":
      return `Too many wrong tries. Try again in ${duration(result.waitSeconds)}.`;
    case "cancelled":
      return "No passkey was added.";
    case "already":
      return "This device already has a passkey for you.";
    case "too-many":
      return "You have as many passkeys as nine turtles keeps. Remove one to add another.";
    case "refused":
      return "That passkey couldn't be checked, so it wasn't added. Try again, or try another device.";
    case "expired":
      return "That took too long. Try again.";
    case "off":
    case "unreachable":
      return "nine turtles can't be reached right now. Try again in a moment.";
  }
}

/** A new name for a passkey; "" goes back to "Passkey added <the day>". */
export async function renamePasskey(id: number, name: string): Promise<"ok" | "name-long" | "unreachable"> {
  try {
    const response = await post(`/api/passkeys/${id}/name`, { name });
    if (response.ok) return "ok";
    return (await errorOf(response)).error === "name-long" ? "name-long" : "unreachable";
  } catch {
    return "unreachable";
  }
}

/** Removes a passkey; `undoRemove` brings it back for ten minutes. */
export async function removePasskey(id: number): Promise<boolean> {
  try {
    return (await post(`/api/passkeys/${id}/remove`, {})).ok;
  } catch {
    return false;
  }
}

export async function undoRemove(id: number): Promise<boolean> {
  try {
    return (await post(`/api/passkeys/${id}/undo`, {})).ok;
  } catch {
    return false;
  }
}

export type PasskeySignIn = "ok" | "cancelled" | "passkey" | "expired" | "unreachable";

/**
 * Signs in with a passkey. `conditional` waits for the reader to pick one
 * from the email field's suggestions (the browser's passkey autofill);
 * otherwise the browser shows its own sheet at once. `signal` stops waiting.
 */
export async function signInWithPasskey(conditional: boolean, signal?: AbortSignal): Promise<PasskeySignIn> {
  let started: Response;
  try {
    started = await post("/api/sign-in/passkey", {});
  } catch {
    return "unreachable";
  }
  if (!started.ok) return "unreachable";
  const body: unknown = await started.json();
  if (!isRecord(body)) return "unreachable";
  let credential: Credential | null;
  try {
    credential = await navigator.credentials.get({
      publicKey: requestOptions(body.options),
      ...(conditional ? { mediation: "conditional" as CredentialMediationRequirement } : {}),
      ...(signal ? { signal } : {}),
    });
  } catch {
    // Cancelled, timed out, or stopped by `signal`: nothing to say.
    return "cancelled";
  }
  if (!(credential instanceof PublicKeyCredential)) return "cancelled";
  let finished: Response;
  try {
    finished = await post("/api/sign-in/passkey/finish", { ceremony: body.ceremony, credential: credentialJson(credential) });
  } catch {
    return "unreachable";
  }
  if (finished.ok) return "ok";
  const { error } = await errorOf(finished);
  return error === "passkey" || error === "expired" ? error : "unreachable";
}

/** What the sign-in page says when a passkey didn't sign in. "" for nothing at all. */
export function explainPasskeySignIn(result: PasskeySignIn): string {
  switch (result) {
    case "ok":
    case "cancelled":
      return "";
    case "passkey":
      return "That passkey isn't one this nine turtles knows. Sign in with your password.";
    case "expired":
      return "That took too long. Try again.";
    case "unreachable":
      return "nine turtles can't be reached right now. Try again in a moment.";
  }
}

/** Whether this browser can offer passkeys in the email field's suggestions. */
export async function autofillAvailable(): Promise<boolean> {
  try {
    return (await PublicKeyCredential.isConditionalMediationAvailable?.()) === true;
  } catch {
    return false;
  }
}
