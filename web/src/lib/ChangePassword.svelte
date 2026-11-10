<!--
  "Change password" (SPEC section 18, decision 0200), opened from Settings ›
  Account: the reader's current password, then the new one. Setting it signs
  out every other device and keeps this one signed in; Settings then says so.
  Built as Change email is: on a wide window a sheet over Settings; on a
  phone, the phone sheet's one build (decision 0052): an X beside the title,
  no Cancel, and Change password at the screen's foot. The new password has
  a Show button, as on the sign-in pages (decision 0191).
-->
<script lang="ts">
  import Waiting from "./Waiting.svelte";
  import Icon from "./Icon.svelte";
  import PageHead from "./PageHead.svelte";
  import PasswordField from "./PasswordField.svelte";
  import Sheet from "./Sheet.svelte";
  import { edge } from "./edge";
  import { changePassword, explainConfirm } from "./accounts";
  import { PASSWORD_MINIMUM } from "./readers";

  let {
    heading = $bindable(),
    sheet = false,
    besideToggle = false,
    onChanged,
    onCancel,
  }: {
    heading?: HTMLHeadingElement;
    /** Shown as a sheet over Settings, not as a page. */
    sheet?: boolean;
    besideToggle?: boolean;
    /** The new password is set: what to say in Settings. */
    onChanged: (message: string) => void;
    onCancel: () => void;
  } = $props();

  let current = $state("");
  let password = $state("");
  let message = $state("");
  let refusedField: "current" | "new" | undefined = $state();
  let busy = $state(false);
  let currentField: HTMLInputElement | undefined = $state();

  async function change(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    if ([...password].length < PASSWORD_MINIMUM) {
      refusedField = "new";
      message = `Choose a new password of at least ${PASSWORD_MINIMUM} characters.`;
      return;
    }
    busy = true;
    message = "";
    const result = await changePassword(current, password);
    busy = false;
    if (result.ok) {
      onChanged("Your password is changed. Your other devices are signed out.");
      return;
    }
    message = explainConfirm(result, "Your password couldn't be changed. Try again in a moment.");
    refusedField =
      result.reason === "password-short" || result.reason === "password-long"
        ? "new"
        : result.reason === "wrong-password" || result.reason === "password-needed" || result.reason === "wait"
          ? "current"
          : undefined;
    if (result.reason === "wrong-password") current = "";
  }
</script>

{#snippet form()}
  <form onsubmit={change} class={["flex flex-col gap-5", !sheet && "flex-1"]}>
    <label class="flex flex-col gap-1.5">
      <span class="text-meta text-ink-2">Current password</span>
      <input
        bind:this={currentField}
        bind:value={current}
        type="password"
        autocomplete="current-password"
        required
        aria-describedby="change-password-message"
        aria-invalid={refusedField === "current" ? "true" : undefined}
        class="field"
      />
    </label>
    <div class="flex flex-col gap-1.5">
      <label for="new-password" class="text-meta text-ink-2">New password</label>
      <PasswordField
        id="new-password"
        bind:value={password}
        autocomplete="new-password"
        label="new password"
        describedby="change-password-help change-password-message"
        invalid={refusedField === "new"}
      />
      <p id="change-password-help" class="field-help">
        At least {PASSWORD_MINIMUM} characters. Your other devices will be signed out.
      </p>
    </div>
    <p id="change-password-message" role="status" class={["flex items-start gap-1.5 text-meta text-danger", !message && "sr-only"]}>
      {#if message}<span class="mt-px shrink-0"><Icon name="alert" /></span>{message}{/if}
    </p>
    {#if sheet}
      <div class="sheet-actions">
        <button type="button" onclick={onCancel} class="btn">Cancel</button>
        <button type="submit" aria-disabled={busy} class="btn-primary"><Waiting {busy} word="Change password" doing="Changing…" /></button>
      </div>
    {:else}
      <div class="page-action">
        <button type="submit" aria-disabled={busy} class="btn-primary"><Waiting {busy} word="Change password" doing="Changing…" /></button>
      </div>
    {/if}
  </form>
{/snippet}

{#if sheet}
  <Sheet title="Change password" bind:heading onClose={onCancel} initial={() => currentField}>
    {@render form()}
  </Sheet>
{:else}
  <section aria-labelledby="list-heading" class="page-sheet">
    <div class="page-sheet-card">
      <PageHead title="Change password" bind:heading {besideToggle} onClose={onCancel} closeLabel="Close" />
      <div use:edge class="scroller relative flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-5 md:px-10">
        <div class="mx-auto flex w-full max-w-xl flex-1 flex-col">
          {@render form()}
        </div>
      </div>
    </div>
  </section>
{/if}
