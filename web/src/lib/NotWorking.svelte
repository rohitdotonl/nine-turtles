<!--
  Who isn't working, at the top of Everyone you follow (SPEC section 15,
  decisions 0186 and 0279). PREVIEW: two looks to choose from, by port
  (:8081 shows look 4, anything else look 2); the one not chosen goes before
  shipping.

  Look 2, a row per reason: under "Not working", one grouped list, a row for
  each thing that went wrong, its icon, its words and how many ("Feed gone ·
  4"), and under them who. A row for one opens their page; a row for several
  shows them in place, each opening their page. Having trouble is one more
  row, "3 more having trouble", showing its own rows in place.

  Look 4, one quiet row: "8 feeds aren't working", what went wrong in a few
  words under it, showing them all in place: the icon, their name and what
  went wrong, each opening their page.

  Their page has what can be done: Find new address, Write to and, in their
  settings, Unsubscribe. nine turtles keeps checking by itself, so there's
  no Retry. With nothing to list, it shows nothing.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "./Icon.svelte";
  import LoadFailed from "./LoadFailed.svelte";
  import { byReason, listSick, reason, type Reason, type Sick } from "./health";
  import { pathFor } from "./router";

  let {
    onOpen,
  }: {
    /** A row was chosen: their page opens. */
    onOpen: (event: MouseEvent, id: number) => void;
  } = $props();

  const look = location.port === "8081" ? 4 : 2;

  let feeds: Sick[] | undefined = $state();
  let failed = $state(false);
  /** What's shown in place: a reason's words, "trouble", or "all". */
  let open: string[] = $state([]);
  const toggle = (what: string) => (open = open.includes(what) ? open.filter((each) => each !== what) : [...open, what]);

  /** Lists who isn't working: when the page opens, and again after the list below unsubscribes, moves or undoes. */
  export function reload() {
    listSick()
      .then((sick) => {
        failed = false;
        feeds = sick;
      })
      .catch(() => (failed = true));
  }

  onMount(reload);

  type Gathered = { why: Reason; feeds: Sick[] };
  /** Alike ones together, each reason where its longest failing feed was. */
  function gather(sick: Sick[]): Gathered[] {
    const gathered = new Map<string, Gathered>();
    for (const feed of byReason(sick)) {
      const why = reason(feed);
      const group = gathered.get(why.words) ?? { why, feeds: [] };
      group.feeds.push(feed);
      gathered.set(why.words, group);
    }
    return [...gathered.values()];
  }

  let dead = $derived(gather((feeds ?? []).filter((feed) => feed.state === "dead")));
  let trouble = $derived(gather((feeds ?? []).filter((feed) => feed.state !== "dead")));
  let deadCount = $derived(dead.reduce((sum, group) => sum + group.feeds.length, 0));
  let troubleCount = $derived(trouble.reduce((sum, group) => sum + group.feeds.length, 0));
  const lower = (words: string) => words.charAt(0).toLowerCase() + words.slice(1);
</script>

<!-- A feed, opening their page: with its icon and words (look 4), or under its reason, its name alone (look 2). -->
{#snippet feedRow(feed: Sick, withWhy: boolean)}
  {@const why = reason(feed)}
  <li class="contents">
    <a href={pathFor({ kind: "about", id: feed.id })} onclick={(event) => onOpen(event, feed.id)} class={["inset-row inset-action", !withWhy && "under"]}>
      {#if withWhy}<span class="why"><Icon name={why.icon} /></span>{/if}
      <span class="min-w-0 flex-1 py-2 break-words">{feed.title}</span>
      {#if withWhy}<span class="said text-meta text-muted text-right">{why.words}</span>{/if}
      <span class="row-glyph"><Icon name="chevron-right" /></span>
    </a>
  </li>
{/snippet}

<!-- Look 2: a reason, how many, and who; one opens their page, several show in place. -->
{#snippet reasonRow(group: Gathered)}
  {@const [only] = group.feeds}
  {@const showing = open.includes(group.why.words)}
  {#snippet inside()}
    <span class="why"><Icon name={group.why.icon} /></span>
    <span class="flex min-w-0 flex-1 flex-col py-2">
      <span>{group.why.words}{#if group.feeds.length > 1}<span class="text-muted">{` · ${group.feeds.length}`}</span>{/if}</span>
      {#if !showing}<span class="text-meta text-muted break-words">{group.feeds.map((feed) => feed.title).join(", ")}</span>{/if}
    </span>
  {/snippet}
  <li class="contents">
    {#if only && group.feeds.length === 1}
      <a href={pathFor({ kind: "about", id: only.id })} onclick={(event) => onOpen(event, only.id)} class="inset-row inset-action two">
        {@render inside()}
        <span class="row-glyph"><Icon name="chevron-right" /></span>
      </a>
    {:else}
      <button type="button" class="inset-row inset-action two" aria-expanded={showing} onclick={() => toggle(group.why.words)}>
        {@render inside()}
        <span class="row-glyph"><Icon name={showing ? "chevron-up" : "chevron-down"} /></span>
      </button>
    {/if}
  </li>
  {#if showing && group.feeds.length > 1}
    {#each group.feeds as feed (feed.id)}{@render feedRow(feed, false)}{/each}
  {/if}
{/snippet}

{#if failed}
  <LoadFailed words="Who isn't working couldn't be checked." heading="your-feeds-heading" onRetry={() => ((failed = false), reload())} />
{:else if look === 2}
  {#if dead.length > 0}
    <section aria-labelledby="health-dead" aria-describedby="health-dead-how">
      <h3 id="health-dead" class="inset-head">Not working</h3>
      <ul class="inset-group">
        {#each dead as group (group.why.words)}{@render reasonRow(group)}{/each}
      </ul>
      <p id="health-dead-how" class="inset-foot">Open one to fix it.</p>
    </section>
  {/if}
  {#if trouble.length > 0}
    {@const showing = open.includes("trouble")}
    <section aria-label="Having trouble">
      <ul class="inset-group">
        <li class="contents">
          <button type="button" class="inset-row inset-action" aria-expanded={showing} onclick={() => toggle("trouble")}>
            <span class="min-w-0 flex-1 py-2 text-left">{troubleCount}{deadCount > 0 ? " more" : ""} having trouble</span>
            <span class="text-meta text-muted shrink-0">Usually back soon</span>
            <span class="row-glyph"><Icon name={showing ? "chevron-up" : "chevron-down"} /></span>
          </button>
        </li>
        {#if showing}
          {#each trouble as group (group.why.words)}{@render reasonRow(group)}{/each}
        {/if}
      </ul>
    </section>
  {/if}
{:else if deadCount + troubleCount > 0}
  {@const showing = open.includes("all")}
  {@const all = [...dead, ...trouble]}
  <section aria-label="Not working">
    <ul class="inset-group">
      <li class="contents">
        <button type="button" class="inset-row inset-action two" aria-expanded={showing} onclick={() => toggle("all")}>
          <span class="why"><Icon name="alert" /></span>
          <span class="flex min-w-0 flex-1 flex-col py-2">
            <span>{deadCount > 0 ? `${deadCount} ${deadCount === 1 ? "feed isn't" : "feeds aren't"} working` : `${troubleCount} having trouble`}</span>
            <span class="text-meta text-muted break-words"
              >{dead.map((group) => `${group.feeds.length} ${lower(group.why.words)}`).join(" · ")}{deadCount > 0 && troubleCount > 0 ? " · " : ""}{deadCount > 0 && troubleCount > 0
                ? `${troubleCount} having trouble`
                : ""}{deadCount === 0 ? "Usually back soon" : ""}</span
            >
          </span>
          <span class="row-glyph"><Icon name={showing ? "chevron-up" : "chevron-down"} /></span>
        </button>
      </li>
      {#if showing}
        {#each all as group, index (index)}
          {#each group.feeds as feed (feed.id)}{@render feedRow(feed, true)}{/each}
        {/each}
      {/if}
    </ul>
    {#if showing}<p class="inset-foot">Open one to fix it.</p>{/if}
  </section>
{/if}

<style>
  /* What went wrong, at a glance: its icon in the second ink, on the first line. */
  .why {
    display: flex;
    align-self: flex-start;
    margin-top: 0.75rem;
    color: var(--ink-2);
  }
  /* Its words sit at the right as a row's own small words do, and give way to a long name on a phone. */
  .said {
    max-width: 45%;
  }
  /* A reason over who it happened to: two lines. */
  .two {
    min-height: 3.5rem;
  }
  /* Who, under their reason once it's open: their names on the reason's words' edge. */
  .under {
    padding-left: calc(1rem + 16px + 1rem);
  }
</style>
