// The weekly email (SPEC section 39, decisions 0150 and 0184): on or off,
// a switch in Settings › Account, and the page its stop link opens, which turns
// it off in one press, signed in or not. It goes only to a confirmed address
// (decision 0154).

import { getJson, isRecord, sendChange } from "./http";

/** The page the email's stop link opens (`/weekly-email#ticket=…`). */
export const WEEKLY_PAGE = "/weekly-email";

/** Once a week, or not at all (twice a week went, decision 0184). */
export type Often = "off" | "weekly";

/** What the row says under its name, on or off. */
export function oftenHint(often: Often | undefined): string {
  if (often === "weekly") return "Saturday mornings: who wrote, their titles and a line each. Plain text.";
  return "Once a week: the people you read, their titles and a line each, in one plain email.";
}

function oftenFrom(answer: unknown): Often {
  const often = isRecord(answer) ? answer.often : undefined;
  return often === "weekly" ? often : "off";
}

/** How often it comes now. */
export async function loadOften(): Promise<Often> {
  return oftenFrom(await getJson("/api/weekly-email"));
}

/** The reader's clock, as minutes ahead of UTC, so it comes in their morning. */
export function minutesAhead(date = new Date()): number {
  return -date.getTimezoneOffset();
}

export type OftenRefusal = "no-email" | "no-address" | "unconfirmed" | "gone" | "trouble";

/** Saves a choice; answers what's saved, or why it wasn't. */
export async function saveOften(often: Often): Promise<Often | { refusal: OftenRefusal }> {
  const { answer, refusal } = await sendChange("/api/weekly-email", { often, offset: minutesAhead() }, ["no-email", "no-address", "unconfirmed"] as const);
  return refusal ? { refusal } : oftenFrom(answer);
}

/** Why a choice wasn't saved, said under the group. */
export function explainOften(refusal: OftenRefusal): string {
  if (refusal === "no-email") return "The weekly email needs nine turtles to send email; whoever runs it can set that up.";
  if (refusal === "no-address") return "The weekly email needs an email address on your account.";
  if (refusal === "unconfirmed")
    return "The weekly email goes only to a confirmed address. Signing in once with an emailed link (Forgot? on the sign-in page) confirms yours.";
  return "That wasn't saved. Check your connection and try again.";
}

export type Pressed = "done" | "unknown" | "trouble";

/** The stop page's button, pressed: done, a link that no longer works, or no answer. */
export async function stopByTicket(ticket: string): Promise<Pressed> {
  const { refusal } = await sendChange("/api/weekly-email/stop", { ticket }, ["unknown"] as const);
  if (!refusal) return "done";
  return refusal === "unknown" || refusal === "gone" ? "unknown" : "trouble";
}
