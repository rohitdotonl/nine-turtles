<!--
  Newsletters (SPEC section 28), a group of Settings, shown only while
  nine turtles takes newsletter emails: the reader's private address, with
  Copy, and New address for when spam arrives (the old one stops taking
  email; Undo on the line below brings it back). Each newsletter sent to the
  address arrives as its own feed (decision 0091). Labels that have had mail
  (`name+label@…`) are listed with a switch that turns their mail away.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { type Label, TooLate, newAddress, newslettersStatus, switchLabel, undoNewAddress } from "./newsletters";

  let on = $state(false);
  let address = $state("");
  let labels: Label[] = $state([]);
  /** The address New address replaced, while Undo can bring it back. */
  let previous: string | null = $state(null);
  let message = $state("");
  let busy = $state(false);

  newslettersStatus().then(
    (status) => {
      on = status.on;
      address = status.address ?? "";
      labels = status.labels;
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
      // Labels belong to an address: the new one has none yet.
      labels = [];
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
      newslettersStatus().then(
        (status) => (labels = status.labels),
        () => {},
      );
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

  async function toggle(label: Label, on: boolean) {
    // The switch shows the change at once, and goes back if it couldn't be saved.
    label.on = on;
    try {
      await switchLabel(label.label, on);
      message = on ? `${label.address} takes email again.` : `Email to ${label.address} is now turned away.`;
    } catch {
      label.on = !on;
      message = "Couldn't change that. Try again in a moment.";
    }
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
      {#each labels as label (label.label)}
        <div class="inset-row">
          <p class={["min-w-0 value", !label.on && "text-ink-2"]} translate="no">
            {label.address}{#if !label.on}{" "}<span class="text-muted" translate="yes">Off.</span>{/if}
          </p>
          <!-- A switch, as Apple draws one, like Rules': on is filled in the text color, off is an empty track. -->
          <label class="switch-target" title={label.on ? "On: press to turn its email away" : "Off: press to take its email again"}>
            <input
              type="checkbox"
              role="switch"
              class="switch"
              checked={label.on}
              aria-label={`Takes email: ${label.address}`}
              onchange={(event) => toggle(label, event.currentTarget.checked)}
            />
          </label>
        </div>
      {/each}
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
      Sign up to newsletters with this address and each one arrives as its own feed. Unsubscribing from a feed also
      tells the newsletter to stop sending, when it lets nine turtles do that.
    </p>
    <p class="inset-foot">
      For a label, add a word after a plus sign when you sign up, like <span translate="no">turtle-…+cooking@…</span>.
      Once email arrives there, the label shows up here with a switch to turn its email away. The catch: anyone with a
      labelled address can find your plain one by taking the label off, and a few sign-up forms don't accept a plus
      sign. New address stops all email to the old one, labels included, for when spam arrives.
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
