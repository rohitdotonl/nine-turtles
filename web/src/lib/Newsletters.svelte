<!--
  Newsletters (SPEC section 28), a group of Settings, shown only while
  nine turtles takes newsletter emails: the reader's private address, with
  Copy, and New address for when spam arrives (the old one stops taking
  email; Undo on the line below brings it back). Each newsletter sent to the
  address arrives as its own feed (decision 0091).
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { TooLate, newAddress, newslettersStatus, undoNewAddress } from "./newsletters";

  let on = $state(false);
  let address = $state("");
  /** The address New address replaced, while Undo can bring it back. */
  let previous: string | null = $state(null);
  let message = $state("");
  let busy = $state(false);

  newslettersStatus().then(
    (status) => {
      on = status.on;
      address = status.address ?? "";
    },
    () => {
      // Off until the server answers: nothing here works without it.
    },
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      message = "Address copied.";
    } catch {
      message = "Couldn't copy. Select the address and copy it yourself.";
    }
    // Undo for New address stays on the line: copying changes nothing.
  }

  async function replace() {
    if (busy) return;
    busy = true;
    message = "";
    try {
      const made = await newAddress();
      address = made.address;
      previous = made.previous;
      message = "You have a new address. Email to the old one is now refused.";
    } catch {
      message = "Couldn't make a new address. Try again in a moment.";
    }
    busy = false;
  }

  async function undo() {
    if (busy || !previous) return;
    busy = true;
    try {
      address = await undoNewAddress(previous);
      message = "Your old address works again.";
      previous = null;
    } catch (error) {
      if (error instanceof TooLate) {
        message = "It's been over an hour, so the old address can't come back.";
        previous = null;
      } else {
        message = "Couldn't bring the old address back. Try again in a moment.";
      }
    }
    busy = false;
  }
</script>

{#if on}
  <section aria-labelledby="newsletters-heading">
    <h3 id="newsletters-heading" class="inset-head">Newsletters</h3>
    <div class="inset-group">
      <div class="inset-row">
        <p class="min-w-0">
          Your address<br /><span class="value text-muted" translate="no">{address}</span>
        </p>
        <button type="button" class="btn btn-small" onclick={copy}>Copy<span class="sr-only"> address</span></button>
      </div>
      <button type="button" aria-disabled={busy} onclick={replace} class="inset-row inset-action"
        >New address<span class="row-glyph"><Icon name="refresh" size={18} /></span></button
      >
    </div>
    <div role="status" class={["inset-foot flex flex-wrap items-center gap-x-3 gap-y-1 text-ink", !message && "sr-only"]}>
      <span>{message}</span>
      {#if previous}
        <button type="button" class="btn btn-small" aria-disabled={busy} onclick={undo}>Undo</button>
      {/if}
    </div>
    <p class="inset-foot">
      Sign up to newsletters with this address and each one arrives as its own feed. Add a word after a plus sign,
      like <span translate="no">name+cooking@…</span>, to tell sign-ups apart. To stop a newsletter, unsubscribe from
      its feed; to stop it being sent, use the unsubscribe link in one of its emails. New address stops all email to
      the old one, for when spam arrives.
    </p>
  </section>
{/if}

<style>
  /* The address: one long word that may break anywhere, never off the row. */
  .value {
    overflow-wrap: anywhere;
    font-size: var(--text-meta);
  }
</style>
