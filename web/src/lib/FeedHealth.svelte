<!--
  The feed health page (SPEC section 17), opened from Settings › Feeds. It
  lists only the feeds that aren't working, worst first: "Not working" (dead:
  a week of "not found", or three weeks of failing), then "Having trouble".
  The group's name says which, in words, so no status color is needed.
  Each feed says what went wrong in plain words and offers Retry, Find new
  address and Unsubscribe. Nothing moves on its own: a feed that works again
  after Retry stays where it is, saying so, until the page is opened again.
  With nothing to list, it says so calmly.
-->
<script lang="ts">
  import { tick } from "svelte";
  import { edge } from "./edge";
  import NewAddress from "./NewAddress.svelte";
  import PageHead from "./PageHead.svelte";
  import { refused, resubscribe, unsubscribe } from "./feeds";
  import { headline, lastWorked, listSick, reason, refusalMessage, retry, type Sick } from "./health";

  let {
    heading = $bindable(),
    onClose,
    onFeedsChanged,
    besideToggle = false,
  }: {
    heading?: HTMLHeadingElement;
    onClose: () => void;
    /** A feed was unsubscribed from, brought back or moved: the sidebar reloads. */
    onFeedsChanged: () => void;
    besideToggle?: boolean;
  } = $props();

  type Row = {
    feed: Sick;
    /** What the last action said, if anything. */
    message: string;
    busy: boolean;
    /** Find new address (decision 0106), and whether its question or choice is showing. */
    finder?: NewAddress;
    choosing: boolean;
    unsubscribed: boolean;
  };

  let rows: Row[] | undefined = $state();
  let failed = $state(false);
  let now = $state(Date.now() / 1000);

  $effect(() => {
    listSick()
      .then((feeds) => {
        now = Date.now() / 1000;
        rows = feeds.map((feed) => ({ feed, message: "", busy: false, choosing: false, unsubscribed: false }));
      })
      .catch(() => (failed = true));
  });

  /**
   * An action replaced the button the keyboard was on: its place moves to
   * what took the button's place (`what`, a `data-focus` name in the feed's
   * row), so it never falls back to the top of the page.
   */
  async function focusIn(row: Row, what: string) {
    await tick();
    document.querySelector<HTMLElement>(`#health-feed-${row.feed.id} [data-focus="${what}"]`)?.focus();
  }

  let groups = $derived([
    { id: "dead", name: "Not working", rows: (rows ?? []).filter((row) => row.feed.state === "dead") },
    { id: "trouble", name: "Having trouble", rows: (rows ?? []).filter((row) => row.feed.state !== "dead") },
  ]);

  async function tryAgain(row: Row) {
    row.busy = true;
    row.message = "Checking…";
    const answer = await retry(row.feed.id);
    row.busy = false;
    now = Date.now() / 1000;
    if ("error" in answer) {
      row.message = refusalMessage(answer, "retry");
      return;
    }
    // A feed that turned dead while failing stays in its group until the page is opened again.
    row.feed = { ...answer, state: answer.state === "working" ? "working" : row.feed.state };
    row.message = answer.state === "working" ? "It works again. Its new articles are in your lists." : "Tried again just now: it still isn't working.";
    if (answer.state === "working") onFeedsChanged();
  }

  /** Find new address: what the site names shows in the feed's block (NewAddress.svelte). */
  function find(row: Row) {
    row.message = "";
    row.finder?.find();
  }

  async function moved(row: Row, feed: Sick) {
    row.feed = feed;
    onFeedsChanged();
    await focusIn(row, "retry");
  }

  async function leave(row: Row) {
    row.busy = true;
    const refusal = await unsubscribe(row.feed.id);
    row.busy = false;
    if (refusal) {
      row.message = refused(refusal, "feed");
      return;
    }
    row.unsubscribed = true;
    row.message = `Unsubscribed from ${row.feed.title}.`;
    onFeedsChanged();
    await focusIn(row, "undo");
  }

  async function undo(row: Row) {
    row.busy = true;
    const refusal = await resubscribe(row.feed.id);
    row.busy = false;
    if (refusal) {
      row.message = refused(refusal, "feed");
      return;
    }
    row.unsubscribed = false;
    row.message = "";
    onFeedsChanged();
    await focusIn(row, "unsubscribe");
  }
</script>

<section aria-labelledby="feed-health-heading" class="flex flex-1 flex-col bg-paper">
  <PageHead title="Feed health" id="feed-health-heading" bind:heading {onClose} closeLabel="Close feed health" {besideToggle} column="max-w-[35rem]" />
  <div use:edge class="scroller relative min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-16 md:px-10">
    <div class="mx-auto flex max-w-[35rem] flex-col gap-8">
      <span id="health-unsubscribe-help" class="sr-only">Removes its articles; starred ones stay. You can undo it straight afterwards.</span>
      {#if failed}
        <p role="status" class="text-ink-2">The feeds couldn't be loaded. Try again in a moment.</p>
      {:else if rows && rows.length === 0}
        <div role="status">
          <p class="text-ink">All feeds are working.</p>
          <p class="mt-1 text-meta text-muted">When a feed stops working, it's listed here, with what went wrong and what you can do.</p>
        </div>
      {:else if rows}
        {#each groups as group (group.id)}
          {#if group.rows.length > 0}
            <section aria-labelledby={`health-${group.id}`}>
              <h3 id={`health-${group.id}`} class="inset-head">{group.name}</h3>
              <ul class="inset-group">
                {#each group.rows as row (row.feed.id)}
                  <li id={`health-feed-${row.feed.id}`} class="inset-row feed-row">
                    <h4 class="w-full min-w-0 font-semibold break-words">{row.feed.title}</h4>
                    {#if !row.unsubscribed}
                      <p class="w-full text-ink-2">
                        <span class="font-semibold">{headline(row.feed, now)}.</span>
                        {#if row.feed.state !== "working"}{reason(row.feed.problem)}{/if}
                      </p>
                      <p class="w-full text-meta text-muted">
                        {#if row.feed.state === "working"}Checked just now{:else}{lastWorked(row.feed)}{/if}{#if row.feed.state === "dead"}. Still checked once a day, in case it comes back{/if}.{#if row.feed.frequency}
                        {row.feed.frequency}.{/if}
                      </p>
                    {/if}
                    <p role="status" class={["w-full text-ink", !row.message && "sr-only"]}>{row.message}</p>
                    {#if row.unsubscribed}
                      <div class="actions">
                        <button type="button" class="btn btn-small" data-focus="undo" aria-label={`Undo unsubscribing from ${row.feed.title}`} aria-disabled={row.busy} onclick={() => !row.busy && undo(row)}>Undo</button>
                      </div>
                    {:else}
                      <NewAddress
                        bind:this={row.finder}
                        bind:open={row.choosing}
                        bind:busy={row.busy}
                        feed={row.feed}
                        onMoved={(feed) => moved(row, feed)}
                        onClosed={() => focusIn(row, "find")}
                      />
                      <div class="actions" hidden={row.choosing}>
                        <button type="button" class="btn btn-small" data-focus="retry" aria-disabled={row.busy} aria-label={`Retry ${row.feed.title}`} onclick={() => !row.busy && tryAgain(row)}>Retry</button>
                        <button type="button" class="btn btn-small" data-focus="find" aria-disabled={row.busy} aria-label={`Find new address for ${row.feed.title}`} onclick={() => !row.busy && find(row)}>Find new address</button>
                        <button
                          type="button"
                          class="btn-danger text-small"
                          title="Stops following this feed and removes its articles; starred ones stay. You can undo it straight afterwards."
                          aria-label={`Unsubscribe from ${row.feed.title}`}
                          aria-describedby="health-unsubscribe-help"
                          data-focus="unsubscribe"
                          aria-disabled={row.busy}
                          onclick={() => !row.busy && leave(row)}>Unsubscribe</button
                        >
                      </div>
                    {/if}
                  </li>
                {/each}
              </ul>
              {#if group.id === "dead"}
                <p class="inset-foot">These haven't worked for weeks, or haven't been found for a week. The site may have moved its feed, or stopped publishing one.</p>
              {:else}
                <p class="inset-foot">These failed their last checks. Many come back on their own; nine turtles keeps trying, less often each time.</p>
              {/if}
            </section>
          {/if}
        {/each}
      {/if}
    </div>
  </div>
</section>

<style>
  /* Each feed is a block of lines: its name, what went wrong, when it last worked, then its actions. */
  .feed-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
    padding-block: 0.75rem;
  }
  .feed-row > p {
    line-height: 1.4;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
    align-items: center;
    margin-top: 0.25rem;
  }
  .actions[hidden] {
    display: none;
  }
  .actions > .btn-danger {
    margin-left: 0;
  }
</style>
