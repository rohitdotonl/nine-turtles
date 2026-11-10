<!--
  A list or group that couldn't load: oxblood words with the alert icon,
  then Try again (BRAND.md → "Messages"; SPEC section 8). Pressing it, the
  line goes while the list is asked for again, so the keyboard's place moves
  to `heading` (the page's or the group's) rather than being lost; a second
  failure brings the line back, heard again by a screen reader.
-->
<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import TextButton from "./TextButton.svelte";

  let {
    words,
    onRetry,
    heading,
    class: extra = "",
  }: {
    /** What couldn't load, as a full sentence. */
    words: string;
    /** Asks for the list again; the caller shows this line again if it fails. */
    onRetry: () => unknown;
    /** Where the keyboard waits: the id of the page's or group's heading. */
    heading: string;
    class?: string;
  } = $props();

  async function retry() {
    document.getElementById(heading)?.focus();
    await tick();
    await onRetry();
  }
</script>

<p role="status" class={["flex flex-wrap items-center gap-x-1.5 text-danger", extra]}>
  <span class="shrink-0"><Icon name="alert" /></span>{words}
  <TextButton class="px-1" onclick={retry}>Try again</TextButton>
</p>
