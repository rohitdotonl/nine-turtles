<!--
  "Change email" (SPEC section 18, decision 0088), opened from Settings ›
  Account: the new address and the reader's password (so a device left
  signed in can't hand the account to someone else). A link goes to the new
  address; nothing changes until it's followed, and then the old address is
  told. On a wide window it's a sheet over Settings; on a phone, the phone
  sheet's one build (decision 0052): an X beside the title, no Cancel, and
  Send link at the screen's foot.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import PageHead from "./PageHead.svelte";
  import Sheet from "./Sheet.svelte";
  import { edge } from "./edge";
  import { changeEmail, explainChange } from "./accounts";
  import { plausibleEmail } from "./readers";

  let {
    heading = $bindable(),
    sheet = false,
    besideToggle = false,
    onSent,
    onCancel,
  }: {
    heading?: HTMLHeadingElement;
    /** Shown as a sheet over Settings, not as a page. */
    sheet?: boolean;
    besideToggle?: boolean;
    /** The link is on its way: what to say in Settings. */
    onSent: (message: string) => void;
    onCancel: () => void;
  } = $props();

  let email = $state("");
  let password = $state("");
  let message = $state("");
  let refusedField: "email" | "password" | undefined = $state();
  let busy = $state(false);
  let emailField: HTMLInputElement | undefined = $state();

  async function send(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    if (!plausibleEmail(email.trim())) {
      refusedField = "email";
      message = "That doesn't look like an email address.";
      return;
    }
    busy = true;
    message = "";
    const result = await changeEmail(email, password);
    busy = false;
    if (result.ok) {
      onSent(explainChange(result));
      return;
    }
    message = explainChange(result);
    refusedField =
      result.reason === "email" || result.reason === "same"
        ? "email"
        : result.reason === "wrong-password" || result.reason === "wait"
          ? "password"
          : undefined;
    if (result.reason === "wrong-password") password = "";
  }
</script>

{#snippet form()}
  <form onsubmit={send} class={["flex flex-col gap-5", !sheet && "flex-1"]}>
    <label class="flex flex-col gap-1.5">
      <span class="text-small text-ink-2">New email</span>
      <input
        bind:this={emailField}
        bind:value={email}
        type="text"
        inputmode="email"
        autocomplete="email"
        autocapitalize="none"
        spellcheck="false"
        aria-describedby="change-email-message"
        aria-invalid={refusedField === "email" ? "true" : undefined}
        class="field"
      />
    </label>
    <div class="flex flex-col gap-1.5">
    <label class="flex flex-col gap-1.5">
      <span class="text-small text-ink-2">Your password</span>
      <input
        bind:value={password}
        type="password"
        autocomplete="current-password"
        required
        aria-describedby="change-email-help change-email-message"
        aria-invalid={refusedField === "password" ? "true" : undefined}
        class="field"
      />
    </label>
    <p id="change-email-help" class="field-help">A link goes to the new email. Your email changes once it's opened.</p>
    </div>
    <p id="change-email-message" role="status" class={["flex items-start gap-1.5 text-small text-danger", !message && "sr-only"]}>
      {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
    </p>
    {#if sheet}
      <div class="sheet-actions">
        <button type="button" onclick={onCancel} class="btn">Cancel</button>
        <button type="submit" aria-disabled={busy} class="btn-primary">Send link</button>
      </div>
    {:else}
      <div class="page-action">
        <button type="submit" aria-disabled={busy} class="btn-primary">Send link</button>
      </div>
    {/if}
  </form>
{/snippet}

{#if sheet}
  <Sheet title="Change email" bind:heading onClose={onCancel} initial={() => emailField}>
    {@render form()}
  </Sheet>
{:else}
  <section aria-labelledby="list-heading" class="page-sheet">
    <div class="page-sheet-card">
      <PageHead title="Change email" bind:heading {besideToggle} onClose={onCancel} closeLabel="Close" />
      <div use:edge class="scroller relative flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-5 md:px-10">
        <div class="mx-auto flex w-full max-w-xl flex-1 flex-col">
          {@render form()}
        </div>
      </div>
    </div>
  </section>
{/if}
