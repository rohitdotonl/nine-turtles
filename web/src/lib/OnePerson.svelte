<!--
  "One person?" (SPEC section 36, decision 0309): two follows that share one
  website, asked about once, at the top of Everyone you follow and in Add when
  the second is followed. One box a tone off the page (`.tone-box`), as who
  isn't working: the question, the two names in full ink and the website,
  then Join them (an outlined button) and Keep apart (words). It answers
  itself (`/api/writers/join`, `/api/writers/apart`) and says a refusal under
  the buttons; the page it's on says what happened next. `focus()` puts the
  keyboard on the box, so a reader meets the question before the page's own.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { keepApart, type Alike } from "./onePerson";
  import { join, type Before } from "./people";

  let {
    pair,
    onJoined,
    onKeptApart,
  }: {
    pair: Alike;
    /** They're one person now, under `pair.names[0]`: `before` is what Undo needs. */
    onJoined: (before: Before[]) => void;
    /** Never asked about again. */
    onKeptApart: () => void;
  } = $props();

  const id = $props.id();
  let box: HTMLElement | undefined = $state();
  let busy = $state(false);
  let problem = $state("");

  export function focus() {
    box?.focus();
  }

  async function answer(joining: boolean) {
    if (busy) return;
    busy = true;
    const asked = pair;
    const result = joining ? await join(asked.feeds) : { refusal: await keepApart(asked), before: [] };
    busy = false;
    problem = result.refusal ?? "";
    if (result.refusal) return;
    if (joining) onJoined(result.before);
    else onKeptApart();
  }
</script>

<div bind:this={box} tabindex="-1" class="tone-box outline-none" role="group" aria-labelledby={`${id}-title`} aria-describedby={`${id}-what`}>
  <p id={`${id}-title`} class="tone-box-title font-semibold">
    <span class="icon"><Icon name="person" /></span>One person?
  </p>
  <p id={`${id}-what`} class="what text-meta text-ink-2">
    <bdi class="font-semibold text-ink">{pair.names[0]}</bdi> and <bdi class="font-semibold text-ink">{pair.names[1]}</bdi> share one website, <bdi class="address break-all">{pair.site}</bdi>.
  </p>
  <div class="tone-box-actions">
    <button type="button" class="btn btn-small" aria-disabled={busy} onclick={() => void answer(true)}>Join them</button>
    <button type="button" class="text-link text-ui" aria-disabled={busy} onclick={() => void answer(false)}>Keep apart</button>
  </div>
  <p role="status" class={["flex items-start gap-2 text-meta text-danger", !problem && "sr-only"]}>{#if problem}<span class="mt-px shrink-0"><Icon name="alert" /></span>{problem}{/if}</p>
</div>

<style>
  .icon {
    display: flex;
    color: var(--ink-2);
  }
  .what {
    line-height: 1.5;
  }
</style>
