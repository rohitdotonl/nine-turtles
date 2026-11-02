<!--
  How to open an article, beside a list with something to open (decisions 0053, 0062): screen
  readers always hear it; once, on a screen with a keyboard, the two keys worth knowing first show
  quietly too, then never again on this device. Touch screens hear and see only "Choose one from
  the list." Under the reading area's quiet line (`floating`), or at the foot of a person's page.
-->
<script lang="ts">
  import { keyCap } from "./keyboard";
  import { currentKeyOf } from "./keys.svelte";

  let { tipSeen, floating = false }: { tipSeen: boolean; floating?: boolean } = $props();

  // The reader's own key for the next article, if they kept one (decision 0110).
  let first = $derived(currentKeyOf("next-article"));
  let cap = $derived(first ? keyCap(first) : undefined);
</script>

{#if tipSeen}
  <p class="sr-only">Choose one from the list{#if cap}<span class="keyboard-hint">, or press {cap.spoken ?? cap.cap}</span>{/if}.</p>
{:else}
  <p class={["shortcut-tip keyboard-hint", floating && "absolute top-full left-1/2 w-[min(28rem,80vw)] -translate-x-1/2"]}>
    {#if cap}Press {#if cap.spoken}<kbd class="key" aria-hidden="true">{cap.cap}</kbd><span class="sr-only">{cap.spoken}</span>{:else}<kbd class="key">{cap.cap}</kbd>{/if} to open the first article, or <kbd class="key">?</kbd> for every shortcut.{:else}Press <kbd class="key">?</kbd> for every shortcut.{/if}
  </p>
  <p class="sr-only touch-only">Choose one from the list.</p>
{/if}
