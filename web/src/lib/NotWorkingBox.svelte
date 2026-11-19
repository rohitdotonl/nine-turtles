<!--
  A source that isn't working, at the top of their page (SPEC section 15,
  decision 0279): one box, so what went wrong and what can be done are in one
  place. First the icon and a few words with since when ("Feed gone since
  24 Oct"), then one sentence on what it may mean, then what can be done, the
  likeliest first (`fixFirst`): Find new address (NewAddress.svelte), Write
  to them (a person, in one box only, never when it's YouTube refusing;
  "They may not know." once it's not working), and Unsubscribe in oxblood words (someone with this one source;
  one with several leaves a source in their settings). Only while Everyone
  you follow lists it; nothing is fetched from the site until the reader
  presses Find new address (decision 0016). Their page learns what went
  wrong, once for all their sources (WhoPage). Once it has moved, the box
  says so, and stays until the reader leaves.
-->
<script lang="ts">
  import { tick, untrack } from "svelte";
  import Icon from "./Icon.svelte";
  import NewAddress from "./NewAddress.svelte";
  import { explain, failingFor, fixFirst, reason, youTubeRefusing, type Sick } from "./health";
  import type { LoadedLibrary } from "./library.svelte";
  import type { Feed } from "./shapes";
  import WriteBack from "./WriteBack.svelte";

  let {
    feed,
    sick,
    subject,
    person,
    write,
    library,
    onMoved,
    onUnsubscribe,
  }: {
    feed: Feed;
    /** What went wrong, as Everyone you follow has it: only that list knows. */
    sick: Sick | undefined;
    /** The source's name, when they have more than one: "Garden Letters: Feed gone since 24 Oct". */
    subject?: string;
    /** A person, not a publication, with Write back on: someone to write to (decisions 0192, 0286). */
    person: boolean;
    /** The one box that offers Write to them: one way to write, not two. */
    write: boolean;
    library: LoadedLibrary;
    onMoved: (feed: Sick) => void;
    /** Only for someone with this one source: unsubscribing leaves all of them. */
    onUnsubscribe?: () => Promise<string | undefined>;
  } = $props();

  let finder: NewAddress | undefined = $state();
  let findButton: HTMLButtonElement | undefined = $state();
  let choosing = $state(false);
  let busy = $state(false);
  let message = $state("");
  /** The move just made, from one number to another (decision 0071): the box goes on saying so on the new one. */
  let move: { from: number; to: number } | undefined = $state();

  // Another source: the box starts afresh.
  let shownFor: number | undefined;
  $effect.pre(() => {
    const id = feed.id;
    untrack(() => {
      if (id === shownFor) return;
      shownFor = id;
      if (move && id !== move.from && id !== move.to) move = undefined;
      if (!move) [choosing, message] = [false, ""];
    });
  });

  let why = $derived(sick && reason(sick));
  let first = $derived(sick ? fixFirst(sick) : "wait");
  let writing = $derived(person && write);

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
  <div class="tone-box box" role="group" aria-label="Not working">
    {#if !move && sick && why}
      <p class="tone-box-title font-semibold">
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
      <div class="tone-box-actions" hidden={choosing}>
        {#if first !== "write" || !writing}{@render find()}{/if}
        {#if writing}<WriteBack feedId={feed.id} {library} quiet />{/if}
        {#if first === "write" && writing}{@render find()}{/if}
        {#if onUnsubscribe}
          <button
            type="button"
            class="text-link text-ui text-danger"
            title="Stops following them and removes their articles; saved, highlighted and noted ones can stay. You can undo it."
            aria-disabled={busy}
            onclick={leave}>Unsubscribe</button
          >
        {/if}
      </div>
      <p role="status" class={["flex items-start gap-2 text-meta text-danger", !message && "sr-only"]}>{#if message}<span class="mt-px shrink-0"><Icon name="alert" /></span>{message}{/if}</p>
    {/if}
  </div>
{/if}

<style>
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
</style>
