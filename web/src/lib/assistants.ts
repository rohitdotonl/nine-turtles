// Connecting an AI assistant (Claude, ChatGPT…) to a reader's nine turtles,
// through MCP with OAuth. The assistant sends the reader to
// /oauth/authorize; the "Connect this assistant?" page asks the server what
// is asking (GET /api/oauth/request) and sends the reader's answer
// (POST /api/oauth/approve or /api/oauth/deny), then follows the redirect
// the server gives back. Settings › Connected assistants lists the
// connections, disconnects them, and brings back feeds an assistant
// unsubscribed from, which are kept for 30 days.

import { api } from "./updates.svelte";

/** The address the connect page lives at. */
export const CONNECT_PAGE = "/oauth/authorize";

/** Where an assistant finds nine turtles: this site's address and the MCP path. */
export function mcpAddress(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/mcp`;
}

/** The longest name an assistant's own words are shown at; past it, they end in "…". */
export const NAME_LIMIT = 60;

/** An assistant's name is its own choice, so a very long one is cut short. */
export function shortName(name: string, limit = NAME_LIMIT): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const letters = Array.from(trimmed);
  return letters.length > limit ? `${letters.slice(0, limit - 1).join("").trimEnd()}…` : trimmed;
}

export type ConnectRequest =
  | { kind: "ok"; clientName: string; redirectHost: string }
  /** The link isn't valid (an unknown assistant, a wrong return address, a broken request). */
  | { kind: "invalid" }
  | { kind: "signed-out" }
  /** nine turtles couldn't be reached or gave an answer that makes no sense. */
  | { kind: "trouble" };

export type ConnectAnswer = { kind: "redirect"; url: string } | { kind: "invalid" } | { kind: "signed-out" } | { kind: "trouble" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reads the server's answer to GET /api/oauth/request. */
export function readRequest(status: number, body: unknown): ConnectRequest {
  if (status === 401) return { kind: "signed-out" };
  if (status === 400) return { kind: "invalid" };
  if (status !== 200 || !isRecord(body)) return { kind: "trouble" };
  const { client_name, redirect_host } = body;
  if (typeof client_name !== "string" || typeof redirect_host !== "string") return { kind: "trouble" };
  return { kind: "ok", clientName: client_name.trim() === "" ? "This assistant" : client_name, redirectHost: redirect_host };
}

/** Reads the server's answer to approving or denying: where to send the reader. */
export function readAnswer(status: number, body: unknown): ConnectAnswer {
  if (status === 401) return { kind: "signed-out" };
  if (status === 400) return { kind: "invalid" };
  if (status !== 200 || !isRecord(body) || typeof body.redirect !== "string") return { kind: "trouble" };
  // Never somewhere that would run code in this page.
  let url: URL;
  try {
    url = new URL(body.redirect, globalThis.location?.href);
  } catch {
    return { kind: "trouble" };
  }
  if (["javascript:", "data:", "blob:", "vbscript:", "file:"].includes(url.protocol)) return { kind: "trouble" };
  return { kind: "redirect", url: url.href };
}

async function json(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

/** What is asking to connect, for the query string the assistant sent (passed on unchanged). */
export async function connectRequest(search: string): Promise<ConnectRequest> {
  try {
    const response = await api(`/api/oauth/request${search}`, { cache: "no-store" });
    return readRequest(response.status, await json(response));
  } catch {
    return { kind: "trouble" };
  }
}

/** Connect (approve) or Cancel (deny): the server answers with where the reader goes next. */
export async function answerRequest(answer: "approve" | "deny", search: string): Promise<ConnectAnswer> {
  try {
    const response = await api(`/api/oauth/${answer}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: search }),
      signal: AbortSignal.timeout(15_000),
    });
    return readAnswer(response.status, await json(response));
  } catch {
    return { kind: "trouble" };
  }
}

export type Assistant = { id: number; name: string; connectedAt: number; lastUsedAt: number | null };
/** A feed an assistant unsubscribed from, kept for 30 days so it can be brought back. */
export type Unsubscribed = { feedId: number; title: string; unsubscribedAt: number; keptUntil: number };
export type Assistants = { assistants: Assistant[]; unsubscribed: Unsubscribed[] };

/** Reads GET /api/assistants, leaving out anything malformed. */
export function readAssistants(body: unknown): Assistants {
  const record = isRecord(body) ? body : {};
  const assistants = (Array.isArray(record.assistants) ? record.assistants : []).flatMap((item): Assistant[] => {
    if (!isRecord(item) || typeof item.id !== "number" || typeof item.name !== "string" || typeof item.connected_at !== "number") return [];
    const lastUsedAt = typeof item.last_used_at === "number" ? item.last_used_at : null;
    return [{ id: item.id, name: item.name, connectedAt: item.connected_at, lastUsedAt }];
  });
  const unsubscribed = (Array.isArray(record.unsubscribed) ? record.unsubscribed : []).flatMap((item): Unsubscribed[] => {
    if (
      !isRecord(item) ||
      typeof item.feed_id !== "number" ||
      typeof item.title !== "string" ||
      typeof item.unsubscribed_at !== "number" ||
      typeof item.kept_until !== "number"
    )
      return [];
    return [{ feedId: item.feed_id, title: item.title, unsubscribedAt: item.unsubscribed_at, keptUntil: item.kept_until }];
  });
  return { assistants, unsubscribed };
}

export async function listAssistants(): Promise<Assistants> {
  const response = await api("/api/assistants", { cache: "no-store" });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
  return readAssistants(await json(response));
}

/** Ends one assistant's connection; it can connect again from the assistant. */
export async function disconnect(id: number): Promise<void> {
  const response = await api(`/api/assistants/${id}/disconnect`, { method: "POST" });
  if (!response.ok && response.status !== 404) throw new Error(`nine turtles answered ${response.status}`);
}

/** Reads one assistant from the server's words, or nothing if it's malformed. */
function readOne(item: unknown): Assistant | undefined {
  return readAssistants({ assistants: [item] }).assistants[0];
}

/** Reads POST /api/assistants/key: the key, shown once, and the connection it made. */
export function readKey(body: unknown): { key: string; assistant: Assistant } | undefined {
  if (!isRecord(body) || typeof body.key !== "string" || body.key === "") return undefined;
  const assistant = readOne(body.assistant);
  return assistant ? { key: body.key, assistant } : undefined;
}

/** The name a key gets when the reader gives none. */
export const KEY_NAME = "Assistant key";

/** Makes an assistant key, for an assistant that can't show the connect page; nine turtles keeps only a scrambled copy. */
export async function makeKey(name: string): Promise<{ key: string; assistant: Assistant }> {
  const response = await api("/api/assistants/key", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: name.trim() === "" ? KEY_NAME : name.trim() }),
  });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
  const made = readKey(await json(response));
  if (!made) throw new Error("nine turtles sent no key");
  return made;
}
