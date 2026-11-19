<!--
  Everyone the reader follows couldn't be loaded, so nothing that needs them
  can show: the sidebar's people, and every list, person and folder (they're
  drawn from that list). Each place says so instead of staying blank
  (decision 0318): the sidebar, and where the list would be (LoadFailed, as
  every list that couldn't load). With no answer at all it's said calmly,
  saying when it comes back (decision 0312), and asked for again by itself
  once the connection is back: once, even when both lines show.
-->
<script module lang="ts">
  let asking: Promise<void> | undefined;

  /** One ask at a time, whichever line asks: the sidebar's and the list's show together on a computer. */
  function once(ask: () => Promise<void>): Promise<void> {
    return (asking ??= ask().finally(() => (asking = undefined)));
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "./Icon.svelte";
  import LoadFailed from "./LoadFailed.svelte";
  import TextButton from "./TextButton.svelte";
  import { away, connection, whenBack } from "./connection.svelte";

  let {
    where,
    onRetry,
  }: {
    /** The sidebar's line, or the line in the list's place. */
    where: "sidebar" | "list";
    /** Asks for everyone the reader follows again; the lines stay until the answer, so the keyboard keeps its place. */
    onRetry: () => Promise<void>;
  } = $props();

  const retry = () => once(onRetry);
  let line: HTMLElement | undefined = $state();
  // The list's line asks by itself (LoadFailed's `shows`); the sidebar's does too, for a phone's Home, where it's alone.
  onMount(() => (where === "sidebar" ? whenBack(() => void retry()) : undefined));
</script>

{#if where === "list"}
  <LoadFailed words="The articles couldn't be loaded." shows="Your reading shows" heading="list-heading" onRetry={retry} class="mt-4" />
{:else if connection.offline}
  <!-- Not a status: on a computer the list's line beside it says the same, and is the one heard. -->
  <p class="px-4 pt-4 text-meta text-ink-2">{away().why} Your reading shows {away().back}.</p>
{:else}
  <!-- Once they're back the line has gone, and the keyboard goes to the sidebar's first row; still failing, it stays on Try again. -->
  <p bind:this={line} role="status" class="flex flex-wrap items-center gap-x-2 px-4 pt-4 text-meta text-danger"><span class="shrink-0"><Icon name="alert" /></span>Everyone you follow couldn't be loaded.<TextButton onclick={() => retry().then(() => line?.isConnected || document.querySelector<HTMLElement>("#sidebar a")?.focus())}>Try again</TextButton></p>
{/if}
