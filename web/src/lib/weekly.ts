// The weekly email (SPEC section 39, decision 0150): how often it comes,
// chosen in Settings › Account; the page its Start link opens, which lets the
// first one go to that address; and the page its stop link opens, which turns
// it off in one press. Both pages work signed in or not.

import { getJson, isRecord, sendChange } from "./http";

/** The page the email's stop link opens (`/weekly-email#ticket=…`). */
export const WEEKLY_PAGE = "/weekly-email";
/** The page the Start link opens (`/weekly-email/start#ticket=…`). */
export const WEEKLY_START_PAGE = "/weekly-email/start";

export type Often = "off" | "weekly" | "twice";

export const OFTEN_CHOICES: { value: Often; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "weekly", label: "Weekly" },
  { value: "twice", label: "Twice a week" },
];

/** How often, and whether it waits for Start to be pressed in the email sent to the reader's address. */
export type Weekly = { often: Often; waiting: boolean };

/** What the row says under its name, for each choice. */
export function oftenHint(often: Often | undefined, waiting = false): string {
  if (waiting && often !== "off") return "Waiting for you: press Start in the email just sent to your address.";
  if (often === "weekly") return "Saturday mornings: who wrote, their titles and a line each. Plain text.";
  if (often === "twice") return "Wednesday and Saturday mornings: who wrote, their titles and a line each. Plain text.";
  return "The people you read, their titles and a line each, in one plain email.";
}

function oftenFrom(answer: unknown): Weekly {
  const often = isRecord(answer) ? answer.often : undefined;
  return {
    often: often === "weekly" || often === "twice" ? often : "off",
    waiting: isRecord(answer) && answer.waiting === true,
  };
}

/** How often it comes now. */
export async function loadOften(): Promise<Weekly> {
  return oftenFrom(await getJson("/api/weekly-email"));
}

/** The reader's clock, as minutes ahead of UTC, so it comes in their morning. */
export function minutesAhead(date = new Date()): number {
  return -date.getTimezoneOffset();
}

export type OftenRefusal = "no-email" | "no-address" | "gone" | "trouble";

/** Saves a choice; answers what's saved, or why it wasn't. */
export async function saveOften(often: Often): Promise<Weekly | { refusal: OftenRefusal }> {
  const { answer, refusal } = await sendChange("/api/weekly-email", { often, offset: minutesAhead() }, ["no-email", "no-address"] as const);
  return refusal ? { refusal } : oftenFrom(answer);
}

/** Why a choice wasn't saved, said under the group. */
export function explainOften(refusal: OftenRefusal): string {
  if (refusal === "no-email") return "The weekly email needs nine turtles to send email; whoever runs it can set that up.";
  if (refusal === "no-address") return "The weekly email needs an email address on your account.";
  return "That wasn't saved. Check your connection and try again.";
}

export type Pressed = "done" | "unknown" | "trouble";

/** The stop or Start page's button, pressed: done, a link that no longer works, or no answer. */
export async function pressLink(which: "stop" | "start", ticket: string): Promise<Pressed> {
  const { refusal } = await sendChange(`/api/weekly-email/${which}`, { ticket }, ["unknown"] as const);
  if (!refusal) return "done";
  return refusal === "unknown" || refusal === "gone" ? "unknown" : "trouble";
}
