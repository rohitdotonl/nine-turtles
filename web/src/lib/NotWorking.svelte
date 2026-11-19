<!--
  Who isn't working, at the top of Everyone you follow (SPEC section 15,
  decisions 0186 and 0279): one quiet row, "8 feeds aren't working", with
  what went wrong in a few words under it ("Feed gone: 4 · Site not
  answering: 3 · 3 having trouble"). Pressed, it shows them in place, alike
  ones together, those not working before those having trouble: the icon for
  what went wrong, their name, the same few words, and ›. Each opens their
  page, which leads with what went wrong and what can be done (NotWorkingBox).
  nine turtles keeps checking by itself, so there's no Retry. With nothing to
  list, it shows nothing.
-->
<script lang="ts" module>
  /** Opened, it stays open for the visit: back from someone's page, the rest are still there to see to. */
  let leftOpen = false;
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "./Icon.svelte";
  import LoadFailed from "./LoadFailed.svelte";
  import { connection, whenBack } from "./connection.svelte";
  import { byReason, listSick, reason, type Sick } from "./health";
  import { addressFor } from "./router";

  let {
    onOpen,
  }: {
    /** A row was chosen: their page opens. */
    onOpen: (event: MouseEvent, id: number) => void;
  } = $props();

  let feeds: Sick[] | undefined = $state();
  let failed = $state(false);
  let showing = $state(leftOpen);

  /** Lists who isn't working: when the page opens, and again after the list below unsubscribes, moves or undoes. */
  export function reload(): Promise<void> {
    return listSick()
      .then((sick) => {
        failed = false;
        feeds = sick;
      })
      .catch(() => void (failed = true));
  }

  let first: Promise<void> | undefined;
  onMount(() => void (first = reload()));
  // Couldn't check for want of a connection: checked again once it's back; meanwhile the page's own line says why (YourFeeds, decision 0312).
  $effect(() => whenBack(() => void (failed && reload())));
  /** Once who isn't working is first listed, so the keyboard can go back to a row in it. */
  export const listed = () => first;

  let dead = $derived(byReason((feeds ?? []).filter((feed) => feed.state === "dead")));
  let troubled = $derived(byReason((feeds ?? []).filter((feed) => feed.state !== "dead")));
  /** What went wrong, how many of each, in the order they're listed: "Feed gone: 4 · Site not answering: 3 · 3 having trouble". */
  let summary = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const feed of dead) {
      const words = reason(feed).words;
      counts.set(words, (counts.get(words) ?? 0) + 1);
    }
    // Each reason as its row says it, then how many: "Feed gone: 4", never "4 feed gone" (consistency check, round 2).
    const parts = [...counts].map(([words, count]) => `${words}: ${count}`);
    if (troubled.length > 0) parts.push(dead.length > 0 ? `${troubled.length} having trouble` : "Usually back soon");
    return parts.join(" · ");
  });
</script>

{#if failed && connection.offline}
  <!-- Nothing: Everyone you follow says once, calmly, that nine turtles can't be reached. -->
{:else if failed}
  <LoadFailed words="Who isn't working couldn't be checked." heading="your-feeds-heading" onRetry={() => ((failed = false), reload())} />
{:else if dead.length + troubled.length > 0}
  <section aria-labelledby="health-summary">
    <ul class="inset-group">
      <li class="contents">
        <button type="button" id="health-summary" class="inset-row inset-action two" aria-expanded={showing} onclick={() => (showing = leftOpen = !showing)}>
          <span class="why"><Icon name="alert" /></span>
          <span class="flex min-w-0 flex-1 flex-col py-2">
            <span>{dead.length > 0 ? `${dead.length} ${dead.length === 1 ? "feed isn't" : "feeds aren't"} working` : `${troubled.length} having trouble`}</span>
            <span class="text-meta text-muted wrap-anywhere">{summary}</span>
          </span>
          <span class="row-glyph"><Icon name={showing ? "chevron-up" : "chevron-down"} /></span>
        </button>
      </li>
      {#if showing}
        {#each [...dead, ...troubled] as feed (feed.id)}
          {@const why = reason(feed)}
          <li class="contents">
            <a href={addressFor({ kind: "about", id: feed.id })} onclick={(event) => onOpen(event, feed.id)} class="inset-row inset-action">
              <span class="why"><Icon name={why.icon} /></span>
              <span class="min-w-0 flex-1 py-2 wrap-anywhere">{feed.title}</span>
              <span class="said text-meta text-muted text-right">{why.words}</span>
              <span class="row-glyph"><Icon name="chevron-right" /></span>
            </a>
          </li>
        {/each}
      {/if}
    </ul>
    {#if showing}<p class="inset-foot">Open one to fix it, write to them or unsubscribe.</p>{/if}
  </section>
{/if}

<style>
  /* What went wrong, at a glance: its icon in the second ink, on the row's first line. */
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
  /* The summary is two lines: how many, then what went wrong. */
  .two {
    min-height: 3.5rem;
  }
</style>
