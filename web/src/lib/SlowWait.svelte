<!--
  A slow wait that says so, and keeps saying so (decision 0286): for waits on
  someone else's site, YouTube or a publisher's audio, which can take from a
  few seconds to a minute. Like every wait (`LateLine.svelte`, decision 0230)
  it says nothing for half a second, then what it's doing, "Looking on their
  site…"; the line moves on as time passes, so it never looks stuck:

  - after 5 seconds: "Still looking… Some sites are slow to answer.";
  - after 15 seconds (only given `long`): "Still looking… It can take up to a
    minute.", with Stop when stopping is harmless (`onStop`: a lookup that
    changes nothing).

  The three dots of its "…" breathe (`breathe.ts`, DESIGN.md → Exceptions
  log), and are still for a reader who asks for reduced motion. Screen
  readers hear each line as it changes, not the dots. Stop sits beside the
  line, outside what's heard, and keeps the line's height.
-->
<script lang="ts">
  import { breathe } from "./breathe";
  import { LONG_AFTER_MS, SAY_AFTER_MS, STILL_AFTER_MS } from "./messages";
  import TextButton from "./TextButton.svelte";

  let {
    words,
    again = "Still looking",
    why = "Some sites are slow to answer.",
    long,
    onStop,
    heard = true,
    class: classes = "",
  }: {
    /** What it's doing, without the dots: "Looking on their site". */
    words: string;
    /** What it says after 5 seconds, without the dots. */
    again?: string;
    /** Why, after 5 seconds. */
    why?: string;
    /** How long it can take, after 15 seconds; left out, the 5-second line stays. */
    long?: string;
    /** Stops waiting, offered with `long`; only where stopping undoes nothing. */
    onStop?: () => void;
    /** False inside a line that's already heard by screen readers, so nothing is said twice. */
    heard?: boolean;
    class?: string;
  } = $props();

  let stage = $state(0);
  $effect(() => {
    const timers = [SAY_AFTER_MS, STILL_AFTER_MS, LONG_AFTER_MS].map((after, index) => setTimeout(() => (stage = index + 1), after));
    return () => timers.forEach(clearTimeout);
  });

  let head = $derived(stage <= 1 ? words : again);
  let tail = $derived(stage === 2 || (stage === 3 && !long) ? why : stage === 3 ? long : "");
</script>

{#if heard || stage > 0}
  <!-- Inside a line that's already heard, nothing at all until there's something to say, so that line can stay empty (and hidden) meanwhile. -->
  <span class={["slow-wait", classes]}>
    <span role={heard ? "status" : undefined} lang="en"
      >{#if stage > 0}{head}<span class="dots" aria-hidden="true" use:breathe><span></span><span></span><span></span></span
        ><span class="sr-only">…</span>{#if tail}{" "}{tail}{/if}{/if}</span
    >{#if stage === 3 && long && onStop}<TextButton class="stop" onclick={onStop}>Stop</TextButton>{/if}
  </span>
{/if}

<style>
  .slow-wait {
    display: inline;
  }
  /* The dots are drawn, not written, so the line's words read "Looking…" with one real ellipsis (hidden from sight). */
  .dots span::before {
    content: ".";
  }
  /* Stop keeps its 44px target without making the line any taller. */
  .slow-wait :global(.stop) {
    margin-block: -0.75rem;
    margin-inline-start: 0.5rem;
    vertical-align: baseline;
  }
</style>
