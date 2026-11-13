<!--
  "New to feeds?" (SPEC section 2, decision 0079), opened from the
  first-visit welcome: two sentences on what a feed is, a link to the
  website's guide, and a short, fixed list of feeds to start with, drawn as a
  grouped list of tick boxes, as a Mac draws a choice of any (decision 0045).
  None is ticked to begin with: the reader chooses. Each writer's name links to
  their site, in a tab of its own. With nothing ticked the main button reads
  "Add all five" and adds them all; once any is ticked, "Add 2 chosen" adds
  only those. They're added one after another through the same path as
  pasting an address; while it works, a line of text says so, with no spinner.

  In a sheet, Cancel and the main button share the foot row; on a phone's
  page, the phone sheet's one build (decision 0052): no Cancel (the X beside
  the title is the way out) and the main action the full width at the foot.
-->
<script lang="ts">
  import Waiting from "./Waiting.svelte";
  import Icon from "./Icon.svelte";
  import type { Feed } from "./shapes";
  import { GUIDE_URL, STARTERS, addLabel, addStarters, siteName, startProblem, type Starter } from "./starters";

  let {
    onAdded,
    onCancel,
    page = false,
  }: {
    /** Some were added (or were followed already); `failed` are the ones that weren't. */
    onAdded: (added: Feed[], failed: Starter[]) => void;
    /** In a sheet: Cancel, beside the main action in one row at the foot. */
    onCancel?: () => void;
    /** On a phone's page: no Cancel, and the main action the full width at the screen's foot. */
    page?: boolean;
  } = $props();

  let chosen: string[] = $state([]);
  let busy = $state(false);
  let done = $state(0);
  let adding = $state(0);
  let message = $state("");

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    // Nothing ticked: all of them.
    const picked = chosen.length === 0 ? STARTERS : STARTERS.filter((starter) => chosen.includes(starter.feed));
    busy = true;
    message = "";
    adding = picked.length;
    const result = await addStarters(picked, (count) => (done = count));
    busy = false;
    if (result.added.length === 0 && result.failed.length > 0) {
      message = startProblem(result.failed);
      chosen = result.failed.map((starter) => starter.feed);
    } else onAdded(result.added, result.failed);
  }
</script>

<form onsubmit={submit} class={["flex flex-col", page && "flex-1"]}>
  <p>A feed is a website's list of its newest writing. Follow a few, and what they publish gathers here for you to read. Nobody else decides what you see.</p>
  <!-- The website's guide for newcomers, in a tab of its own; its words start on the margin. -->
  <a href={GUIDE_URL} target="_blank" rel="noopener" class="text-link self-start">Here's how feeds work<span class="sr-only">{" "}(on the nine turtles website, opens in a new tab)</span></a>
  <fieldset class="m-0 mt-3 min-w-0 border-0 p-0">
    <legend class="inset-head">A few to start with</legend>
    <div class="inset-group">
      {#each STARTERS as starter (starter.feed)}
        <label class="inset-row check-row flex-nowrap">
          <input type="checkbox" value={starter.feed} bind:group={chosen} aria-label={`${starter.name}: ${starter.about}`} />
          <span class="flex min-w-0 flex-col py-1">
            <!--
              Their name and site's address are one link to the site, in a tab of its own, at least
              44px tall, raised above the tick box that covers the row: pressing them opens the site,
              pressing anywhere else in the row ticks.
            -->
            <a href={starter.site} target="_blank" rel="noopener" class="relative z-10 flex min-h-11 flex-col justify-center self-start">
              <span class="break-words underline decoration-1 underline-offset-[3px]">{starter.name}</span>
              <span class="text-meta break-all text-ink-2">{siteName(starter.site)}<span class="sr-only">{" "}(their website, opens in a new tab)</span></span>
            </a>
            <span class="text-meta text-muted">{starter.about}</span>
          </span>
          <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size="tick" /></span>
        </label>
      {/each}
    </div>
  </fieldset>
  <!--
    Screen readers hear each new line without the keyboard's place moving. It takes room only once
    there's something to say, and the sheet grows down by it (its top stays put); a problem is in red
    words after an icon.
  -->
  <p id="starters-status" role="status" class={["flex items-start gap-2 text-meta", message && !busy && "text-danger", busy || message ? "mt-3" : "sr-only"]}>
    {#if busy}Adding feeds… {done} of {adding} done{:else if message}<span class="mt-px shrink-0"><Icon name="alert" /></span>{message}{/if}
  </p>
  {#if page}
    <div class="page-action">
      <button type="submit" aria-disabled={busy} class="btn-primary"><Waiting {busy} word={addLabel(chosen.length)} doing="Adding…" /></button>
    </div>
  {:else}
    <!-- The sheet's one row of actions, 20px under what's above it: Cancel, then the main action at the right end. -->
    <div class="sheet-actions mt-5">
      <button type="button" onclick={onCancel} class="btn">Cancel</button>
      <button type="submit" aria-disabled={busy} class="btn-primary"><Waiting {busy} word={addLabel(chosen.length)} doing="Adding…" /></button>
    </div>
  {/if}
</form>
