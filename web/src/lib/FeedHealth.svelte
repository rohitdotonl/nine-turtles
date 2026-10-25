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
  import { edge } from "./edge";
  import PageHead from "./PageHead.svelte";
  import { refused, resubscribe, unsubscribe, type Choice } from "./feeds";
  import {
    findAddress,
    headline,
    lastWorked,
    listSick,
    moveTo,
    reason,
    refusalMessage,
    retry,
    type Sick,
  } from "./health";

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
    /** Find new address's results, while choosing. */
    choices: Choice[];
    chosen: string;
    unsubscribed: boolean;
  };

  let rows: Row[] | undefined = $state();
  let failed = $state(false);
  let now = $state(Date.now() / 1000);

  $effect(() => {
    listSick()
      .then((feeds) => {
        now = Date.now() / 1000;
        rows = feeds.map((feed) => ({ feed, message: "", busy: false, choices: [], chosen: "", unsubscribed: false }));
      })
      .catch(() => (failed = true));
  });

  let groups = $derived([
    { id: "dead", name: "Not working", rows: (rows ?? []).filter((row) => row.feed.state === "dead") },
    { id: "trouble", name: "Having trouble", rows: (rows ?? []).filter((row) => row.feed.state !== "dead") },
  ]);

  async function tryAgain(row: Row) {
    row.busy = true;
    row.message = "Checking…";
    row.choices = [];
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
  }

  async function find(row: Row) {
    row.busy = true;
    row.message = "Looking on the site…";
    row.choices = [];
    const answer = await findAddress(row.feed.id);
    row.busy = false;
    if (!Array.isArray(answer)) {
      row.message = refusalMessage(answer, "find");
      return;
    }
    row.choices = answer;
    row.chosen = answer[0]?.url ?? "";
    row.message = answer.length === 1 ? "The site names this feed:" : "The site names these feeds. Choose one:";
  }

  async function use(row: Row) {
    if (!row.chosen || row.busy) return;
    row.busy = true;
    row.message = "Moving…";
    const answer = await moveTo(row.feed.id, row.chosen);
    row.busy = false;
    if ("error" in answer) {
      row.message = refusalMessage(answer, "move");
      return;
    }
    row.feed = { ...answer, state: "working" };
    row.choices = [];
    row.message = "It now reads from its new address and works again. Its articles, stars and folders stayed.";
    onFeedsChanged();
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
    row.choices = [];
    row.message = `Unsubscribed from ${row.feed.title}.`;
    onFeedsChanged();
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
                  <li class="inset-row feed-row">
                    <h4 class="w-full min-w-0 font-semibold break-words">{row.feed.title}</h4>
                    {#if !row.unsubscribed}
                      <p class="w-full text-ink-2">
                        <span class="font-semibold">{headline(row.feed, now)}.</span>
                        {#if row.feed.state !== "working"}{reason(row.feed.problem)}{/if}
                      </p>
                      <p class="w-full text-meta text-muted">
                        {#if row.feed.state === "working"}Checked just now{:else}{lastWorked(row.feed)}{/if}{#if row.feed.state === "dead"}. Still checked once a day, in case it comes back{/if}.
                      </p>
                    {/if}
                    <p role="status" class={["w-full text-ink", !row.message && "sr-only"]}>{row.message}</p>
                    {#if row.choices.length > 0}
                      <div role="radiogroup" aria-label={`Feeds on ${row.feed.title}'s site`} class="choices inset-group w-full">
                        {#each row.choices as choice (choice.url)}
                          <label class="inset-row check-row flex-nowrap">
                            <input type="radio" name={`new-address-${row.feed.id}`} value={choice.url} bind:group={row.chosen} />
                            <span class="flex min-w-0 flex-col py-1">
                              <span class="break-words">{choice.title}</span>
                              <span class="text-small break-all text-muted">{choice.url}</span>
                            </span>
                            <span aria-hidden="true" class="radio-mark shrink-0"></span>
                          </label>
                        {/each}
                      </div>
                      <div class="actions">
                        <button type="button" class="btn btn-small" onclick={() => ((row.choices = []), (row.message = ""))}>Cancel</button>
                        <button type="button" class="btn-primary" aria-disabled={row.busy} onclick={() => use(row)}>Use this address</button>
                      </div>
                    {:else if row.unsubscribed}
                      <div class="actions">
                        <button type="button" class="btn btn-small" aria-disabled={row.busy} onclick={() => !row.busy && undo(row)}>Undo</button>
                      </div>
                    {:else}
                      <div class="actions">
                        <button type="button" class="btn btn-small" aria-disabled={row.busy} aria-label={`Retry ${row.feed.title}`} onclick={() => !row.busy && tryAgain(row)}>Retry</button>
                        <button type="button" class="btn btn-small" aria-disabled={row.busy} aria-label={`Find new address for ${row.feed.title}`} onclick={() => !row.busy && find(row)}>Find new address</button>
                        <button
                          type="button"
                          class="btn-danger text-small"
                          title="Stops following this feed and removes its articles; starred ones stay. You can undo it straight afterwards."
                          aria-label={`Unsubscribe from ${row.feed.title}`}
                          aria-describedby="health-unsubscribe-help"
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
  .actions > .btn-danger {
    margin-left: 0;
  }
  /* Find new address's choices sit in the feed's block, on the page's own color so they stand apart. */
  .choices {
    --group: var(--paper);
    margin-top: 0.25rem;
  }
</style>
