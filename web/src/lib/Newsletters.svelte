<!--
  Newsletters (SPEC section 28), a group of Settings, shown only while
  nine turtles takes newsletter emails: the reader's private address, with
  Copy, and New address for when spam arrives (the old one stops taking
  email; Undo on the line below brings it back). Each newsletter sent to the
  address arrives as its own feed (decision 0091). Labels that have had mail
  (`name+label@…`) are listed with a switch that turns their mail away.
-->
<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import NoteLine from "./NoteLine.svelte";
  import { UNDONE, UNDO_FAILED } from "./messages";
  import { type Label, COPIED, TooLate, copyAddress, newAddress, newslettersStatus, switchLabel, undoNewAddress } from "./newsletters";

  let on = $state(false);
  let address = $state("");
  let labels: Label[] = $state([]);
  /** The address New address replaced, while Undo can bring it back. */
  let previous: string | null = $state(null);
  let message = $state("");
  /** The message says something failed: oxblood, with the alert icon. */
  let refusal = $state(false);
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
    message = await copyAddress(address);
    refusal = message !== COPIED;
    // Undo for New address stays on the line: copying changes nothing.
  }

  async function replace() {
    if (busy) return;
    busy = true;
    [message, refusal] = ["", false];
    try {
      const made = await newAddress();
      address = made.address;
      previous = made.previous;
      // Labels belong to an address: the new one has none yet.
      labels = [];
      message = "You have a new address. Email to the old one is now refused.";
    } catch {
      [message, refusal] = ["A new address couldn't be made. Try again in a moment.", true];
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
      message = UNDONE;
      previous = null;
    } catch (error) {
      if (error instanceof TooLate) {
        [message, refusal] = ["It's been over an hour, so the old address can't come back.", true];
        previous = null;
      } else {
        [message, refusal] = [UNDO_FAILED, true];
      }
    }
    busy = false;
  }

  async function toggle(label: Label, on: boolean) {
    // The switch shows the change at once, and goes back if it couldn't be saved.
    // New address's Undo stays, as it does for Copy: once it's gone the old address can't come back.
    label.on = on;
    try {
      await switchLabel(label.label, on);
      [message, refusal] = [on ? `${label.address} takes email again.` : `Email to ${label.address} is now turned away.`, false];
    } catch {
      label.on = !on;
      [message, refusal] = [`${label.address} couldn't be changed. Try again in a moment.`, true];
    }
  }

  /** × on the line: it goes, Undo with it, and the keyboard's place goes to the group's heading. */
  async function closeNote() {
    [message, refusal, previous] = ["", false, null];
    await tick();
    document.getElementById("newsletters-heading")?.focus();
  }
</script>

{#if on}
  <section aria-labelledby="newsletters-heading">
    <h3 id="newsletters-heading" tabindex="-1" class="inset-head">Newsletters</h3>
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
    <div class={["inset-foot flex flex-wrap items-center gap-x-3 gap-y-1 text-ink", !message && "sr-only"]}>
      <NoteLine announce {message} {refusal} {busy} onUndo={previous ? undo : undefined} onClose={closeNote} />
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
