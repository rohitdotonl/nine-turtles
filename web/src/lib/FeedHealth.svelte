<!--
  The feed health page (SPEC section 17), opened from Settings › Feeds. It
  lists only the feeds that aren't working, worst first: "Not working" (dead:
  a week of "not found", or three weeks of failing), then "Having trouble".
  The group's name says which, in words, so no status color is needed.
  Each feed is a card: its name, one sentence on what went wrong, the address
  tried and when it last worked, then Find new address, Retry and
  Unsubscribe under a rule. Nothing moves on its own: a feed that works again
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
    /** The row's own identity and group, fixed when the page opens: a moved feed may change number and state, but stays put. */
    key: number;
    group: "dead" | "trouble";
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
        rows = feeds.map((feed, key) => ({
          key,
          group: feed.state === "dead" ? "dead" : "trouble",
          feed,
          message: "",
          busy: false,
          choosing: false,
          unsubscribed: false,
        }));
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

  /** The "Last worked" value: when, then whether it's still checked and how often it posts, as sentences after it. */
  function worked(feed: Sick): string {
    const parts = [feed.state === "working" ? "Just now" : lastWorked(feed)];
    if (feed.state === "dead") parts.push("Still checked once a day, in case it comes back");
    if (feed.frequency) parts.push(feed.frequency.replace(/\.$/, ""));
    return parts.length > 1 ? `${parts.join(". ")}.` : parts[0]!;
  }

  let groups = $derived([
    { id: "dead", name: "Not working", rows: (rows ?? []).filter((row) => row.group === "dead") },
    { id: "trouble", name: "Having trouble", rows: (rows ?? []).filter((row) => row.group === "trouble") },
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
              <ul class="cards">
                {#each group.rows as row (row.key)}
                  <li id={`health-feed-${row.feed.id}`} class="card">
                    <h4 class="card-name">{row.feed.title}</h4>
                    {#if !row.unsubscribed}
                      <p class="what text-ink-2">
                        <span class="font-semibold">{headline(row.feed, now)}.</span>
                        {#if row.feed.state !== "working"}{reason(row.feed.problem)}{/if}
                      </p>
                      <dl class="facts">
                        <dt>Address</dt>
                        <!-- The address it tried, broken anywhere so a long one never runs off a phone. -->
                        <dd class="tried">{row.feed.url}</dd>
                        <dt>Last worked</dt>
                        <dd>{worked(row.feed)}</dd>
                      </dl>
                    {/if}
                    <p role="status" class={["status text-ink", !row.message && "sr-only"]}>{row.message}</p>
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
                        <button type="button" class="btn-primary" data-focus="find" aria-disabled={row.busy} aria-label={`Find new address for ${row.feed.title}`} onclick={() => !row.busy && find(row)}>Find new address</button>
                        <button type="button" class="btn retry" data-focus="retry" aria-disabled={row.busy} aria-label={`Retry ${row.feed.title}`} onclick={() => !row.busy && tryAgain(row)}>Retry</button>
                        <button
                          type="button"
                          class="btn-danger"
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
  /*
    Each feed is a card a tone off the page (12px corners, 16px by 18px
    inside, 12px apart): its name, one sentence on what went wrong, a short
    list of the address tried and when it last worked, then its actions under
    a hairline. On a narrow card the two buttons share their row and
    Unsubscribe takes a line of its own.
  */
  .cards {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .card {
    container: card / inline-size;
    min-width: 0;
    padding: 1rem 1.125rem;
    border-radius: 0.75rem;
    background-color: var(--group, var(--list));
    color: var(--ink);
    font-size: var(--text-ui);
  }
  .card-name {
    font-size: 1.02rem;
    font-weight: 600;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }
  .what {
    margin-top: 0.25rem;
    line-height: 1.5;
  }
  .facts {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.25rem 0.875rem;
    margin-top: 0.75rem;
    font-size: 0.84rem;
    line-height: 1.45;
  }
  .facts > dt {
    color: var(--muted);
  }
  .facts > dd {
    min-width: 0;
    color: var(--ink-2);
  }
  .tried {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    overflow-wrap: anywhere;
  }
  .status:not(.sr-only) {
    margin-top: 0.75rem;
    line-height: 1.5;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin-top: 0.875rem;
    padding-top: 0.875rem;
    border-top: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
  }
  .actions[hidden] {
    display: none;
  }
  /* Retry: a quiet filled button in the segmented controls' track grey, so it stands out from the grey card. */
  .actions > .retry {
    border-color: transparent;
    background-color: var(--tone);
    color: var(--ink);
  }
  @media (hover: hover) {
    .actions > .retry:hover {
      background-color: color-mix(in srgb, var(--ink) 12%, transparent);
    }
  }
  /* Unsubscribe, in the destructive red words, at the right end. */
  .actions > .btn-danger {
    margin-right: -0.5rem;
    margin-left: auto;
  }
  @container card (width < 24rem) {
    .actions > .btn-primary,
    .actions > .retry {
      flex: 1 1 0;
      min-width: 0;
      padding-inline: 0.5rem;
      line-height: 1.25;
      text-align: center;
      white-space: normal;
    }
    .actions > .btn-danger {
      justify-content: center;
      width: 100%;
      margin: 0;
    }
  }
</style>
