<!--
  "Delete your account?" (SPEC section 18, decision 0088), opened from
  Settings › Leaving by any reader but the owner. It is the one "Are you
  sure?": it first offers the reader's two downloads (their feeds and folders
  as OPML, their starred articles), then asks for their password (decision
  0200, so a device left signed in can't delete anything), then Delete account, which deletes the
  reader and everything theirs at once and for good, with no waiting period
  (the owner's choice, decision 0088), and signs this device out. Cancel,
  Escape or the X keeps everything.

  On a wide window it's a sheet over Settings: Delete account in red words at
  the far left of the one row of actions, Cancel at the right end. On a phone,
  the phone sheet's one build (decision 0052): an X beside the title, no
  Cancel, and Delete account as the one red row of a group of its own.

  With `data`, it is "Delete your data?" instead (decision 0117), opened by
  every reader, the owner too: the same downloads first, then Delete data,
  which empties the account (feeds, folders, articles, stars, notes,
  rules) for good and keeps the reader signed in. This
  device's saved copies go too, and the app starts again, empty.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import PageHead from "./PageHead.svelte";
  import Sheet from "./Sheet.svelte";
  import { edge } from "./edge";
  import { deleteAccount, deleteData, explainConfirm } from "./accounts";
  import { forget } from "./offline";

  let {
    heading = $bindable(),
    sheet = false,
    data = false,
    besideToggle = false,
    onDeleted,
    onCancel,
  }: {
    heading?: HTMLHeadingElement;
    /** Shown as a sheet over Settings, not as a page. */
    sheet?: boolean;
    /** Delete the reader's data, keeping their account, instead of the account. */
    data?: boolean;
    besideToggle?: boolean;
    onDeleted: () => void;
    onCancel: () => void;
  } = $props();

  let busy = $state(false);
  let message = $state("");
  let password = $state("");
  let refused = $state(false);
  let passwordField: HTMLInputElement | undefined = $state();

  async function remove(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    busy = true;
    message = "";
    const result = await (data ? deleteData(password) : deleteAccount(password));
    const deleted = result.ok;
    if (deleted && data) {
      // This device's copies were of what's gone; the app opens again, empty, at its start.
      await forget();
      location.assign("/");
      return;
    }
    busy = false;
    if (result.ok) {
      onDeleted();
      return;
    }
    message = explainConfirm(
      result,
      `Your ${data ? "data" : "account"} couldn't be deleted. Nothing has changed. Try again in a moment.`,
    );
    refused = result.reason === "wrong-password" || result.reason === "password-needed" || result.reason === "wait";
    if (result.reason === "wrong-password") password = "";
    if (refused) passwordField?.focus();
  }

  const WHAT = $derived(
    data
      ? "Everything in your account is deleted at once, for good: this can't be undone. Your account stays."
      : "Your account and everything in it are deleted at once, for good: this can't be undone.",
  );
  const TITLE = $derived(data ? "Delete your data?" : "Delete your account?");
</script>

{#snippet remover(look: string)}
  <button
    type="submit"
    aria-disabled={busy}
    aria-describedby="delete-account-help"
    title={WHAT}
    class={look}>{data ? "Delete data" : "Delete account"}</button
  >
{/snippet}

{#snippet body()}
  <form onsubmit={remove} class={["flex flex-col gap-5", !sheet && "flex-1"]}>
    <p id="delete-account-help">
      {#if data}
        Your feeds, folders, read and starred articles, notes and rules go for good. This can't
        be undone. Your account stays: you stay signed in, with the same email, password and settings.
      {:else}
        Your feeds, folders, read and starred articles, notes, rules, app password and passkeys go
        for good, along with your email and password. This can't be undone.
      {/if}
    </p>
    <div class="flex flex-col gap-2">
      <p class="text-meta text-ink-2">Before you go, you can download them</p>
      <div class="inset-group">
        <a href="/api/everything" download class="inset-row inset-action"
          >Download everything<span class="row-glyph"><Icon name="download" /></span></a
        >
      </div>
      <p class="field-help">
        One folder of plain pages any browser opens: who you follow, what you starred or highlighted, and your notes.
      </p>
    </div>
    <!-- Asked for, as for a new email, so a device left signed in can't delete anything (decision 0200). -->
    <label class="flex flex-col gap-2">
      <span class="text-meta text-ink-2">Your password</span>
      <input
        bind:this={passwordField}
        bind:value={password}
        type="password"
        autocomplete="current-password"
        required
        aria-describedby="delete-account-message"
        aria-invalid={refused ? "true" : undefined}
        class="field"
      />
    </label>
    <p id="delete-account-message" role="status" class={["flex items-start gap-2 text-meta text-danger", !message && "sr-only"]}>
      {#if message}<span class="mt-px shrink-0"><Icon name="alert" /></span>{message}{/if}
    </p>
    {#if sheet}
      <div class="sheet-actions">
        {@render remover("btn-danger")}
        <button type="button" onclick={onCancel} class="btn">Cancel</button>
      </div>
    {:else}
      <div class="inset-group">
        {@render remover("inset-row inset-action text-danger font-semibold")}
      </div>
    {/if}
  </form>
{/snippet}

{#if sheet}
  <Sheet title={TITLE} bind:heading onClose={onCancel}>
    {@render body()}
  </Sheet>
{:else}
  <section aria-labelledby="list-heading" class="page-sheet">
    <div class="page-sheet-card">
      <PageHead title={TITLE} bind:heading {besideToggle} onClose={onCancel} closeLabel="Close" />
      <div use:edge class="scroller relative flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-5 pb-10 md:px-10">
        <div class="mx-auto flex w-full max-w-xl flex-1 flex-col">
          {@render body()}
        </div>
      </div>
    </div>
  </section>
{/if}
