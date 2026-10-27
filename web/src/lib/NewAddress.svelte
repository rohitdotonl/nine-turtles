<!--
  Find new address, the one way it works wherever it's offered (decision
  0106): on the feed health page (SPEC section 17), in the quiet line above a
  failing feed's list (section 6) and in Edit feed (section 15). The place
  draws its own "Find new address" button and calls `find()`; this shows
  what came back, in place:

  - one feed: a plain question, "Use https://… instead?", with Cancel and
    Use it, and a line saying its name, folders, articles and stars stay;
  - several: the choice of one (a round mark at each row's end, the first
    chosen) with Cancel and Use this address;
  - none: a plain sentence saying why.

  The site is visited only because the reader asked (decision 0016). One
  status line says each step to screen readers; the keyboard moves to Use it
  or the chosen feed, and back to the place's button on Cancel.
-->
<script lang="ts">
  import { tick } from "svelte";
  import type { Choice } from "./feeds";
  import { MOVED, findAddress, found, moveTo, refusalMessage, type Sick } from "./health";

  let {
    feed,
    open = $bindable(false),
    busy = $bindable(false),
    onMoved,
    onClosed,
  }: {
    feed: { id: number; title: string };
    /** A question or a choice is showing: the place may hide its other actions meanwhile. */
    open?: boolean;
    busy?: boolean;
    /** The feed moved (its number changes if others follow the old address too). */
    onMoved: (feed: Sick) => void;
    /** Cancel: the place puts the keyboard back on its Find new address button. */
    onClosed: () => void;
  } = $props();

  const id = $props.id();
  let said = $state("");
  let choices: Choice[] = $state([]);
  let chosen = $state("");
  let box: HTMLElement | undefined = $state();

  /** Find new address: asks the site once, then shows what it named. */
  export async function find() {
    if (busy) return;
    busy = true;
    choices = [];
    open = false;
    said = "Looking on the site…";
    const next = found(await findAddress(feed.id));
    busy = false;
    said = next.said;
    if (next.kind === "none") return;
    choices = next.kind === "one" ? [next.choice] : next.choices;
    chosen = choices[0]?.url ?? "";
    open = true;
    await tick();
    box?.querySelector<HTMLElement>(next.kind === "one" ? "[data-focus=use]" : "input:checked")?.focus();
  }

  function cancel() {
    choices = [];
    open = false;
    said = "";
    onClosed();
  }

  async function use() {
    if (!chosen || busy) return;
    busy = true;
    said = "Moving…";
    const answer = await moveTo(feed.id, chosen);
    busy = false;
    if ("error" in answer) {
      said = refusalMessage(answer, "move");
      return;
    }
    choices = [];
    open = false;
    said = MOVED;
    onMoved({ ...answer, state: "working" });
  }
</script>

<div bind:this={box} class={["new-address", (said || choices.length > 0) && "showing"]}>
  <p role="status" id={`${id}-said`} class={["break-words text-ink-2", !said && "sr-only"]}>{said}</p>
  {#if choices.length === 1}
    <p id={`${id}-keeps`} class="text-meta text-muted">Its name, folders, articles and stars stay.</p>
    <div class="actions">
      <button type="button" class="btn btn-small" onclick={cancel}>Cancel</button>
      <button type="button" class="btn-primary" data-focus="use" aria-describedby={`${id}-said ${id}-keeps`} aria-disabled={busy} onclick={use}
        >Use it</button
      >
    </div>
  {:else if choices.length > 1}
    <div role="radiogroup" aria-label={`Feeds on ${feed.title}'s site`} class="choices inset-group">
      {#each choices as choice (choice.url)}
        <label class="inset-row check-row flex-nowrap">
          <input type="radio" name={`${id}-address`} value={choice.url} bind:group={chosen} />
          <span class="flex min-w-0 flex-col py-1">
            <span class="break-words">{choice.title}</span>
            <span class="text-small break-all text-muted">{choice.url}</span>
          </span>
          <span aria-hidden="true" class="radio-mark shrink-0"></span>
        </label>
      {/each}
    </div>
    <p id={`${id}-keeps`} class="text-meta text-muted">Its name, folders, articles and stars stay.</p>
    <div class="actions">
      <button type="button" class="btn btn-small" onclick={cancel}>Cancel</button>
      <button type="button" class="btn-primary" aria-describedby={`${id}-keeps`} aria-disabled={busy} onclick={use}>Use this address</button>
    </div>
  {/if}
</div>

<style>
  .new-address {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
    line-height: 1.4;
  }
  /* Nothing to say yet: it takes no room, though its status line is there for screen readers. */
  .new-address:not(.showing) {
    gap: 0;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
    align-items: center;
    margin-top: 0.25rem;
  }
  /* The feeds the site names sit on the page's own color, so they stand apart from a grouped row. */
  .choices {
    --group: var(--paper);
    margin-top: 0.25rem;
  }
</style>
