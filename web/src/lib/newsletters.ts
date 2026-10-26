// Newsletters as feeds (SPEC section 28): the reader's private address,
// shown in Settings › Newsletters with Copy and New address. Newsletters
// sent to it arrive as feeds, one per sender.

import { api } from "./updates.svelte";

/** A label that has had mail (`name+label@…`), with its switch. */
export type Label = { label: string; address: string; on: boolean };

export type NewslettersStatus = { on: boolean; address: string | null; labels: Label[] };

function labels(body: unknown): Label[] {
  if (typeof body !== "object" || body === null || !("labels" in body) || !Array.isArray(body.labels)) return [];
  return body.labels.flatMap((item: unknown) => {
    const label = text(item, "label");
    const address = text(item, "address");
    if (!label || !address) return [];
    return [{ label, address, on: typeof item === "object" && item !== null && "on" in item && item.on === true }];
  });
}

function text(body: unknown, key: string): string | null {
  if (typeof body !== "object" || body === null || !(key in body)) return null;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

/** Whether newsletters are on here, and the reader's address (made the first time). */
export async function newslettersStatus(): Promise<NewslettersStatus> {
  const response = await api("/api/newsletters", { cache: "no-store" });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
  const body: unknown = await response.json();
  const on = typeof body === "object" && body !== null && "on" in body && body.on === true;
  return { on, address: on ? text(body, "address") : null, labels: on ? labels(body) : [] };
}

/** A new address; the old one stops taking email. Answers both, for Undo. */
export async function newAddress(): Promise<{ address: string; previous: string | null }> {
  const response = await api("/api/newsletters/new-address", { method: "POST" });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
  const body: unknown = await response.json();
  const address = text(body, "address");
  if (!address) throw new Error("nine turtles sent no address");
  return { address, previous: text(body, "previous") };
}

/** Undo came after the hour it's offered for. */
export class TooLate extends Error {}

/** Undo for New address: the old address works again. Answers it. */
export async function undoNewAddress(previous: string): Promise<string> {
  const response = await api("/api/newsletters/undo-new-address", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ previous }),
  });
  if (response.status === 409) throw new TooLate("too late to undo");
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
  const address = text(await response.json(), "address");
  if (!address) throw new Error("nine turtles sent no address");
  return address;
}

/** A label's switch: off turns its mail away, on takes it again. */
export async function switchLabel(label: string, on: boolean): Promise<void> {
  const response = await api("/api/newsletters/labels", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ label, on }),
  });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
}
