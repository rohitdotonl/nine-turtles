<!--
  A source that isn't working, at the top of their page (SPEC section 15,
  decision 0279): one box, so what went wrong and what can be done are in one
  place. First the icon and a few words with since when ("Feed gone since
  24 Oct"), then one sentence on what it may mean, then what can be done, the
  likeliest first (`fixFirst`): Find new address (NewAddress.svelte), Write
  to them (a person; "They may not know." when nothing has come for a week
  or more), and Unsubscribe in oxblood words (someone with this one source;
  one with several leaves a source in their settings). Only while Everyone
  you follow lists it; nothing is fetched from the site until the reader
  presses Find new address (decision 0016). Once it has moved, the box says
  so, and stays until the reader leaves.
-->
<script lang="ts">
  import { tick, untrack } from "svelte";
  import Icon from "./Icon.svelte";
  import NewAddress from "./NewAddress.svelte";
  import { explain, failingFor, fixFirst, listSick, reason, youTubeRefusing, type Sick } from "./health";
  import type { LoadedLibrary } from "./library.svelte";
  import type { Feed } from "./shapes";
  import WriteBack from "./WriteBack.svelte";

  let {
    feed,
    subject,
    person,
    library,
    onMoved,
    onUnsubscribe,
  }: {
    feed: Feed;
    /** The source's name, when they have more than one: "Garden Letters: Feed gone since 24 Oct". */
    subject?: string;
    /** A person, not a publication: someone to write to (decision 0192). */
    person: boolean;
    library: LoadedLibrary;
    onMoved: (feed: Sick) => void;
    /** Only for someone with this one source: unsubscribing leaves all of them. */
    onUnsubscribe?: () => Promise<string | undefined>;
  } = $props();

  /** What went wrong, as Everyone you follow has it: only that list knows. */
  let sick: Sick | undefined = $state();
  let finder: NewAddress | undefined = $state();
  let findButton: HTMLButtonElement | undefined = $state();
  let choosing = $state(false);
  let busy = $state(false);
  let message = $state("");
  /** The move just made, from one number to another (decision 0071): the box goes on saying so on the new one. */
  let move: { from: number; to: number } | undefined = $state();

  // Another source: the box starts afresh, and learns what went wrong with it.
  let shownFor: number | undefined;
  $effect.pre(() => {
    const id = feed.id;
    const failing = feed.failingSince != null;
    untrack(() => {
      if (id === shownFor) return;
      shownFor = id;
      if (move && id !== move.from && id !== move.to) move = undefined;
      if (move) return;
      [sick, choosing, message] = [undefined, false, ""];
      if (failing)
        listSick()
          .then((all) => {
            if (feed.id === id) sick = all.find((each) => each.id === id);
          })
          .catch(() => undefined);
    });
  });

  let why = $derived(sick && reason(sick));
  let first = $derived(sick ? fixFirst(sick) : "find");

  async function leave() {
    if (busy || !onUnsubscribe) return;
    busy = true;
    message = (await onUnsubscribe()) ?? "";
    busy = false;
  }
</script>

{#snippet find()}
  <button
    bind:this={findButton}
    type="button"
    class={first === "find" ? "btn btn-small" : "text-link text-ui"}
    aria-disabled={busy}
    onclick={() => !busy && finder?.find()}>Find new address</button
  >
{/snippet}

{#if move || (sick && why && feed.failingSince != null)}
  <div class="box" role="group" aria-label="Not working">
    {#if !move && sick && why}
      <p class="title font-semibold">
        <span class="why"><Icon name={why.icon} /></span>
        <span>{subject ? `${subject}: ` : ""}{why.words} {failingFor(sick)}</span>
      </p>
      <p class="what text-meta text-ink-2">
        {explain(sick.problem, sick.youtube)}
        {#if person && sick.state === "dead" && !youTubeRefusing(sick)}They may not know.{/if}
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
        findButton?.focus();
      }}
    />
    {#if !move}
      <div class="actions flex flex-wrap items-center" hidden={choosing}>
        {#if first === "find" || !person}{@render find()}{/if}
        {#if person}<WriteBack feedId={feed.id} {library} quiet />{/if}
        {#if first === "write" && person}{@render find()}{/if}
        {#if onUnsubscribe}
          <button
            type="button"
            class="text-link text-ui text-danger"
            title="Stops following them and removes their articles; starred ones stay. You can undo it straight afterwards."
            aria-disabled={busy}
            onclick={leave}>Unsubscribe</button
          >
        {/if}
      </div>
      <p role="status" class={["text-meta text-danger", !message && "sr-only"]}>{message}</p>
    {/if}
  </div>
{/if}

<style>
  /* One box a tone off the page (the grouped lists' grey, 12px corners), 16px inside. */
  .box {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 1rem 1rem 0.5rem;
    border-radius: var(--radius-hold);
    background-color: var(--list);
  }
  .title {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    line-height: 1.35;
  }
  .why {
    display: flex;
    color: var(--ink-2);
  }
  .what {
    line-height: 1.5;
  }
  /* On the box's tone, a new address's choices sit on the page's own color, so they stand apart from it. */
  .box :global(.new-address .feeds-named) {
    --group: var(--paper);
  }
  /* What can be done, side by side, each 44px tall to press; on a narrow screen they wrap. */
  .actions {
    column-gap: 1.5rem;
    row-gap: 0.5rem;
    margin-top: 0.5rem;
  }
</style>
