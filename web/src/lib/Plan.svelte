<!--
  Your plan (SPEC section 29), a group of Settings, shown only while nine
  turtles takes payments, and never to the owner: where the reader stands
  (free, in the trial, paid, a payment that didn't go through, ended), a row
  for each plan to choose, and Billing, which opens Dodo Payments' own page
  for the card, receipts and cancelling. Choosing a plan opens Dodo's
  checkout, which sends the reader back here (decision 0094).
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { type PlanStatus, Refused, UNREACHABLE, billingAddress, canSubscribe, checkoutAddress, describe, loadPlan } from "./plan";

  let status: PlanStatus = $state({ on: false });
  let message = $state("");
  let busy = $state(false);

  loadPlan().then(
    (loaded) => (status = loaded),
    () => {
      // Hidden until the server answers: nothing here works without it.
    },
  );

  async function go(address: () => Promise<string>) {
    if (busy) return;
    busy = true;
    message = "";
    try {
      // Dodo's page, in this tab; it sends the reader back to Settings.
      location.assign(await address());
    } catch (error) {
      message = error instanceof Refused ? error.message : UNREACHABLE;
      busy = false;
    }
  }
</script>

{#if status.on && status.plan.standing !== "free"}
  {@const shown = describe(status.plan)}
  <section aria-labelledby="plan-heading">
    <h3 id="plan-heading" class="inset-head">Your plan</h3>
    <div class="inset-group">
      <div class="inset-row">
        <p class="min-w-0">{shown.title}<br /><span class="detail text-muted">{shown.detail}</span></p>
      </div>
      {#if canSubscribe(status.plan)}
        <button type="button" aria-disabled={busy} onclick={() => go(() => checkoutAddress("monthly"))} class="inset-row inset-action"
          ><span class="min-w-0">Monthly<span class="text-muted">{` · ${status.prices.monthly}`}</span></span><span class="row-glyph"
            ><Icon name="open" size={18} /></span
          ></button
        >
        {#if status.prices.yearly}
          <button type="button" aria-disabled={busy} onclick={() => go(() => checkoutAddress("yearly"))} class="inset-row inset-action"
            ><span class="min-w-0">Yearly<span class="text-muted">{` · ${status.prices.yearly}`}</span></span><span class="row-glyph"
              ><Icon name="open" size={18} /></span
            ></button
          >
        {/if}
      {/if}
      {#if status.canManage}
        <button type="button" aria-disabled={busy} onclick={() => go(billingAddress)} class="inset-row inset-action"
          >Billing and cancelling<span class="row-glyph"><Icon name="open" size={18} /></span></button
        >
      {/if}
    </div>
    <div role="status" class={["inset-foot text-ink", !message && "sr-only"]}>{message}</div>
    <p class="inset-foot">
      Payments are handled by Dodo Payments, which takes your card, adds any sales tax and sends your receipts. nine
      turtles never sees your card. You can cancel whenever you like under Billing and cancelling. If you've just paid,
      it can take a minute to show here.
    </p>
    {#if status.testMode}
      <p class="inset-foot">Test mode: no real money is taken. Pay with Dodo's test card, 4242 4242 4242 4242.</p>
    {/if}
  </section>
{/if}

<style>
  .detail {
    font-size: var(--text-meta);
  }
</style>
