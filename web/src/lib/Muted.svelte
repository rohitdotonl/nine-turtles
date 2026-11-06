<!--
  Settings › Hiding › Hidden articles (SPEC section 27): what the reader's
  rules hid, newest first, each with who wrote it, its time and Unhide.
  Hidden articles are kept, never deleted, so nothing goes behind the
  reader's back. Unhiding brings an article back, unread; it stays on this
  page, saying so, with Undo, so nothing moves while you look.
-->
<script lang="ts">
  import { tick } from "svelte";
  import { edge } from "./edge";
  import PageHead from "./PageHead.svelte";
  import { untitledOpening, type Article } from "./shapes";
  import { when } from "./times";
  import { listMuted, ruleRefused, setMuted } from "./rules";

  let {
    heading = $bindable(),
    onClose,
    onChanged,
    besideToggle = false,
  }: {
    heading?: HTMLHeadingElement;
    onClose: () => void;
    /** An article was unhidden or hidden again: the sidebar's counts reload. */
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
    row.message = muted ? "" : "Unhidden. It's back in your lists, unread.";
    onChanged();
    await tick();
    document.querySelector<HTMLElement>(`#muted-${row.article.id} button`)?.focus();
  }
</script>

<section aria-labelledby="muted-heading" class="flex flex-1 flex-col bg-paper">
  <PageHead title="Hidden articles" id="muted-heading" bind:heading {onClose} closeLabel="Close hidden articles" {besideToggle} column="max-w-[35rem]" />
  <div use:edge class="scroller relative min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-16 md:px-10">
    <div class="mx-auto flex max-w-[35rem] flex-col gap-8">
      {#if failed}
        <p role="status" class="text-ink-2">The hidden articles couldn't be loaded. Try again in a moment.</p>
      {:else if rows && rows.length === 0}
        <div role="status">
          <p class="text-ink">Nothing is hidden.</p>
          <p class="mt-1 text-meta text-muted">When an article is hidden, it's kept here, and search still finds it.</p>
        </div>
      {:else if rows}
        <section aria-labelledby="muted-list-heading">
          <h3 id="muted-list-heading" class="inset-head">{count === 1 ? "1 hidden article" : `${count} hidden articles`}</h3>
          <ul class="inset-group">
            {#each rows as row (row.article.id)}
              {@const opening = untitledOpening(row.article)}
              <li id={`muted-${row.article.id}`} class="inset-row muted-row">
                <span class="flex min-w-0 flex-1 flex-col">
                  <!-- An untitled post shows its opening, never semibold, two lines and then "…" (SPEC section 6). -->
                  <span class={["break-words", opening !== undefined && "line-clamp-2", row.unmuted ? opening === undefined && "font-semibold" : "text-ink-2"]}>{opening ?? row.article.title}</span>
                  <span class="text-meta text-muted"
                    >{row.article.feedTitle} · <time datetime={new Date(row.article.at * 1000).toISOString()}>{when(row.article.at)}</time></span
                  >
                  <span role="status" class={["text-meta text-ink", !row.message && "sr-only"]}>{row.message}</span>
                </span>
                {#if row.unmuted}
                  <button type="button" class="btn btn-small shrink-0" aria-label={`Undo unhiding ${row.article.title}`} aria-disabled={row.busy} onclick={() => change(row, true)}>Undo</button>
                {:else}
                  <button type="button" class="btn btn-small shrink-0" aria-label={`Unhide ${row.article.title}`} aria-disabled={row.busy} onclick={() => change(row, false)}>Unhide</button>
                {/if}
              </li>
            {/each}
          </ul>
          <p class="inset-foot">
            {#if count > rows.length}The newest {rows.length} are shown. {/if}Hidden articles count as read and wait in no list. Unhide
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
