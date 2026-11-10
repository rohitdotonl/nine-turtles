<!--
  A button set in a line of words: the list's note (Undo, Try again,
  Reload, Show), a line that couldn't load (Try again) and the lines under
  a group in Settings. The text color, semibold and underlined, so it reads
  as something to press without an edge; never the accent (DESIGN.md →
  "Visual language"). Still a 44px target. One copy, so every such button
  looks the same (BRAND.md → "Messages").
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  let {
    element = $bindable(),
    class: extra = "",
    children,
    ...rest
  }: HTMLButtonAttributes & { element?: HTMLButtonElement; class?: string; children: Snippet } = $props();
</script>

<button
  bind:this={element}
  type="button"
  {...rest}
  class={["text-button min-h-11 min-w-11 shrink-0 font-semibold text-ink underline underline-offset-4", extra]}>{@render children()}</button
>
