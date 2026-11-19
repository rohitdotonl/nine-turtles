<!--
  Replies you started (SPEC section 37, decision 0307), first in what's yours of them on their
  page: a paper plane, the article's title (it opens the article) and the day, the latest first,
  at most 20. A line is noted when the reader presses any way back at an article's end; nine
  turtles never knows whether anything was sent, so the heading says only that it was started. Nothing
  shows while there are none, or while the reader switched it off in Settings. Each line has a
  quiet Remove (the bin, decision 0305); Undo, in its place, brings it back with its day.
-->
<script lang="ts">
  import LoadFailed from "./LoadFailed.svelte";
  import TextButton from "./TextButton.svelte";
  import { tick } from "svelte";
  import { getJson, isRecord } from "./http";
  import Icon from "./Icon.svelte";
  import { forgetReply, restoreReply } from "./replies";
  import { toArticle, untitledOpening, type Article } from "./shapes";
  import { exactly, when } from "./times";

  let {
    feed,
    onOpen,
    onState,
  }: {
    feed: number;
    onOpen: (article: Article) => void;
    /** Whether it has answered (or waited long enough), so their page can show the card whole, with nothing arriving in it later to push the rest down; and whether it shows anything. */
    onState?: (ready: boolean, shown: boolean) => void;
  } = $props();

  type Reply = { at: number; article: Article; removed?: boolean };

  let replies: Reply[] = $state([]);
  let problem = $state("");
  /** The list has answered, or the page has waited for it long enough. */
  let ready = $state(false);
  /** It couldn't be loaded: one quiet line says so, rather than letting the replies seem gone. */
  let failed = $state(false);
  let undoButtons: Record<number, HTMLButtonElement | undefined> = $state({});
  let removers: Record<number, HTMLButtonElement | undefined> = $state({});

  /** Try again asks once more: the list below is fetched afresh. */
  let attempt = $state(0);

  $effect(() => {
    void attempt;
    const id = feed;
    replies = [];
    problem = "";
    failed = false;
    ready = false;
    // A slow answer doesn't keep the card hidden for long: past this it shows, and the list joins it when it comes.
    const late = setTimeout(() => (ready = true), 2000);
    getJson(`/api/feeds/${id}/replies`).then(
      (body) => {
        if (id !== feed) return;
        replies = toReplies(body);
        ready = true;
      },
      () => {
        if (id !== feed) return;
        failed = true;
        ready = true;
      },
    );
    return () => clearTimeout(late);
  });

  $effect(() => onState?.(ready, failed || replies.length > 0));

  /** Its title, or an untitled piece's opening words. */
  const titleOf = (article: Article) => untitledOpening(article) ?? article.title;

  function toReplies(body: unknown): Reply[] {
    if (!isRecord(body) || !Array.isArray(body.replies)) return [];
    return body.replies.flatMap((each: unknown) => (isRecord(each) && typeof each.started_at === "number" && isRecord(each.article) ? [{ at: each.started_at, article: toArticle(each.article) }] : []));
  }

  async function remove(reply: Reply) {
    problem = "";
    if (!(await forgetReply(reply.article.id))) return void (problem = "The reply couldn't be removed. Try again in a moment.");
    reply.removed = true;
    await tick();
    undoButtons[reply.article.id]?.focus();
  }

  async function undo(reply: Reply) {
    problem = "";
    if (!(await restoreReply(reply.article.id, reply.at))) return void (problem = "The reply couldn't be brought back. Try again in a moment.");
    reply.removed = false;
    await tick();
    removers[reply.article.id]?.focus();
  }
</script>

{#if failed}
  <section class="flex flex-col gap-3" aria-labelledby="their-replies">
    <h3 id="their-replies" tabindex="-1" class="label outline-none">Replies you started</h3>
    <LoadFailed class="text-meta" words="Replies you started couldn't be loaded." heading="their-replies" onRetry={() => (attempt += 1)} />
  </section>
{:else if replies.length > 0}
  <section class="flex flex-col gap-3" aria-labelledby="their-replies">
    <h3 id="their-replies" class="label">Replies you started</h3>
    <ul class="flex flex-col gap-1">
      {#each replies as reply (reply.article.id)}
        <li class="line">
          {#if reply.removed}
            <p class="removed text-meta text-ink-2" role="status">Removed.</p>
            <TextButton bind:element={undoButtons[reply.article.id]} onclick={() => void undo(reply)}>Undo</TextButton>
          {:else}
            <span class="mark" aria-hidden="true"><Icon name="send" /></span>
            <p class="what">
              <button type="button" class="text-link title" onclick={() => onOpen(reply.article)}>{titleOf(reply.article)}</button>
              <span class="day">· <time datetime={new Date(reply.at * 1000).toISOString()} title={exactly(reply.at)}>{when(reply.at)}</time></span>
            </p>
            <button type="button" class="btn-quiet btn-icon -mr-2 remove" bind:this={removers[reply.article.id]} aria-label="Remove {titleOf(reply.article)} from Replies you started" title="Remove" onclick={() => void remove(reply)}><Icon name="trash" /></button>
          {/if}
        </li>
      {/each}
    </ul>
    {#if problem}<p class="flex items-start gap-2 text-meta text-danger" role="alert"><span class="mt-px shrink-0"><Icon name="alert" /></span>{problem}</p>{/if}
  </section>
{/if}

<style>
  /* Each line: the paper plane, the title in the reading serif with its day after it, and Remove at the end. */
  .line {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    min-height: 2.75rem;
  }
  .mark {
    flex-shrink: 0;
    padding-top: 0.25rem;
    color: var(--ink-2);
  }
  .what {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-family: var(--font-serif);
    font-size: var(--text-large);
    line-height: 1.4;
    color: var(--ink);
  }
  .removed {
    flex: 1;
    margin: 0;
    align-self: center;
  }
  /* The title, underlined as every link is; its 44px to touch reaches above and below without spacing the lines apart. */
  .what :global(.title) {
    position: relative;
    display: inline;
    min-height: 0;
    text-align: left;
    font: inherit;
  }
  .what :global(.title)::after {
    content: "";
    position: absolute;
    inset: -0.5rem -0.25rem;
  }
  .day {
    font-family: var(--font-sans);
    font-size: var(--text-meta);
    color: var(--ink-2);
    white-space: nowrap;
  }
  .remove {
    flex-shrink: 0;
    margin-top: -0.25rem;
    color: var(--muted);
  }
</style>
