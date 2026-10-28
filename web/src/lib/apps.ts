// Syncing with other feed readers (SPEC section 26): the app password that
// Reeder, NetNewsWire and similar apps sign in with, made and turned off in
// Settings. The password is shown once, when it's made; the server keeps
// only a scrambled copy.

import { api } from "./updates.svelte";
import { isRecord } from "./http";

export type AppsStatus = { on: boolean };

/** Where the apps find nine turtles: this site's address and the API's path. */
export function serverAddress(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/api/greader`;
}

export async function appsStatus(): Promise<AppsStatus> {
  const response = await api("/api/apps", { cache: "no-store" });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
  const body: unknown = await response.json();
  return { on: isRecord(body) && body.on === true };
}

/** Makes a new app password, replacing any earlier one, and returns it. */
export async function makeAppPassword(): Promise<string> {
  const response = await api("/api/apps/password", { method: "POST" });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
  const body: unknown = await response.json();
  if (isRecord(body) && typeof body.password === "string") {
    return body.password;
  }
  throw new Error("nine turtles sent no password");
}

/** Forgets the app password: every app is signed out. */
export async function turnOffApps(): Promise<void> {
  const response = await api("/api/apps/off", { method: "POST" });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
}
