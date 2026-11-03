// The weekly email (SPEC section 39, decision 0150): how often it comes,
// chosen in Settings › Account, and the page its stop link opens, which turns
// it off in one press, signed in or not.

import { getJson, isRecord, sendChange } from "./http";

/** The page the email's stop link opens (`/weekly-email#ticket=…`). */
export const WEEKLY_PAGE = "/weekly-email";

export type Often = "off" | "weekly" | "twice";

export const OFTEN_CHOICES: { value: Often; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "weekly", label: "Weekly" },
  { value: "twice", label: "Twice a week" },
];

/** What the row says under its name, for each choice. */
export function oftenHint(often: Often | undefined): string {
  if (often === "weekly") return "Saturday mornings: who wrote, their titles and a line each. Plain text.";
  if (often === "twice") return "Wednesday and Saturday mornings: who wrote, their titles and a line each. Plain text.";
  return "Who you read wrote, their titles and a line each, in one plain email. Off until you turn it on.";
}

function oftenFrom(answer: unknown): Often {
  const often = isRecord(answer) ? answer.often : undefined;
  return often === "weekly" || often === "twice" ? often : "off";
}

/** How often it comes now. */
export async function loadOften(): Promise<Often> {
  return oftenFrom(await getJson("/api/weekly-email"));
}

/** The reader's clock, as minutes ahead of UTC, so it comes in their morning. */
export function minutesAhead(date = new Date()): number {
  return -date.getTimezoneOffset();
}

export type OftenRefusal = "no-email" | "no-address" | "gone" | "trouble";

/** Saves a choice; answers what's saved, or why it wasn't. */
export async function saveOften(often: Often): Promise<Often | { refusal: OftenRefusal }> {
  const { answer, refusal } = await sendChange("/api/weekly-email", { often, offset: minutesAhead() }, ["no-email", "no-address"] as const);
  return refusal ? { refusal } : oftenFrom(answer);
}

/** Why a choice wasn't saved, said under the group. */
export function explainOften(refusal: OftenRefusal): string {
  if (refusal === "no-email") return "The weekly email needs nine turtles to send email; whoever runs it can set that up.";
  if (refusal === "no-address") return "The weekly email needs an email address on your account.";
  return "That wasn't saved. Check your connection and try again.";
}

/** The stop link's page, pressed. True once it's off (or the link was never one). */
export async function stopByTicket(ticket: string): Promise<boolean> {
  const { refusal } = await sendChange("/api/weekly-email/stop", { ticket }, [] as const);
  return refusal === undefined;
}
