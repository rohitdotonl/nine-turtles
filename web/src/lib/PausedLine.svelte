<!--
  A paused source says so where the reader already looks (SPEC section 15,
  decision 0239): one quiet line in the second ink above their list and on
  their page, "Paused since 23 Oct. Their new articles arrive already read.",
  and Resume, which unticks Pause for a while as Edit does. No color, no
  badge, no count. For a person with several sources, each paused one is
  named. Resumed, the line says so until the reader goes elsewhere.
-->
<script lang="ts">
  import Dated from "./Dated.svelte";
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import { editFeed } from "./feeds";
  import type { LoadedLibrary } from "./library.svelte";
  import { placeShownAs } from "./people";
  import type { Feed } from "./shapes";
  import { pausedSince } from "./times";

  let {
    places,
    library,
    onResumed,
    class: look = "",
  }: {
    /** The person's sources (one, for a source on its own). */
    places: Feed[];
    library: LoadedLibrary;
    /** Resumed: their list refreshes, so the newest of the pause come back. */
    onResumed: () => void;
    /** Room around the line, as the place sets it. */
    class?: string;
  } = $props();

  let paused = $derived(places.filter((place) => place.pausedAt != null));
  let busy = $state(false);
  let message = $state("");
  let resumed = $state("");
  let said: HTMLParagraphElement | undefined = $state();

  async function resume(place: Feed) {
    if (busy) return;
    busy = true;
    message = "";
    const refusal = await editFeed(place.id, { paused: false });
    if (refusal) {
      busy = false;
      message = "The pause couldn't be ended. Try again in a moment.";
      return;
    }
    await library.loadFeeds();
    busy = false;
    resumed = places.length > 1 ? `Resumed ${placeShownAs(place)}.` : "Resumed.";
    onResumed();
    // The button is gone: the keyboard stays on the line that says what happened.
    await tick();
    said?.focus();
  }
</script>

{#if paused.length > 0 || resumed || message}
  <div class={["paused flex flex-col gap-1", look]}>
    {#each paused as place (place.id)}
      <p class="text-meta text-ink-2">
        {#if places.length > 1}<span class="text-ink">{placeShownAs(place)}</span>:{/if}
        <Dated text={pausedSince(place.pausedAt ?? 0, new Date(), "since")} />
        {places.length > 1 ? "Its" : "Their"} new articles arrive already read.
        <button type="button" class="text-link resume" aria-disabled={busy} onclick={() => resume(place)}
          >Resume<span class="sr-only">{places.length > 1 ? ` ${placeShownAs(place)}` : ""}</span></button
        >
      </p>
    {/each}
    {#if resumed}<p bind:this={said} tabindex="-1" role="status" class="text-meta text-ink-2">{resumed}</p>{/if}
    {#if message}
      <p role="status" class="flex items-start gap-2 text-meta text-danger"><span class="mt-px shrink-0"><Icon name="alert" /></span>{message}</p>
    {/if}
  </div>
{/if}

<style>
  .paused {
    line-height: 1.4;
  }
  /* The button follows the sentence on its line, in the same small size, with the second ink's quiet (as FailingLine's). */
  .resume {
    color: var(--ink-2);
  }
</style>
