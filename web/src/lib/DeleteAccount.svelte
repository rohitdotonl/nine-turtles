<!--
  "Delete your account?" (SPEC section 18, decision 0088), opened from
  Settings › Account by any reader but the owner. It is the one "Are you
  sure?": it first offers the reader's two downloads (their feeds and folders
  as OPML, their starred articles), then Delete account, which deletes the
  reader and everything theirs at once and for good, with no waiting period
  (the owner's choice, decision 0088), and signs this device out. Cancel,
  Escape or the X keeps everything.

  On a wide window it's a sheet over Settings: Delete account in red words at
  the far left of the one row of actions, Cancel at the right end. On a phone,
  the phone sheet's one build (decision 0052): an X beside the title, no
  Cancel, and Delete account as the one red row of a group of its own.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import PageHead from "./PageHead.svelte";
  import Sheet from "./Sheet.svelte";
  import { edge } from "./edge";
  import { deleteAccount } from "./accounts";

  let {
    heading = $bindable(),
    sheet = false,
    besideToggle = false,
    onDeleted,
    onCancel,
  }: {
    heading?: HTMLHeadingElement;
    /** Shown as a sheet over Settings, not as a page. */
    sheet?: boolean;
    besideToggle?: boolean;
    onDeleted: () => void;
    onCancel: () => void;
  } = $props();

  let busy = $state(false);
  let message = $state("");

  async function remove() {
    if (busy) return;
    busy = true;
    message = "";
    const deleted = await deleteAccount();
    busy = false;
    if (deleted) onDeleted();
    else message = "Couldn't delete your account. Nothing was deleted; try again in a moment.";
  }

  const WHAT = "Your account and everything in it are deleted at once, for good: this can't be undone.";
</script>

{#snippet remover(look: string)}
  <button
    type="button"
    aria-disabled={busy}
    aria-describedby="delete-account-help"
    title={WHAT}
    onclick={remove}
    class={look}>Delete account</button
  >
{/snippet}

{#snippet body()}
  <div class={["flex flex-col gap-5", !sheet && "flex-1"]}>
    <p id="delete-account-help">
      Your feeds, folders, read and starred articles, saved searches, rules and app password go for good, along with your
      email and password. This can't be undone.
    </p>
    <div class="flex flex-col gap-1.5">
      <p class="text-small text-ink-2">Before you go, you can download them</p>
      <div class="inset-group">
        <a href="/api/opml" download class="inset-row inset-action"
          >Export OPML<span class="row-glyph"><Icon name="download" size={18} /></span></a
        >
        <a href="/api/starred/export" download class="inset-row inset-action"
          >Export starred articles<span class="row-glyph"><Icon name="download" size={18} /></span></a
        >
      </div>
      <p class="field-help">Your feeds and folders as an OPML file, and your starred articles as a JSON Feed file.</p>
    </div>
    <p role="status" class={["flex items-start gap-1.5 text-small text-danger", !message && "sr-only"]}>
      {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
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
  </div>
{/snippet}

{#if sheet}
  <Sheet title="Delete your account?" bind:heading onClose={onCancel}>
    {@render body()}
  </Sheet>
{:else}
  <section aria-labelledby="list-heading" class="page-sheet">
    <div class="page-sheet-card">
      <PageHead title="Delete your account?" bind:heading {besideToggle} onClose={onCancel} closeLabel="Close" />
      <div use:edge class="scroller relative flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-5 pb-10 md:px-10">
        <div class="mx-auto flex w-full max-w-xl flex-1 flex-col">
          {@render body()}
        </div>
      </div>
    </div>
  </section>
{/if}
