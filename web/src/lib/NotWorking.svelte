<!--
  Who isn't working, at the top of Everyone you follow (SPEC section 15,
  decision 0186), worst first: "Not working" (a week of "not found", or
  three weeks of failing), then "Having trouble". The group's name says
  which, in words, so no status color is needed. Each is a card: their name,
  one sentence on what went wrong, then Find new address and Unsubscribe
  under a rule. nine turtles keeps checking by itself, so there's no Retry.
  Nothing moves on its own: a feed that works again after Find new address
  stays where it is, saying so, until the page is opened again. With nothing
  to list, it shows nothing.
-->
<script lang="ts">
  import { tick } from "svelte";
  import NewAddress from "./NewAddress.svelte";
  import { refused, resubscribe, unsubscribe } from "./feeds";
  import { headline, listSick, reason, type Sick } from "./health";

  let {
    onFeedsChanged,
  }: {
    /** A feed was unsubscribed from, brought back or moved: the sidebar and the list below reload. */
    onFeedsChanged: () => void;
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

  $effect(() => {
    listSick()
      .then((feeds) => {
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

  let groups = $derived([
    { id: "dead", name: "Not working", rows: (rows ?? []).filter((row) => row.group === "dead") },
    { id: "trouble", name: "Having trouble", rows: (rows ?? []).filter((row) => row.group === "trouble") },
  ]);

  /** Find new address: what the site names shows in the feed's block (NewAddress.svelte). */
  function find(row: Row) {
    row.message = "";
    row.finder?.find();
  }

  async function moved(row: Row, feed: Sick) {
    row.feed = feed;
    onFeedsChanged();
    await focusIn(row, "find");
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

<span id="health-unsubscribe-help" class="sr-only">Removes their articles; starred ones stay. You can undo it straight afterwards.</span>
{#if failed}
  <p role="status" class="text-ink-2">Who isn't working couldn't be checked. Try again in a moment.</p>
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
                  <span class="font-semibold">{headline(row.feed)}.</span>
                  {#if row.feed.state !== "working"}{reason(row.feed.problem)}{/if}
                </p>
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
                  <button
                    type="button"
                    class="btn-danger"
                    title="Stops following them and removes their articles; starred ones stay. You can undo it straight afterwards."
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
          <p class="inset-foot">Nothing has come through from these for weeks. They may have moved, or stopped writing.</p>
        {:else}
          <p class="inset-foot">Most come back on their own; nine turtles keeps trying.</p>
        {/if}
      </section>
    {/if}
  {/each}
{/if}

<style>
  /*
    Each is a card a tone off the page (12px corners, 16px by 18px inside,
    12px apart): their name, one sentence on what went wrong, then the
    actions under a hairline. On a narrow card Find new address fills its
    row and Unsubscribe takes a line of its own.
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
  /* Unsubscribe, in the destructive red words, at the right end. */
  .actions > .btn-danger {
    margin-right: -0.5rem;
    margin-left: auto;
  }
  @container card (width < 24rem) {
    .actions > .btn-primary {
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
