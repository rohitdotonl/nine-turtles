<!--
  A list or group that couldn't load: oxblood words with the alert icon,
  then Try again (BRAND.md → "Messages"; SPEC section 8). Pressing it, the
  line goes while the list is asked for again, so the keyboard's place moves
  to `heading` (the page's or the group's) rather than being lost; a second
  failure brings the line back, heard again by a screen reader.
  Given `shows`, a group that got no answer at all says so calmly instead,
  as every offline line does (decision 0312), with no Try again, which isn't
  the fix, and asks again by itself once the connection is back (decision 0318).
-->
<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import TextButton from "./TextButton.svelte";
  import { away, connection, whenBack } from "./connection.svelte";

  let {
    words,
    onRetry,
    heading,
    shows,
    class: extra = "",
  }: {
    /** What couldn't load, as a full sentence. */
    words: string;
    /** Asks for the list again; the caller shows this line again if it fails. */
    onRetry: () => unknown;
    /** Where the keyboard waits: the id of the page's or group's heading. */
    heading: string;
    /** What comes back once nine turtles answers, said when it didn't answer at all: "Hidden articles show". */
    shows?: string;
    class?: string;
  } = $props();

  $effect(() => {
    if (shows && connection.offline) return whenBack(() => void onRetry());
  });

  async function retry() {
    document.getElementById(heading)?.focus();
    await tick();
    await onRetry();
  }
</script>

{#if shows && connection.offline}
  <p role="status" class={["text-ink-2", extra]}>{away().why} {shows} {away().back}.</p>
{:else}
  <p role="status" class={["flex flex-wrap items-center gap-x-2 text-danger", extra]}>
    <span class="shrink-0"><Icon name="alert" /></span>{words}
    <TextButton class="px-1" onclick={retry}>Try again</TextButton>
  </p>
{/if}
