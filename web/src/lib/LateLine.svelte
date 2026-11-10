<!--
  A wait that says so (decision 0230): a list, an article or a video still on
  its way shows one quiet line, "Loading Outdoors…", once the wait has passed
  half a second, so a quick answer never flickers. Words, never a spinner or
  grey boxes (DESIGN.md → "Instant and still"); what arrives takes the line's
  place. Screen readers hear the line once it shows.
-->
<script lang="ts">
  import { SAY_AFTER_MS } from "./messages";

  let { words, class: classes = "" }: { words: string; class?: string } = $props();

  let late = $state(false);
  $effect(() => {
    const timer = setTimeout(() => (late = true), SAY_AFTER_MS);
    return () => clearTimeout(timer);
  });
</script>

<p class={classes} aria-live="polite" lang="en">{late ? words : ""}</p>
