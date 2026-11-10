<!--
  A main button's own word while it waits (decision 0229): "Sign in" becomes
  "Signing in…", "Save" becomes "Saving…", once the wait has passed half a
  second, so a quick answer never flickers. A word changing, never a
  spinner or a fade (DESIGN.md → "Instant and still"); the button keeps its
  look and its place (decision 0045), and its width: both words take the
  same cell, the hidden one invisible, so nothing beside it moves. Only the
  shown word is in the button's name.
-->
<script lang="ts">
  import { SAY_AFTER_MS } from "./messages";

  let { busy, word, doing }: { busy: boolean; word: string; doing: string } = $props();

  let late = $state(false);

  $effect(() => {
    if (!busy) {
      late = false;
      return;
    }
    const timer = setTimeout(() => (late = true), SAY_AFTER_MS);
    return () => clearTimeout(timer);
  });
</script>

<span class="grid">
  <span class={["col-start-1 row-start-1", late && "invisible"]}>{word}</span>
  <span class={["col-start-1 row-start-1", !late && "invisible"]}>{doing}</span>
</span>
