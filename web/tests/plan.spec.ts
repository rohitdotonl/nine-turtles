import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { appReady, signIn } from "./screens";

// SPEC section 29 (decision 0094): Settings › Your plan, for a reader who
// isn't the owner, while nine turtles takes payments. The browser tests run
// without Dodo, so the server's answers about the plan are stood in for
// here, and the owner is shown the page as another reader would see it.

test("Your plan shows the trial, works from the keyboard, and says why a door stayed shut", async ({ page }) => {
  await page.goto("/settings");
  await appReady(page);
  await signIn(page);

  await page.route("**/api/session", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: { ...body, owner: false } });
  });
  await page.route("**/api/plan", (route) =>
    route.fulfill({
      json: {
        on: true,
        test_mode: true,
        plan: { standing: "trial", ends_at: Date.UTC(2026, 10, 9, 12) / 1000 },
        prices: { monthly: "$5 a month", yearly: "$50 a year" },
        can_manage: false,
      },
    }),
  );
  let asked: unknown = null;
  await page.route("**/api/plan/checkout", async (route) => {
    asked = route.request().postDataJSON();
    await route.fulfill({ status: 409, json: { error: "no-email" } });
  });
  await page.goto("/settings");
  await appReady(page);

  const plan = page.getByRole("region", { name: "Your plan" });
  await expect(plan.getByText("Free trial")).toBeVisible();
  await expect(plan.getByText("Your trial ends on 9 November 2026.")).toBeVisible();
  await expect(plan.getByText(/Test mode: no real money/)).toBeVisible();
  // No billing row before anything is bought.
  await expect(plan.getByRole("button", { name: /Billing/ })).toHaveCount(0);

  // From the keyboard: focus the Monthly row and press Enter.
  const monthly = plan.getByRole("button", { name: "Monthly · $5 a month" });
  await expect(plan.getByRole("button", { name: "Yearly · $50 a year" })).toBeVisible();
  await monthly.focus();
  await expect(monthly).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(plan.getByRole("status")).toHaveText("Your account needs an email before you can choose a plan.");
  expect(asked).toEqual({ period: "monthly" });

  const results = await new AxeBuilder({ page })
    .include("#plan-heading")
    .include('section[aria-labelledby="plan-heading"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
