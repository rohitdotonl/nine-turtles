<!--
  A main button's own word while it waits (decision 0229): "Sign in" becomes
  "Signing in…", "Save" becomes "Saving…", once the wait has passed half a
  second, so a quick answer never flickers. A word changing, never a
  spinner or a fade (DESIGN.md → "Instant and still"); the button keeps its
  look and its place (decision 0045). Screen readers hear the button's new
  name where it has the keyboard.
-->
<script lang="ts">
  let { busy, word, doing }: { busy: boolean; word: string; doing: string } = $props();

  /** How long a press waits before its button says it's working. */
  const AFTER_MS = 500;
  let late = $state(false);

  $effect(() => {
    if (!busy) {
      late = false;
      return;
    }
    const timer = setTimeout(() => (late = true), AFTER_MS);
    return () => clearTimeout(timer);
  });
</script>

{late ? doing : word}
