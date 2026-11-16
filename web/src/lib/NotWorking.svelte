<!--
  Who isn't working, at the top of Everyone you follow (SPEC section 15,
  decisions 0186 and 0279), worst first: "Not working" (a week of "not
  found", or three weeks of failing), then "Having trouble". The group's name
  says which, in words, so no status color is needed, and one line under it
  says what it means and what to do. Then the feeds, gathered by what went
  wrong, said once in a few plain words ("The site doesn't answer") over a
  grouped list of them; the reason whose feed has failed longest comes first.
  Each feed is one line: their name, the day nothing has come through since,
  and ›. It opens their page, which has what can be done: Find new address,
  Write to and, in their settings, Unsubscribe. nine turtles keeps checking
  by itself, so there's no Retry. With nothing to list, it shows nothing.
-->
<script lang="ts">
  import Dated from "./Dated.svelte";
  import { onMount } from "svelte";
  import Icon from "./Icon.svelte";
  import LoadFailed from "./LoadFailed.svelte";
  import { failingDay, listSick, reason, type Sick } from "./health";
  import { pathFor } from "./router";

  let {
    onOpen,
  }: {
    /** A row was chosen: their page opens. */
    onOpen: (event: MouseEvent, id: number) => void;
  } = $props();

  let feeds: Sick[] | undefined = $state();
  let failed = $state(false);

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

  /** The feeds, gathered by what went wrong, in the order the server lists them (longest failing first). */
  function byReason(sick: Sick[]): { reason: string; feeds: Sick[] }[] {
    const gathered = new Map<string, Sick[]>();
    for (const feed of sick) {
      const why = reason(feed);
      gathered.set(why, [...(gathered.get(why) ?? []), feed]);
    }
    return [...gathered].map(([why, feeds]) => ({ reason: why, feeds }));
  }

  let groups = $derived([
    {
      id: "dead",
      name: "Not working",
      reasons: byReason((feeds ?? []).filter((feed) => feed.state === "dead")),
      how: "Nothing has come through from these for weeks. Open one to find its new address, or to unsubscribe.",
    },
    {
      id: "trouble",
      name: "Having trouble",
      reasons: byReason((feeds ?? []).filter((feed) => feed.state !== "dead")),
      how: "Most come back on their own; nine turtles keeps trying.",
    },
  ]);
</script>

{#if failed}
  <LoadFailed words="Who isn't working couldn't be checked." heading="your-feeds-heading" onRetry={() => ((failed = false), reload())} />
{:else}
  {#each groups as group (group.id)}
    {#if group.reasons.length > 0}
      <section aria-labelledby={`health-${group.id}`} aria-describedby={`health-${group.id}-how`}>
        <h3 id={`health-${group.id}`} class="inset-head">{group.name}</h3>
        <p id={`health-${group.id}-how`} class="inset-foot mt-0">{group.how}</p>
        {#each group.reasons as each (each.reason)}
          <h4 class="inset-foot reason">{each.reason}</h4>
          <ul class="inset-group">
            {#each each.feeds as feed (feed.id)}
              {@const day = failingDay(feed)}
              <li class="contents">
                <a href={pathFor({ kind: "about", id: feed.id })} onclick={(event) => onOpen(event, feed.id)} class="inset-row inset-action">
                  <span class="min-w-0 flex-1 py-2 break-words">{feed.title}</span>
                  {#if day}<span class="text-meta text-muted shrink-0"><span class="sr-only">Nothing since{" "}</span><Dated text={day} /></span>{/if}
                  <span class="row-glyph"><Icon name="chevron-right" /></span>
                </a>
              </li>
            {/each}
          </ul>
        {/each}
      </section>
    {/if}
  {/each}
{/if}

<style>
  /* What went wrong, over the feeds it happened to: the group's quiet words, a step apart from the list before. */
  .reason {
    margin-top: 1rem;
    margin-bottom: 0.5rem;
    font-weight: inherit;
  }
</style>
