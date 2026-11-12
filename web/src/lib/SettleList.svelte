<!--
  Who could be either (SPEC section 15, decision 0264), on Everyone you
  follow: the places nine turtles couldn't sort, kept with the publications
  until the reader says. Each tick counts at once, making them a person;
  unticked, they're open again. A ticked row stays where it is until the page
  is left, so nothing moves under the finger. "The rest are publications"
  settles every one left. The ticks are one group, named by the heading and
  described by the sentence under it; each tick is named by who it is.
-->
<script lang="ts">
  import Dated from "./Dated.svelte";
  import Icon from "./Icon.svelte";
  import { settleLine, type Tended } from "./tidy";

  let {
    rows,
    busy,
    onTick,
    onRest,
  }: {
    /** Everyone listed here since the page opened, A to Z: the open ones, and those ticked here. */
    rows: Tended[];
    busy: boolean;
    /** Ticked (a person) or unticked (open again); answers whether it was saved. */
    onTick: (row: Tended, person: boolean) => Promise<boolean>;
    /** "The rest are publications". */
    onRest: () => void;
  } = $props();

  let open = $derived(rows.filter((row) => row.open).length);

  async function ticked(row: Tended, box: HTMLInputElement) {
    const person = box.checked;
    // Not saved: the tick goes back to what's true.
    if (!(await onTick(row, person))) box.checked = !person;
  }
</script>

<section aria-labelledby="settle-heading">
  <div class="flex min-h-11 items-center">
    <h3 id="settle-heading" class="inset-head mb-0">{open > 0 ? `${open} could be either` : "Could be either"}</h3>
  </div>
  <p id="settle-how" class="inset-foot mt-0 mb-3">Their feeds don't say who writes them. Tick the people, anyone you might write back to. The rest stay with Publications.</p>
  <div role="group" aria-labelledby="settle-heading" aria-describedby="settle-how">
    <ul class="inset-group">
      {#each rows as row (row.id)}
        <li class="contents">
          <label class="inset-row check-row settle-row">
            <input
              type="checkbox"
              checked={!row.open}
              aria-labelledby={`settle-name-${row.id}`}
              aria-describedby={`settle-line-${row.id}`}
              onchange={(event) => ticked(row, event.currentTarget)}
            />
            <span class="flex min-w-0 flex-1 flex-col py-2">
              <span id={`settle-name-${row.id}`} class="break-words">{row.title}</span>
              <span id={`settle-line-${row.id}`} class="text-meta text-muted break-words"><Dated text={settleLine(row)} /></span>
            </span>
            <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size="tick" /></span>
          </label>
        </li>
      {/each}
    </ul>
  </div>
  {#if open > 0}
    <button type="button" class="btn mt-3" aria-disabled={busy} onclick={onRest}>The rest are publications</button>
  {/if}
</section>

<style>
  /* Two lines, as Everyone you follow's other rows. */
  .settle-row {
    min-height: 3.5rem;
  }
</style>
