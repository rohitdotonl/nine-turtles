// Paying for nine turtles (SPEC section 29, decision 0094): the reader's
// plan, shown in Settings › Your plan, and the doors to Dodo Payments'
// checkout and billing pages. nine turtles never sees a card.

import { date } from "./admin";
import { api } from "./updates.svelte";

/** Where a reader stands, as the server says (`payments::Standing`). */
export type Standing =
  | { standing: "free" }
  | { standing: "trial"; endsAt: number }
  | { standing: "paid"; until: number; renewsAt: number | null; ending: boolean; period: "monthly" | "yearly" | null }
  | { standing: "on-hold"; until: number }
  | { standing: "ended" };

export type PlanStatus =
  | { on: false }
  | {
      on: true;
      testMode: boolean;
      plan: Standing;
      prices: { monthly: string; yearly: string | null };
      canManage: boolean;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** The server's standing, read carefully; anything unknown reads as ended. */
export function toStanding(body: unknown): Standing {
  const plan = isRecord(body) ? body : {};
  switch (plan.standing) {
    case "free":
      return { standing: "free" };
    case "trial":
      return { standing: "trial", endsAt: number(plan.ends_at) };
    case "paid":
      return {
        standing: "paid",
        until: number(plan.until),
        renewsAt: typeof plan.renews_at === "number" ? plan.renews_at : null,
        ending: plan.ending === true,
        period: plan.period === "monthly" || plan.period === "yearly" ? plan.period : null,
      };
    case "on-hold":
      return { standing: "on-hold", until: number(plan.until) };
    default:
      return { standing: "ended" };
  }
}

export function toPlanStatus(body: unknown): PlanStatus {
  if (!isRecord(body) || body.on !== true) return { on: false };
  const prices = isRecord(body.prices) ? body.prices : {};
  return {
    on: true,
    testMode: body.test_mode === true,
    plan: toStanding(body.plan),
    prices: {
      monthly: typeof prices.monthly === "string" ? prices.monthly : "",
      yearly: typeof prices.yearly === "string" ? prices.yearly : null,
    },
    canManage: body.can_manage === true,
  };
}

export async function loadPlan(): Promise<PlanStatus> {
  const response = await api("/api/plan", { cache: "no-store" });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
  return toPlanStatus(await response.json());
}

/** The plan in a few words, and a line under it. */
export function describe(plan: Standing): { title: string; detail: string } {
  switch (plan.standing) {
    case "free":
      return { title: "Free", detail: "You joined before payments, so nine turtles stays free for you." };
    case "trial":
      return { title: "Free trial", detail: `Your trial ends on ${date(plan.endsAt)}.` };
    case "paid": {
      const title = plan.period === "yearly" ? "Yearly plan" : plan.period === "monthly" ? "Monthly plan" : "Your plan";
      if (plan.ending) return { title, detail: `Cancelled. It lasts until ${date(plan.until)}.` };
      if (plan.renewsAt) return { title, detail: `Renews on ${date(plan.renewsAt)}.` };
      return { title, detail: `Paid until ${date(plan.until)}.` };
    }
    case "on-hold":
      return {
        title: "Your last payment didn't go through",
        detail: `Update your card under Billing by ${date(plan.until)} to keep your plan.`,
      };
    case "ended":
      return {
        title: "Your free trial or plan has ended",
        detail:
          "You can still read, star, search and export everything you have. Choose a plan to add feeds and keep them up to date.",
      };
  }
}

/** Whether the reader can choose a plan now: not while one is paid up and renewing. */
export function canSubscribe(plan: Standing): boolean {
  return plan.standing === "trial" || plan.standing === "ended" || (plan.standing === "paid" && plan.ending);
}

/** What went wrong reaching Dodo Payments, in a calm sentence. */
export const UNREACHABLE = "Payments can't be reached just now. Try again in a moment.";

async function door(path: string, body?: unknown): Promise<string> {
  const response = await api(path, {
    method: "POST",
    ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
  const answer: unknown = await response.json();
  if (!isRecord(answer) || typeof answer.url !== "string") throw new Error("nine turtles sent no address");
  return answer.url;
}

/** Dodo's checkout page for the plan chosen. */
export function checkoutAddress(period: "monthly" | "yearly"): Promise<string> {
  return door("/api/plan/checkout", { period });
}

/** Dodo's billing page: card, receipts and cancelling. */
export function billingAddress(): Promise<string> {
  return door("/api/plan/manage");
}
