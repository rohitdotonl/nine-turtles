<!--
  A failing feed says so where the reader already is (decision 0106): one
  quiet line in the second ink, "This feed hasn't worked since 12 October.",
  and a text button that runs Find new address (NewAddress.svelte), above
  the feed's own list (SPEC section 6) and in Edit feed (section 15). Only
  while the feed health page would list it as not working; nothing is
  fetched until the reader presses the button (decision 0016). Once the feed
  has moved, the line says so, and stays until the reader leaves.
-->
<script lang="ts">
  import { tick, untrack } from "svelte";
  import NewAddress from "./NewAddress.svelte";
  import type { Feed } from "./feeds";
  import { brokenSince, type Sick } from "./health";

  let {
    feed,
    label,
    onMoved,
    class: look = "",
  }: {
    feed: Feed;
    /** Room around the line, as the place sets it. */
    class?: string;
    /** The button's words: "Find its new address" above the list, "Find new address" in Edit feed. */
    label: string;
    /** The feed moved: the place reloads its feeds and puts the keyboard somewhere sensible. */
    onMoved: (feed: Sick) => void;
  } = $props();

  let finder: NewAddress | undefined = $state();
  let button: HTMLButtonElement | undefined = $state();
  let choosing = $state(false);
  let busy = $state(false);
  /**
   * The move just made, from one feed number to another (they differ when
   * others follow the old address too, decision 0071): the line goes on
   * saying so on the new one, until the reader goes to another feed.
   */
  let move: { from: number; to: number } | undefined = $state();
  let moved = $derived(move !== undefined);
  let place = $derived(move ? move.from : feed.id);

  // Another feed: the line starts afresh. A new copy of the same feed (after
  // Refresh or Catch me up) changes nothing, so an open question stays alone.
  let shownFor = untrack(() => feed.id);
  $effect.pre(() => {
    const id = feed.id;
    untrack(() => {
      if (id === shownFor) return;
      shownFor = id;
      if (move && id !== move.from && id !== move.to) move = undefined;
      choosing = false;
    });
  });
</script>

{#key place}
{#if feed.failingSince != null || moved}
  <div class={["failing", look]}>
    {#if !moved}
      <p class="text-small text-ink-2">
        {brokenSince(feed.failingSince ?? 0)}
        {#if !choosing}
          <button
            bind:this={button}
            type="button"
            class="text-link find"
            aria-disabled={busy}
            onclick={() => finder?.find()}>{label}</button
          >
        {/if}
      </p>
    {/if}
    <NewAddress
      bind:this={finder}
      bind:open={choosing}
      bind:busy
      {feed}
      onMoved={(after) => {
        move = { from: feed.id, to: after.id };
        onMoved(after);
      }}
      onClosed={async () => {
        await tick();
        button?.focus();
      }}
    />
  </div>
{/if}
{/key}

<style>
  .failing {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    line-height: 1.4;
  }
  /* The button follows the sentence on its line, in the same small size, with the second ink's quiet. */
  .find {
    color: var(--ink-2);
  }
</style>
