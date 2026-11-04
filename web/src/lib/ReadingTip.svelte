<!--
  How to begin, beside a list with something to open (decisions 0053, 0062, 0180): screen
  readers always hear it; once, on a screen with a keyboard, the two keys that are the heart of
  nine turtles show quietly too, then never again on this device. Touch screens hear and see only
  "Choose one from the list." Under the reading area's quiet line (`floating`), or at the foot of a person's page.
-->
<script lang="ts">
  import { keyCap, keyOf } from "./keyboard";

  let { tipSeen, floating = false }: { tipSeen: boolean; floating?: boolean } = $props();

  const read = keyCap(keyOf("next-article") ?? "");
  const write = keyCap(keyOf("write-back") ?? "");
</script>

{#if tipSeen}
  <p class="sr-only">Choose one from the list<span class="keyboard-hint">, or press {read}</span>.</p>
{:else}
  <p class={["shortcut-tip keyboard-hint", floating && "absolute top-full left-1/2 w-[min(28rem,80vw)] -translate-x-1/2"]}>
    Press <kbd class="key">{read}</kbd> to read. Press <kbd class="key">{write}</kbd> to write back.
  </p>
  <p class="sr-only touch-only">Choose one from the list.</p>
{/if}
