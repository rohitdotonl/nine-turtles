<!--
  The welcome, before the first feed (SPEC section 2): a title in the reading serif, one
  sentence, a wide field with Add, then the two quiet side doors under it, "New to feeds?
  Start here" and importing a list of feeds (decision 0196), all in one centred 420px
  column: one message, one action.
  On a phone (`start`) it's left-aligned on the screen's 20px margin instead (decision 0052).
  With the Add a feed sheet open over it (`covered`), the sheet has the only field.
-->
<script lang="ts">
  import AddFeed from "./AddFeed.svelte";
  import ImportOpml from "./ImportOpml.svelte";
  import type { Feed } from "./shapes";
  import type { Route } from "./router";

  let {
    start,
    onList,
    covered,
    heading = $bindable(),
    field = $bindable(),
    follow,
    onAdded,
    onOpen,
    onImported,
  }: {
    start: boolean;
    /** In the list's place (a phone, or a medium window), on the list's grey: its cards are the page's color. */
    onList: boolean;
    covered: boolean;
    heading?: HTMLHeadingElement;
    field?: HTMLInputElement;
    /** Goes to a place in the app, unless the click is meant for a new tab or window. */
    follow: (event: MouseEvent, next: Route) => void;
    onAdded: (feed: Feed, note?: string) => void;
    onOpen: (id: number) => void;
    /** A list from another app brought feeds in: the welcome gives way, and `message` says what came. */
    onImported: (message: string) => void;
  } = $props();

  /** What importing said, while the welcome stays (nothing came in, or the file wasn't a list). */
  let importLines: string[] = $state([]);
  const BRING = "Bring your list from another app…";
</script>

<div class="flex w-full max-w-[26.25rem] flex-col gap-6">
  <div class={start ? "text-left" : "text-center"}>
    <h2 id="welcome-heading" tabindex="-1" bind:this={heading} class="font-serif text-xlarge font-semibold tracking-[-0.01em]">Hello. <span class="block text-balance">Who would you like to read?</span></h2>
    <p class="mt-3 text-ink-2">Paste the address of someone's blog, newsletter or channel.</p>
  </div>
  {#if !covered}
    <!--
      The two side doors sit just under the field, the main door (decision 0196), centred as
      everything here is (on a phone, on the screen's margin): "New to feeds?", for someone who
      has never used feeds (what they are, and a few to start with, in a sheet; decision 0079),
      then importing, the other way in (decisions 0045, 0048). Each is a link in the text color,
      underlined as the article's note links are, with no side padding so its words line up
      with the heading's, in a 44px-tall target (decision 0055). It opens the device's file
      chooser at once (decision 0137); what came in is said on the list that follows, and a
      file that brought nothing is said here, under it.
    -->
    <AddFeed bind:field feeds={[]} {onAdded} {onOpen} {start} {onList}>
      {#snippet alternative()}
        <a href="/new-to-feeds" onclick={(event) => follow(event, { kind: "new-to-feeds" })} class="text-link">New to feeds? Start here</a>
        <ImportOpml link={BRING} bind:lines={importLines} onImported={(lines, added) => added > 0 && onImported(lines.join(" "))} />
        <div role="status" class={["flex flex-col gap-1 text-small text-ink-2", importLines.length === 0 && "sr-only"]}>
          {#each importLines as line, index (index)}<p>{line}</p>{/each}
        </div>
      {/snippet}
    </AddFeed>
  {:else}
    <!--
      With the Add a feed sheet over it, the field is the sheet's (one field of that name on the page).
      The welcome keeps its exact shape under the dim, a still picture of itself that nothing can
      reach, so nothing behind the sheet moves as it opens or closes (decision 0048).
    -->
    <div inert aria-hidden="true" class="flex flex-col gap-1.5">
      <div class="welcome-row flex gap-2">
        <span class="field flex min-w-0 flex-1 items-center overflow-hidden whitespace-nowrap text-muted"><span class="welcome-hint">Their website's address</span></span>
        <span class="btn-primary rounded-lg">Add</span>
      </div>
      <div class={["flex flex-col", start ? "items-start" : "items-center"]}>
        <span class="text-link">New to feeds? Start here</span>
        <span class="text-link">{BRING}</span>
      </div>
    </div>
  {/if}
</div>
