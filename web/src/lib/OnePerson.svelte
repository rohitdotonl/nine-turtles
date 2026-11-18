<!--
  "One person?" (SPEC section 36, decision 0308): two follows that share one
  website, asked about once, at the top of Everyone you follow and in Add when
  the second is followed. One box a tone off the page (`.tone-box`), as who isn't
  working: the question, the two names in full ink and the
  website, then Join them (an outlined button) and Keep apart (words). What
  each does is up to the page it's on; a refusal is said under them.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { Alike } from "./onePerson";

  let {
    pair,
    busy = false,
    problem = "",
    onJoin,
    onApart,
  }: {
    pair: Alike;
    busy?: boolean;
    /** Why the last answer couldn't be kept, in red words under the buttons. */
    problem?: string;
    onJoin: () => void;
    onApart: () => void;
  } = $props();

  const id = $props.id();
</script>

<div class="tone-box" role="group" aria-labelledby={`${id}-title`} aria-describedby={`${id}-what`}>
  <p id={`${id}-title`} class="tone-box-title font-semibold">
    <span class="icon"><Icon name="person" /></span>One person?
  </p>
  <p id={`${id}-what`} class="what text-meta text-ink-2">
    <bdi class="font-semibold text-ink">{pair.names[0]}</bdi> and <bdi class="font-semibold text-ink">{pair.names[1]}</bdi> share one website, <bdi class="break-all">{pair.site}</bdi>.
  </p>
  <div class="tone-box-actions">
    <button type="button" class="btn btn-small" aria-disabled={busy} onclick={() => !busy && onJoin()}>Join them</button>
    <button type="button" class="text-link text-ui" aria-disabled={busy} onclick={() => !busy && onApart()}>Keep apart</button>
  </div>
  <p role="status" class={["text-meta text-danger", !problem && "sr-only"]}>{problem}</p>
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
