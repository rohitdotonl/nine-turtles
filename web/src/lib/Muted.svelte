<!--
  Settings › Rules › Muted articles (SPEC section 27): what rules (or the
  reader) muted, newest first, each with its feed, its time and Unmute.
  Muted articles are kept, never deleted, so nothing is hidden behind the
  reader's back. Unmuting brings an article back, unread; it stays on this
  page, saying so, with Undo, so nothing moves while you look.
-->
<script lang="ts">
  import { tick } from "svelte";
  import { edge } from "./edge";
  import PageHead from "./PageHead.svelte";
  import { when, type Article } from "./feeds";
  import { listMuted, ruleRefused, setMuted } from "./rules";

  let {
    heading = $bindable(),
    onClose,
    onChanged,
    besideToggle = false,
  }: {
    heading?: HTMLHeadingElement;
    onClose: () => void;
    /** An article was unmuted or muted again: the sidebar's counts reload. */
    onChanged: () => void;
    besideToggle?: boolean;
  } = $props();

  type Row = { article: Article; unmuted: boolean; busy: boolean; message: string };

  let rows: Row[] | undefined = $state();
  let count = $state(0);
  let failed = $state(false);

  $effect(() => {
    listMuted()
      .then((listed) => {
        count = listed.count;
        rows = listed.articles.map((article) => ({ article, unmuted: false, busy: false, message: "" }));
      })
      .catch(() => (failed = true));
  });

  async function change(row: Row, muted: boolean) {
    if (row.busy) return;
    row.busy = true;
    const refusal = await setMuted([row.article.id], muted);
    row.busy = false;
    if (refusal) {
      row.message = ruleRefused(refusal);
      return;
    }
    row.unmuted = !muted;
    row.message = muted ? "" : "Unmuted. It's back in your lists, unread.";
    onChanged();
    await tick();
    document.querySelector<HTMLElement>(`#muted-${row.article.id} button`)?.focus();
  }
</script>

<section aria-labelledby="muted-heading" class="flex flex-1 flex-col bg-paper">
  <PageHead title="Muted articles" id="muted-heading" bind:heading {onClose} closeLabel="Close muted articles" {besideToggle} column="max-w-[35rem]" />
  <div use:edge class="scroller relative min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-16 md:px-10">
    <div class="mx-auto flex max-w-[35rem] flex-col gap-8">
      {#if failed}
        <p role="status" class="text-ink-2">The muted articles couldn't be loaded. Try again in a moment.</p>
      {:else if rows && rows.length === 0}
        <div role="status">
          <p class="text-ink">Nothing is muted.</p>
          <p class="mt-1 text-meta text-muted">When a rule mutes an article, it's kept here, and search still finds it.</p>
        </div>
      {:else if rows}
        <section aria-labelledby="muted-list-heading">
          <h3 id="muted-list-heading" class="inset-head">{count === 1 ? "1 muted article" : `${count} muted articles`}</h3>
          <ul class="inset-group">
            {#each rows as row (row.article.id)}
              <li id={`muted-${row.article.id}`} class="inset-row muted-row">
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class={["break-words", row.unmuted ? "font-semibold" : "text-ink-2"]}>{row.article.title || "Untitled"}</span>
                  <span class="text-meta text-muted"
                    >{row.article.feedTitle} · <time datetime={new Date(row.article.at * 1000).toISOString()}>{when(row.article.at)}</time></span
                  >
                  <span role="status" class={["text-meta text-ink", !row.message && "sr-only"]}>{row.message}</span>
                </span>
                {#if row.unmuted}
                  <button type="button" class="btn btn-small shrink-0" aria-label={`Undo unmuting ${row.article.title}`} aria-disabled={row.busy} onclick={() => change(row, true)}>Undo</button>
                {:else}
                  <button type="button" class="btn btn-small shrink-0" aria-label={`Unmute ${row.article.title}`} aria-disabled={row.busy} onclick={() => change(row, false)}>Unmute</button>
                {/if}
              </li>
            {/each}
          </ul>
          <p class="inset-foot">
            {#if count > rows.length}The newest {rows.length} are shown. {/if}Muted articles count as read and wait in no list. Unmute
            one to bring it back, unread. Search finds them all.
          </p>
        </section>
      {/if}
    </div>
  </div>
</section>

<style>
  .muted-row {
    flex-wrap: nowrap;
    padding-block: 0.625rem;
  }
  .muted-row > span {
    gap: 0.125rem;
    line-height: 1.4;
  }
</style>
