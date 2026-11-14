<!--
  Who isn't working, at the top of Everyone you follow (SPEC section 15,
  decision 0186), worst first: "Not working" (a week of "not found", or
  three weeks of failing), then "Having trouble". The group's name says
  which, in words, so no status color is needed. Each group is one grouped
  list, and each of its rows is calm (decision 0268): the person or
  publication icon, their name, one sentence on what went wrong, then what
  can be done as plain underlined words: Find new address, Write to them (a
  person who may not know) and Unsubscribe. nine turtles keeps checking by
  itself, so there's no Retry. Nothing moves on its own: a feed that works
  again after Find new address stays where it is, saying so and offering
  nothing more, until the page is opened again. With nothing to list, it
  shows nothing.
-->
<script lang="ts">
  import Dated from "./Dated.svelte";
  import { onMount, tick } from "svelte";
  import Icon from "./Icon.svelte";
  import NewAddress from "./NewAddress.svelte";
  import LoadFailed from "./LoadFailed.svelte";
  import { plainSourceName, refused, resubscribe, undoRefused, unsubscribe } from "./feeds";
  import { UNDONE } from "./messages";
  import { headline, listSick, reason, youTubeRefusing, type Sick } from "./health";
  import type { LoadedLibrary } from "./library.svelte";
  import WriteBack from "./WriteBack.svelte";
  import { writesBack } from "./writeBack";

  let {
    onFeedsChanged,
    library,
  }: {
    /** A feed was unsubscribed from, brought back or moved: the sidebar and the list below reload. */
    onFeedsChanged: () => void;
    /** For Write to on a person's row (decision 0212): they may not know their feed stopped. */
    library: LoadedLibrary;
  } = $props();

  /** A person, not a publication: someone to write to (decision 0192). */
  const aPerson = (feed: Sick) => writesBack(library.feeds?.find((each) => each.id === feed.id));
  /** Their name as the sidebar shows it, for "Ines Duarte may not know." */
  const plainName = (feed: Sick) => plainSourceName(library.shownAs(library.feeds?.find((each) => each.id === feed.id))?.title ?? feed.title);

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

  /** Lists who isn't working: when the page opens, and again after the list below unsubscribes, moves or undoes. */
  export function reload() {
    listSick()
      .then((feeds) => {
        failed = false;
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
  }

  onMount(reload);

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

  /** Moved: once it works again its row offers nothing more, so the keyboard rests on its name. */
  async function moved(row: Row, feed: Sick) {
    row.feed = feed;
    onFeedsChanged();
    await focusIn(row, feed.state === "working" ? "name" : "find");
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
      row.message = undoRefused(refusal, "feed");
      return;
    }
    row.unsubscribed = false;
    row.message = UNDONE;
    onFeedsChanged();
    await focusIn(row, "unsubscribe");
  }
</script>

<span id="health-unsubscribe-help" class="sr-only">Removes their articles; starred ones stay. You can undo it straight afterwards.</span>
{#if failed}
  <LoadFailed words="Who isn't working couldn't be checked." heading="your-feeds-heading" onRetry={() => ((failed = false), reload())} />
{:else if rows}
  {#each groups as group (group.id)}
    {#if group.rows.length > 0}
      <section aria-labelledby={`health-${group.id}`}>
        <h3 id={`health-${group.id}`} class="inset-head">{group.name}</h3>
        <ul class="inset-group">
          {#each group.rows as row (row.key)}
            {@const person = aPerson(row.feed)}
            <li id={`health-feed-${row.feed.id}`} class={["inset-row sick", row.choosing && "asking"]}>
              <!-- Who it is, at a glance: the two icons Add asks with. One that could still be either is kept with publications, so it shows theirs. -->
              <span class="kind text-muted" title={person ? "A person" : "A publication"}><Icon name={person ? "person" : "newspaper"} /></span>
              <div class="about">
                <h4 class="sick-name font-semibold" tabindex="-1" data-focus="name"><span class="sr-only">{person ? "Person" : "Publication"}:{" "}</span>{row.feed.title}</h4>
                {#if !row.unsubscribed}
                  <p class="what mt-1 text-ink-2">
                    <Dated text={`${headline(row.feed)}.`} />
                    {#if row.feed.state !== "working"}{reason(row.feed.problem, row.feed.youtube)}{/if}
                    {#if row.feed.state === "dead" && person && !youTubeRefusing(row.feed)}{plainName(row.feed)} may not know.{/if}
                  </p>
                {/if}
                <p role="status" class={["status", !row.message && "sr-only"]}>{row.message}</p>
                {#if row.unsubscribed}
                  <div class="actions flex flex-wrap items-center">
                    <button type="button" class="text-link text-ui" data-focus="undo" aria-label={`Undo unsubscribing from ${row.feed.title}`} aria-disabled={row.busy} onclick={() => !row.busy && undo(row)}>Undo</button>
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
                  {#if row.feed.state !== "working"}
                    <div class="actions flex flex-wrap items-center" hidden={row.choosing}>
                      <button type="button" class="text-link text-ui" data-focus="find" aria-disabled={row.busy} aria-label={`Find new address for ${row.feed.title}`} onclick={() => !row.busy && find(row)}>Find new address</button>
                      <!-- They may not know their feed stopped: Write to them, as on their page (decision 0212). Not when it's
                           YouTube turning nine turtles away, which they can't fix (decision 0272). -->
                      {#if row.feed.state === "dead" && person && !youTubeRefusing(row.feed)}<WriteBack feedId={row.feed.id} {library} quiet />{/if}
                      <button
                        type="button"
                        class="text-link text-ui text-danger"
                        title="Stops following them and removes their articles; starred ones stay. You can undo it straight afterwards."
                        aria-label={`Unsubscribe from ${row.feed.title}`}
                        aria-describedby="health-unsubscribe-help"
                        data-focus="unsubscribe"
                        aria-disabled={row.busy}
                        onclick={() => !row.busy && leave(row)}>Unsubscribe</button
                      >
                    </div>
                  {/if}
                {/if}
              </div>
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
    Each group is one grouped list (12px corners, a tone off the page), and
    each row (a grouped list's row, so parted by its hairline, inset from the
    left) has 16px inside: the icon, then their name, the sentence and the
    row's plain links, all on the name's left edge.
  */
  .sick {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0 0.5rem;
    align-items: start;
    padding: 1rem 1rem 0.25rem;
  }
  /* Find new address's question or choice ends the row with buttons of their own: the row's full 16px under them. */
  .sick.asking {
    padding-bottom: 1rem;
  }
  /* The icon sits on the name's line, in the muted grey: the name leads. */
  .kind {
    display: flex;
    align-items: center;
    height: calc(var(--text-base) * 1.35);
  }
  .about {
    min-width: 0;
  }
  /* On the row's tone, a new address's choices sit on the page's own color, so they stand apart from it. */
  .sick :global(.new-address .feeds-named) {
    --group: var(--paper);
  }
  /* What Find new address found sits 8px under the sentence; a row that says what happened and offers nothing more (working again) keeps the 16px under its words. */
  .about > :global(.new-address.showing) {
    margin-top: 0.5rem;
  }
  .about > :global(.new-address.showing:last-child) {
    padding-bottom: 0.75rem;
  }
  .sick-name {
    font-size: var(--text-base);
    line-height: 1.35;
    overflow-wrap: anywhere;
    outline: none;
  }
  .what {
    line-height: 1.5;
  }
  .status:not(.sr-only) {
    margin-top: 0.5rem;
    line-height: 1.5;
  }
  /* What can be done, as plain underlined words side by side (Unsubscribe in the destructive red), each 44px tall to press; on a narrow row they wrap. */
  .actions {
    column-gap: 1.5rem;
  }
</style>
