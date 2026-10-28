// One way for every screen to talk to nine turtles' own server: reading an
// answer, and sending a change and saying why it wasn't made. Each request
// goes through `api` (updates.svelte.ts), which names the tab's reader and
// notes the version that answered.

import { api } from "./updates.svelte";

/** A JSON object (not a list): the only shape the server's answers are read from. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Asks for `path` and answers the JSON; throws when the server answers with an error. */
export async function getJson(path: string): Promise<unknown> {
  const response = await api(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
  return response.json();
}

/**
 * Sends a change to `path` and waits for the answer. Answers either what the
 * server sent back, or why the change wasn't made: one of the `known` errors
 * the server named, "gone" when what it changes isn't there any more, or
 * "trouble" for anything else (including no answer within 15 seconds).
 */
export async function sendChange<Known extends string>(
  path: string,
  body: unknown,
  known: readonly Known[],
): Promise<{ refusal?: Known | "gone" | "trouble"; answer?: Record<string, unknown> }> {
  let response: Response;
  try {
    response = await api(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { refusal: "trouble" };
  }
  const answer: unknown = await response.json().catch(() => null);
  if (response.ok) return { answer: isRecord(answer) ? answer : {} };
  if (response.status === 404) return { refusal: "gone" };
  const error = isRecord(answer) ? answer.error : undefined;
  const named = known.find((each) => each === error);
  return { refusal: named ?? "trouble" };
}
